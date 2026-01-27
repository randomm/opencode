import { Slug } from "@opencode-ai/util/slug"
import path from "path"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Decimal } from "decimal.js"
import z from "zod"
import { type LanguageModelUsage, type ProviderMetadata } from "ai"
import { Config } from "../config/config"
import { Flag } from "../flag/flag"
import { Identifier } from "../id/id"
import { Installation } from "../installation"

import { Storage } from "../storage/storage"
import { Log } from "../util/log"
import { MessageV2 } from "./message-v2"
import { Instance } from "../project/instance"
import { SessionPrompt } from "./prompt"
import { fn } from "@/util/fn"
import { Command } from "../command"
import { Snapshot } from "@/snapshot"

import type { Provider } from "@/provider/provider"
import { PermissionNext } from "@/permission/next"
import { Global } from "@/global"
import { SessionStatus } from "./status"
import crypto from "crypto"
import { Agent } from "../agent/agent"
import { BackgroundTasks } from "../util/tasks"

export interface TaskMetadata {
  agent_type: string
  description: string
  session_id: string
  start_time: number
  release_slot?: () => void
}

export interface BackgroundTaskResult {
  id: string
  status: "running" | "completed" | "failed"
  error?: string
  time: {
    started: number
    completed: number
  }
  metadata?: TaskMetadata
  cancelled?: boolean
  result?: string
}

function sanitizeError(error: string): string {
  let sanitized = error

  sanitized = sanitized.replace(
    /Authorization:\s*[Bb]earer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
    "Authorization: Bearer [REDACTED: TOKEN]",
  )
  sanitized = sanitized.replace(/\b[Bb]earer\s+[a-zA-Z0-9\-._~+/]+=*\b/gi, "Bearer [REDACTED: TOKEN]")

  sanitized = sanitized.replace(/\bey[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+){1,2}/gi, "[REDACTED: JWT]")

  sanitized = sanitized.replace(
    /\b(sk-[a-zA-Z0-9_-]{10,}|pk-[a-zA-Z0-9_-]{10,}|api[_-]?key[=\s][^\s]+|api[_-]?key:\s*[^\s]+)\b/gi,
    "[REDACTED: API_KEY]",
  )

  sanitized = sanitized.replace(
    /([&?])(api[_-]?key|token|secret|password|access[_-]?token|auth[_-]?token)=[^&]*/gi,
    "$1$2=[REDACTED: SECRET]",
  )

  sanitized = sanitized.replace(/\/Users\/[^\/]+\/[^\/\s]+/g, "[REDACTED: PATH]")
  sanitized = sanitized.replace(/\/home\/[^\/]+\/[^\/\s]+/g, "[REDACTED: PATH]")
  sanitized = sanitized.replace(/[A-Za-z]:\\(?:Users|Documents|[^\\]*\\)?[^\\]+/g, "[REDACTED: PATH]")
  sanitized = sanitized.replace(
    /\.(env(|\.(local|development|production))|pem|key|cert|credentials|secret|token|password)\/?\b/gi,
    "[REDACTED: FILE]",
  )

  const MAX_ERROR_LENGTH = 2000
  if (sanitized.length > MAX_ERROR_LENGTH) {
    const prefix = sanitized.slice(0, Math.max(0, MAX_ERROR_LENGTH - ERROR_TRUNCATION_SUFFIX_LENGTH))
    const suffix = "...truncated"
    sanitized = prefix + suffix
  }

  return sanitized
}

const pendingBackgroundTasks = new Map<string, Promise<string | undefined | void>>()
const pendingTaskMetadata = new Map<string, TaskMetadata>()
const subagentSessionIDs = new Map<string, string>()
const cancelledTasks = new Set<string>()
const reservedTaskSlots = new Map<string, Set<string>>()

const MAX_STORED_TASK_RESULTS = 1000
const backgroundTaskResults = new Map<string, BackgroundTaskResult>()

const MAX_DELIVERED_RESULTS = 10000
const deliveredTaskResults = new Set<string>()

const DEFAULT_TASK_TIMEOUT = 10 * 60 * 1000
const closingSessions = new Set<string>()

// Constants for metadata and result truncation
const MAX_AGENT_DESCRIPTION_LENGTH = 200
const MAX_TASK_RESULT_LENGTH = 5000
const SECONDS_TO_MS_MULTIPLIER = 1000
const ERROR_TRUNCATION_SUFFIX_LENGTH = 50

export function getSessionTaskCount(sessionID: string): number {
  return reservedTaskSlots.get(sessionID)?.size ?? 0
}

export function reserveTaskSlot(sessionID: string): () => void {
  const slotId = `reserved_${Date.now()}_${crypto.randomUUID()}`

  let slots = reservedTaskSlots.get(sessionID)
  if (!slots) {
    slots = new Set<string>()
    reservedTaskSlots.set(sessionID, slots)
  }

  slots.add(slotId)

  const release = () => {
    const currentSlots = reservedTaskSlots.get(sessionID)
    if (!currentSlots) return
    currentSlots.delete(slotId)
    if (currentSlots.size === 0) reservedTaskSlots.delete(sessionID)
  }

  return release
}

export namespace Session {
  const log = Log.create({ service: "session" })

  const parentTitlePrefix = "New session - "
  const childTitlePrefix = "Child session - "

  export const BackgroundTaskEvent = {
    Failed: BusEvent.define(
      "session.background_task.failed",
      z.object({
        taskID: z.string(),
        sessionID: z.string().optional(),
        parentSessionID: z.string().optional(),
        error: z.string(),
      }),
    ),
    Completed: BusEvent.define(
      "session.background_task.completed",
      z.object({
        taskID: z.string(),
        sessionID: z.string().optional(),
        parentSessionID: z.string().optional(),
      }),
    ),
  }

  export async function trackBackgroundTask(
    id: string,
    task: Promise<string | undefined | void>,
    sessionID?: string,
    metadata?: TaskMetadata,
    result?: string,
  ): Promise<void> {
    const started = metadata?.start_time ?? Date.now()

    if (sessionID) {
      if (closingSessions.has(sessionID)) {
        log.warn("refused to track task for closing session", { task_id: id, session_id: sessionID })
        return
      }
    }

    if (sessionID && closingSessions.has(sessionID)) {
      log.warn("refused to track task for closing session", { task_id: id, session_id: sessionID })
      return
    }

    const existing = backgroundTaskResults.get(id)
    if (!existing) {
      if (sessionID && closingSessions.has(sessionID)) {
        log.info("refused to create result entry for closing session", { task_id: id, session_id: sessionID })
        return
      }
      backgroundTaskResults.set(id, {
        id,
        status: "running",
        time: { started, completed: started },
        metadata,
        result,
      })
    }

    pendingBackgroundTasks.set(id, task)
    if (metadata) {
      pendingTaskMetadata.set(id, metadata)
    }
    if (sessionID) {
      subagentSessionIDs.set(id, sessionID)
    }

    if (sessionID && closingSessions.has(sessionID)) {
      log.warn("task rejected: session closed during tracking", { task_id: id, session_id: sessionID })
      pendingBackgroundTasks.delete(id)
      pendingTaskMetadata.delete(id)
      backgroundTaskResults.delete(id)
      return
    }
    try {
      const timeout = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error("Task timeout exceeded")), DEFAULT_TASK_TIMEOUT),
      )
      const taskResultValue = await Promise.race([task, timeout])

      if (cancelledTasks.has(id)) {
        return
      }

      if (sessionID && closingSessions.has(sessionID)) {
        backgroundTaskResults.delete(id)
        return
      }

      const taskResult = backgroundTaskResults.get(id)!
      const completedTime = Date.now()
      taskResult.status = "completed"
      taskResult.time.completed = completedTime

      if (typeof taskResultValue === "string") {
        taskResult.result = taskResultValue
      }

      if (backgroundTaskResults.size > MAX_STORED_TASK_RESULTS) {
        const firstKey = backgroundTaskResults.keys().next().value
        if (firstKey) backgroundTaskResults.delete(firstKey)
      }
      if (sessionID) {
        if (!closingSessions.has(sessionID)) {
          const parentSessionID = metadata?.session_id
          if (taskResult.status === "completed") {
            Bus.publish(BackgroundTaskEvent.Completed, { taskID: id, sessionID, parentSessionID })
          }
        }
      } else {
        Bus.publish(BackgroundTaskEvent.Completed, { taskID: id })
      }
    } catch (e) {
      if (cancelledTasks.has(id)) {
        return
      }

      if (sessionID && closingSessions.has(sessionID)) {
        backgroundTaskResults.delete(id)
        return
      }

      const error = e instanceof Error ? e.message : String(e)
      const sanitized = sanitizeError(error)
      log.error("background task failed", { id, session_id: sessionID, error: sanitized })

      const taskResult = backgroundTaskResults.get(id)
      if (taskResult) {
        taskResult.status = "failed"
        taskResult.error = sanitized
        taskResult.time.completed = Date.now()
      }

      if (backgroundTaskResults.size > MAX_STORED_TASK_RESULTS) {
        const firstKey = backgroundTaskResults.keys().next().value
        if (firstKey) backgroundTaskResults.delete(firstKey)
      }
      if (sessionID) {
        if (!closingSessions.has(sessionID)) {
          const parentSessionID = metadata?.session_id
          Bus.publish(BackgroundTaskEvent.Failed, {
            taskID: id,
            sessionID,
            parentSessionID,
            error: sanitizeError(error),
          })
        }
      } else {
        Bus.publish(BackgroundTaskEvent.Failed, { taskID: id, error: sanitizeError(error) })
      }
    } finally {
      pendingBackgroundTasks.delete(id)
      pendingTaskMetadata.delete(id)
      subagentSessionIDs.delete(id)

      if (metadata?.release_slot) {
        try {
          metadata.release_slot()
        } catch (e) {
          log.warn("failed to release task slot", { error: e instanceof Error ? e.message : String(e) })
        }
      }
    }
  }

  export function getInternalState() {
    return {
      cancelledTasks: new Set(cancelledTasks),
      closingSessions: new Set(closingSessions),
    }
  }

  export function getBackgroundTaskResult(id: string): BackgroundTaskResult | undefined {
    return backgroundTaskResults.get(id)
  }

  export function setBackgroundTaskResult(id: string, result: string): void {
    const stored = backgroundTaskResults.get(id)
    if (stored) stored.result = result
  }

  export function listBackgroundTasks() {
    return {
      pending: Array.from(pendingBackgroundTasks.keys()),
      results: Object.fromEntries(backgroundTaskResults),
    }
  }

  export function getBackgroundTaskMetadata(id: string): TaskMetadata | undefined {
    return pendingTaskMetadata.get(id)
  }

  export function getAndClearCompletedTasks(sessionID: string): BackgroundTaskResult[] {
    const completedTasks: BackgroundTaskResult[] = []

    for (const [id, result] of backgroundTaskResults.entries()) {
      const isFromSession = result.metadata?.session_id === sessionID
      const isCompletedOrFailed = result.status === "completed" || result.status === "failed"

      if (!isCompletedOrFailed || !isFromSession) {
        continue
      }

      const alreadyDelivered = deliveredTaskResults.has(id)
      if (alreadyDelivered) {
        continue
      }

      deliveredTaskResults.add(id)
      completedTasks.push(result)

      if (deliveredTaskResults.size > MAX_DELIVERED_RESULTS) {
        const firstItem = deliveredTaskResults.values().next().value
        if (firstItem) deliveredTaskResults.delete(firstItem)
      }
    }

    return completedTasks
  }

  export function formatCompletedTasksForInjection(tasks: BackgroundTaskResult[]): string {
    if (tasks.length === 0) return ""

    const lines: string[] = ["[System: Background tasks completed]", ""]

    for (const task of tasks) {
      const agent = (task.metadata?.agent_type ?? "unknown-agent")
        .replace(/[<>\[\]{}]/g, "")
        .slice(0, MAX_AGENT_DESCRIPTION_LENGTH)
      const description = (task.metadata?.description ?? "No description")
        .replace(/[<>\[\]{}]/g, "")
        .slice(0, MAX_AGENT_DESCRIPTION_LENGTH)

      lines.push(`Task ${task.id} (@${agent})`)

      if (task.status === "completed") {
        const duration = Math.round((task.time.completed - task.time.started) / SECONDS_TO_MS_MULTIPLIER)
        lines.push(`  Status: Completed (${duration}s)`)

        if (task.result) {
          const cleanedResult = task.result.replace(/[<>\[\]{}]/g, "").slice(0, MAX_TASK_RESULT_LENGTH)
          lines.push(`  Result: ${cleanedResult}`)
        }
      }

      if (task.status === "failed") {
        lines.push(`  Status: Failed`)
        const error = task.error ?? "Unknown error"

        const sanitizedError = sanitizeError(error)

        lines.push(`  Error: ${sanitizedError}`)
      }

      lines.push(`  ${description}`)
      lines.push("")
    }

    return lines.join("\n")
  }

  const autoWakeupSubscribers = new Map<string, () => void>()

  export function hasUndeliveredCompletedTasks(sessionID: string): boolean {
    for (const [id, result] of backgroundTaskResults.entries()) {
      const isFromSession = result.metadata?.session_id === sessionID
      const isCompletedOrFailed = result.status === "completed" || result.status === "failed"
      const alreadyDelivered = deliveredTaskResults.has(id)

      if (isFromSession && isCompletedOrFailed && !alreadyDelivered) {
        return true
      }
    }
    return false
  }

  export function isClosing(sessionID: string): boolean {
    return closingSessions.has(sessionID)
  }

  const wakeupInProgress = new Set<string>()

  async function getLastUserAgent(sessionID: string): Promise<string | undefined> {
    // Collect all user messages since stream() returns oldest-first
    // We need the MOST RECENT user message, not the first one found
    let lastAgent: string | undefined
    for await (const msg of MessageV2.stream(sessionID)) {
      if (msg.info.role === "user" && msg.info.agent) {
        lastAgent = msg.info.agent
      }
    }
    return lastAgent
  }

  export function enableAutoWakeup(sessionID: string): void {
    if (closingSessions.has(sessionID)) {
      return
    }
    if (autoWakeupSubscribers.has(sessionID)) {
      return
    }

    const triggerWakeup = async () => {
      if (wakeupInProgress.has(sessionID)) {
        return
      }
      if (closingSessions.has(sessionID)) {
        return
      }

      // Don't clear tasks here - let prompt() do it
      // prompt() already calls getAndClearCompletedTasks() internally
      // This ensures completed tasks are formatted and injected correctly
      if (!hasUndeliveredCompletedTasks(sessionID)) {
        return
      }

      wakeupInProgress.add(sessionID)
      const lastUserAgent = await getLastUserAgent(sessionID)
      const agent = lastUserAgent ?? (await Agent.defaultAgent())
      BackgroundTasks.spawn(
        SessionPrompt.prompt({
          sessionID,
          agent,
          parts: [], // Empty parts - prompt() will inject completed tasks
        }).finally(() => {
          wakeupInProgress.delete(sessionID)
          // After prompt completes, check if there are MORE undelivered tasks
          // (tasks that completed while we were processing)
          if (hasUndeliveredCompletedTasks(sessionID)) {
            triggerWakeup() // Trigger again to handle remaining tasks
          }
        }),
      )
    }

    const handler = (event: { properties: { parentSessionID?: string } }) => {
      if (event.properties.parentSessionID !== sessionID) {
        return
      }
      triggerWakeup().catch((error) => {
        log.error("auto-wakeup failed", { sessionID, error: error instanceof Error ? error.message : String(error) })
      })
    }

    const unsub1 = Bus.subscribe(BackgroundTaskEvent.Completed, handler)
    const unsub2 = Bus.subscribe(BackgroundTaskEvent.Failed, handler)

    const unsub = () => {
      unsub1()
      unsub2()
    }

    autoWakeupSubscribers.set(sessionID, unsub)
    // triggerWakeup() // Removed: redundant immediate call
  }

  export function disableAutoWakeup(sessionID: string): void {
    const unsub = autoWakeupSubscribers.get(sessionID)
    if (!unsub) return
    unsub()
    autoWakeupSubscribers.delete(sessionID)
    wakeupInProgress.delete(sessionID)
  }

  export function cancelBackgroundTask(id: string): boolean {
    const task = pendingBackgroundTasks.get(id)
    if (!task) return false

    const metadata = pendingTaskMetadata.get(id)
    const startTime = metadata?.start_time ?? Date.now()

    // Release slot BEFORE deleting metadata to prevent permanent slot leak
    if (metadata?.release_slot) {
      try {
        metadata.release_slot()
      } catch (e) {
        log.warn("failed to release slot during cancellation", { error: e instanceof Error ? e.message : String(e) })
      }
    }

    cancelledTasks.add(id)
    pendingBackgroundTasks.delete(id)
    pendingTaskMetadata.delete(id)

    const result: BackgroundTaskResult = {
      id,
      status: "failed",
      error: "Task was cancelled",
      time: { started: startTime, completed: Date.now() },
      metadata,
      cancelled: true,
    }

    const existing = backgroundTaskResults.get(id)
    if (existing) {
      existing.status = "failed"
      existing.error = "Task was cancelled"
      existing.cancelled = true
      existing.time.completed = Date.now()
    } else {
      backgroundTaskResults.set(id, result)
      if (backgroundTaskResults.size > MAX_STORED_TASK_RESULTS) {
        const firstKey = backgroundTaskResults.keys().next().value
        if (firstKey) backgroundTaskResults.delete(firstKey)
      }
    }

    const subagentSessionID = subagentSessionIDs.get(id)
    if (subagentSessionID) {
      SessionPrompt.cancel(subagentSessionID)
    }
    subagentSessionIDs.delete(id)

    return true
  }

  export function tryCancel(taskId: string): {
    status: "cancelled" | "not_found" | "already_completed"
    message?: string
  } {
    const result = backgroundTaskResults.get(taskId)
    if (!result) {
      return {
        status: "not_found",
        message: `Task ${taskId} not found`,
      }
    }

    if (result.status !== "running") {
      return {
        status: "already_completed",
        message: `Task ${taskId} is ${result.status} and cannot be cancelled`,
      }
    }

    const cancelled = cancelBackgroundTask(taskId)
    if (cancelled) {
      return {
        status: "cancelled",
        message: `Task ${taskId} has been cancelled`,
      }
    }

    return {
      status: "not_found",
      message: `Task ${taskId} could not be cancelled`,
    }
  }

  async function waitForBackgroundTasks(): Promise<void> {
    const tasks = Array.from(pendingBackgroundTasks.values())
    if (tasks.length === 0) return
    await Promise.all(tasks)
  }

  function createDefaultTitle(isChild = false) {
    return (isChild ? childTitlePrefix : parentTitlePrefix) + new Date().toISOString()
  }

  export function isDefaultTitle(title: string) {
    return new RegExp(
      `^(${parentTitlePrefix}|${childTitlePrefix})\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$`,
    ).test(title)
  }

  export const Info = z
    .object({
      id: Identifier.schema("session"),
      slug: z.string(),
      projectID: z.string(),
      directory: z.string(),
      parentID: Identifier.schema("session").optional(),
      summary: z
        .object({
          additions: z.number(),
          deletions: z.number(),
          files: z.number(),
          diffs: Snapshot.FileDiff.array().optional(),
        })
        .optional(),
      share: z
        .object({
          url: z.string(),
        })
        .optional(),
      title: z.string(),
      version: z.string(),
      time: z.object({
        created: z.number(),
        updated: z.number(),
        compacting: z.number().optional(),
        archived: z.number().optional(),
      }),
      permission: PermissionNext.Ruleset.optional(),
      revert: z
        .object({
          messageID: z.string(),
          partID: z.string().optional(),
          snapshot: z.string().optional(),
          diff: z.string().optional(),
        })
        .optional(),
    })
    .meta({
      ref: "Session",
    })
  export type Info = z.output<typeof Info>

  export const ShareInfo = z
    .object({
      secret: z.string(),
      url: z.string(),
    })
    .meta({
      ref: "SessionShare",
    })
  export type ShareInfo = z.output<typeof ShareInfo>

  export const Event = {
    Created: BusEvent.define(
      "session.created",
      z.object({
        info: Info,
      }),
    ),
    Updated: BusEvent.define(
      "session.updated",
      z.object({
        info: Info,
      }),
    ),
    Deleted: BusEvent.define(
      "session.deleted",
      z.object({
        info: Info,
      }),
    ),
    Diff: BusEvent.define(
      "session.diff",
      z.object({
        sessionID: z.string(),
        diff: Snapshot.FileDiff.array(),
      }),
    ),
    Error: BusEvent.define(
      "session.error",
      z.object({
        sessionID: z.string().optional(),
        error: MessageV2.Assistant.shape.error,
      }),
    ),
  }

  export const create = fn(
    z
      .object({
        parentID: Identifier.schema("session").optional(),
        title: z.string().optional(),
        permission: Info.shape.permission,
      })
      .optional(),
    async (input) => {
      return createNext({
        parentID: input?.parentID,
        directory: Instance.directory,
        title: input?.title,
        permission: input?.permission,
      })
    },
  )

  export const fork = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message").optional(),
    }),
    async (input) => {
      const session = await createNext({
        directory: Instance.directory,
      })
      const msgs = await messages({ sessionID: input.sessionID })
      const idMap = new Map<string, string>()

      for (const msg of msgs) {
        if (input.messageID && msg.info.id >= input.messageID) break
        const newID = Identifier.ascending("message")
        idMap.set(msg.info.id, newID)

        const parentID = msg.info.role === "assistant" && msg.info.parentID ? idMap.get(msg.info.parentID) : undefined
        const cloned = await updateMessage({
          ...msg.info,
          sessionID: session.id,
          id: newID,
          ...(parentID && { parentID }),
        })

        for (const part of msg.parts) {
          await updatePart({
            ...part,
            id: Identifier.ascending("part"),
            messageID: cloned.id,
            sessionID: session.id,
          })
        }
      }
      return session
    },
  )

  export const touch = fn(Identifier.schema("session"), async (sessionID) => {
    await update(sessionID, (draft) => {
      draft.time.updated = Date.now()
    })
  })

  export async function createNext(input: {
    id?: string
    title?: string
    parentID?: string
    directory: string
    permission?: PermissionNext.Ruleset
  }) {
    const result: Info = {
      id: Identifier.descending("session", input.id),
      slug: Slug.create(),
      version: Installation.VERSION,
      projectID: Instance.project.id,
      directory: input.directory,
      parentID: input.parentID,
      title: input.title ?? createDefaultTitle(!!input.parentID),
      permission: input.permission,
      time: {
        created: Date.now(),
        updated: Date.now(),
      },
    }
    log.info("created", result)
    await Storage.write(["session", Instance.project.id, result.id], result)
    Bus.publish(Event.Created, {
      info: result,
    })
    const cfg = await Config.get()
    if (!result.parentID && (Flag.OPENCODE_AUTO_SHARE || cfg.share === "auto")) {
      trackBackgroundTask(
        `share-${result.id}`,
        share(result.id).then((shareValue) => {
          update(result.id, (draft) => {
            draft.share = shareValue
          })
        }),
        result.id,
      )
    }
    Bus.publish(Event.Updated, {
      info: result,
    })
    return result
  }

  export function plan(input: { slug: string; time: { created: number } }) {
    const base = Instance.project.vcs
      ? path.join(Instance.worktree, ".opencode", "plans")
      : path.join(Global.Path.data, "plans")
    return path.join(base, [input.time.created, input.slug].join("-") + ".md")
  }

  export const get = fn(Identifier.schema("session"), async (id) => {
    const read = await Storage.read<Info>(["session", Instance.project.id, id])
    return read as Info
  })

  export const getShare = fn(Identifier.schema("session"), async (id) => {
    return Storage.read<ShareInfo>(["share", id])
  })

  export const share = fn(Identifier.schema("session"), async (id) => {
    const cfg = await Config.get()
    if (cfg.share === "disabled") {
      throw new Error("Sharing is disabled in configuration")
    }
    const { ShareNext } = await import("@/share/share-next")
    const share = await ShareNext.create(id)
    await update(
      id,
      (draft) => {
        draft.share = {
          url: share.url,
        }
      },
      { touch: false },
    )
    return share
  })

  export const unshare = fn(Identifier.schema("session"), async (id) => {
    const { ShareNext } = await import("@/share/share-next")
    await ShareNext.remove(id)
    await update(
      id,
      (draft) => {
        draft.share = undefined
      },
      { touch: false },
    )
  })

  export async function update(id: string, editor: (session: Info) => void, options?: { touch?: boolean }) {
    const project = Instance.project
    const result = await Storage.update<Info>(["session", project.id, id], (draft) => {
      editor(draft)
      if (options?.touch !== false) {
        draft.time.updated = Date.now()
      }
    })
    Bus.publish(Event.Updated, {
      info: result,
    })
    return result
  }

  export const diff = fn(Identifier.schema("session"), async (sessionID) => {
    const diffs = await Storage.read<Snapshot.FileDiff[]>(["session_diff", sessionID])
    return diffs ?? []
  })

  export const messages = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      limit: z.number().optional(),
    }),
    async (input) => {
      const result = [] as MessageV2.WithParts[]
      for await (const msg of MessageV2.stream(input.sessionID)) {
        if (input.limit && result.length >= input.limit) break
        result.push(msg)
      }
      result.reverse()
      return result
    },
  )

  export async function* list() {
    const project = Instance.project
    for (const item of await Storage.list(["session", project.id])) {
      yield Storage.read<Info>(item)
    }
  }

  export const children = fn(Identifier.schema("session"), async (parentID) => {
    const project = Instance.project
    const result = [] as Session.Info[]
    for (const item of await Storage.list(["session", project.id])) {
      const session = await Storage.read<Info>(item)
      if (session.parentID !== parentID) continue
      result.push(session)
    }
    return result
  })

  export async function cleanupSessionMaps(sessionID: string): Promise<void> {
    disableAutoWakeup(sessionID)

    const { cleanupSessionTaskMaps } = await import("../tool/task")
    await cleanupSessionTaskMaps(sessionID)

    // Create snapshot of entries before iteration to avoid concurrent modification issues
    const pendingEntries = Array.from(pendingTaskMetadata.entries())

    for (const [id, metadata] of pendingEntries) {
      if (metadata.session_id === sessionID && metadata.release_slot) {
        try {
          metadata.release_slot()
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e)
          log.warn("failed to release task slot during cleanup", { task_id: id, session_id: sessionID, error })
        }
      }
    }

    reservedTaskSlots.delete(sessionID)

    const cancelNeeded = pendingEntries.some(([_, metadata]) => metadata.session_id === sessionID)

    if (cancelNeeded) {
      SessionPrompt.cancel(sessionID)
    }

    const resultEntries = Array.from(backgroundTaskResults.entries())
    for (const [id, result] of resultEntries) {
      if (result.metadata?.session_id === sessionID) {
        backgroundTaskResults.delete(id)
        deliveredTaskResults.delete(id)
        cancelledTasks.delete(id)
        subagentSessionIDs.delete(id)
      }
    }
  }

  export function cleanupAllTaskSlots(): void {
    for (const [sessionID] of reservedTaskSlots.entries()) {
      reservedTaskSlots.delete(sessionID)
      autoWakeupSubscribers.delete(sessionID)
    }
  }

  export const remove = fn(Identifier.schema("session"), async (sessionID) => {
    closingSessions.add(sessionID)
    disableAutoWakeup(sessionID)
    const project = Instance.project
    try {
      const session = await get(sessionID)

      for (const child of await children(sessionID)) {
        await remove(child.id)
      }

      await unshare(sessionID).catch(() => {})

      for (const msg of await Storage.list(["message", sessionID])) {
        for (const part of await Storage.list(["part", msg.at(-1)!])) {
          await Storage.remove(part)
        }
        await Storage.remove(msg)
      }

      await Storage.remove(["session", project.id, sessionID])
      SessionStatus.remove(sessionID)

      await cleanupSessionMaps(sessionID)

      // Remove from closingSessions after all cleanup is complete
      closingSessions.delete(sessionID)

      Bus.publish(Event.Deleted, {
        info: session,
      })
    } catch (e) {
      closingSessions.delete(sessionID)
      log.error(e)
    }
  })

  export const updateMessage = fn(MessageV2.Info, async (msg) => {
    await Storage.write(["message", msg.sessionID, msg.id], msg)
    Bus.publish(MessageV2.Event.Updated, {
      info: msg,
    })
    return msg
  })

  export const removeMessage = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      await Storage.remove(["message", input.sessionID, input.messageID])
      Bus.publish(MessageV2.Event.Removed, {
        sessionID: input.sessionID,
        messageID: input.messageID,
      })
      return input.messageID
    },
  )

  export const removePart = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      messageID: Identifier.schema("message"),
      partID: Identifier.schema("part"),
    }),
    async (input) => {
      await Storage.remove(["part", input.messageID, input.partID])
      Bus.publish(MessageV2.Event.PartRemoved, {
        sessionID: input.sessionID,
        messageID: input.messageID,
        partID: input.partID,
      })
      return input.partID
    },
  )

  const UpdatePartInput = z.union([
    MessageV2.Part,
    z.object({
      part: MessageV2.TextPart,
      delta: z.string(),
    }),
    z.object({
      part: MessageV2.ReasoningPart,
      delta: z.string(),
    }),
  ])

  export const updatePart = fn(UpdatePartInput, async (input) => {
    const part = "delta" in input ? input.part : input
    const delta = "delta" in input ? input.delta : undefined
    await Storage.write(["part", part.messageID, part.id], part)
    Bus.publish(MessageV2.Event.PartUpdated, {
      part,
      delta,
    })
    return part
  })

  export const getUsage = fn(
    z.object({
      model: z.custom<Provider.Model>(),
      usage: z.custom<LanguageModelUsage>(),
      metadata: z.custom<ProviderMetadata>().optional(),
    }),
    (input) => {
      const cachedInputTokens = input.usage.cachedInputTokens ?? 0
      const excludesCachedTokens = !!(input.metadata?.["anthropic"] || input.metadata?.["bedrock"])
      const adjustedInputTokens = excludesCachedTokens
        ? (input.usage.inputTokens ?? 0)
        : (input.usage.inputTokens ?? 0) - cachedInputTokens
      const safe = (value: number) => {
        if (!Number.isFinite(value)) return 0
        return value
      }

      const tokens = {
        input: safe(adjustedInputTokens),
        output: safe(input.usage.outputTokens ?? 0),
        reasoning: safe(input.usage?.reasoningTokens ?? 0),
        cache: {
          write: safe(
            (input.metadata?.["anthropic"]?.["cacheCreationInputTokens"] ??
              // @ts-expect-error
              input.metadata?.["bedrock"]?.["usage"]?.["cacheWriteInputTokens"] ??
              0) as number,
          ),
          read: safe(cachedInputTokens),
        },
      }

      const costInfo =
        input.model.cost?.experimentalOver200K && tokens.input + tokens.cache.read > 200_000
          ? input.model.cost.experimentalOver200K
          : input.model.cost
      return {
        cost: safe(
          new Decimal(0)
            .add(new Decimal(tokens.input).mul(costInfo?.input ?? 0).div(1_000_000))
            .add(new Decimal(tokens.output).mul(costInfo?.output ?? 0).div(1_000_000))
            .add(new Decimal(tokens.cache.read).mul(costInfo?.cache?.read ?? 0).div(1_000_000))
            .add(new Decimal(tokens.cache.write).mul(costInfo?.cache?.write ?? 0).div(1_000_000))
            .add(new Decimal(tokens.reasoning).mul(costInfo?.output ?? 0).div(1_000_000))
            .toNumber(),
        ),
        tokens,
      }
    },
  )

  export class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`)
    }
  }

  export const initialize = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      modelID: z.string(),
      providerID: z.string(),
      messageID: Identifier.schema("message"),
    }),
    async (input) => {
      await SessionPrompt.command({
        sessionID: input.sessionID,
        messageID: input.messageID,
        model: input.providerID + "/" + input.modelID,
        command: Command.Default.INIT,
        arguments: "",
      })
    },
  )
}
