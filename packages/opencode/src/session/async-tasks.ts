import z from "zod"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Log } from "@/util/log"
import { BackgroundTasks } from "@/util/tasks"
import { Agent } from "@/agent/agent"
import { MessageV2 } from "./message-v2"
import crypto from "crypto"

import type { SessionPrompt as SessionPromptType } from "./prompt"

// Lazy import to break circular dependency (prompt -> Session -> async-tasks -> prompt)
let _SessionPrompt: typeof SessionPromptType | undefined
async function getSessionPrompt() {
  if (!_SessionPrompt) {
    const mod = await import("./prompt")
    _SessionPrompt = mod.SessionPrompt
  }
  return _SessionPrompt
}

const log = Log.create({ service: "session.async-tasks" })

// ─── Types & Interfaces ────────────────────────────────────────────

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

// ─── Constants ─────────────────────────────────────────────────────

const MAX_STORED_TASK_RESULTS = 1000
const MAX_DELIVERED_RESULTS = 10000
const DEFAULT_TASK_TIMEOUT = 10 * 60 * 1000
const MAX_AGENT_DESCRIPTION_LENGTH = 200
const MAX_TASK_RESULT_LENGTH = 5000
const SECONDS_TO_MS_MULTIPLIER = 1000
const ERROR_TRUNCATION_SUFFIX_LENGTH = 50

// ─── Module-level State ────────────────────────────────────────────

const pendingBackgroundTasks = new Map<string, Promise<string | undefined | void>>()
const pendingTaskMetadata = new Map<string, TaskMetadata>()
const cancelledTasks = new Set<string>()
const reservedTaskSlots = new Map<string, Set<string>>()
const backgroundTaskResults = new Map<string, BackgroundTaskResult>()
const deliveredTaskResults = new Set<string>()
const closingSessions = new Set<string>()

// ─── Sanitization ──────────────────────────────────────────────────

export function sanitizeError(error: string): string {
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

// ─── Slot Management ───────────────────────────────────────────────

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

// ─── Events ────────────────────────────────────────────────────────

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

// ─── Core Task Tracking ────────────────────────────────────────────

export async function trackBackgroundTask(
  id: string,
  task: Promise<string | undefined | void>,
  sessionID?: string,
  metadata?: TaskMetadata,
  result?: string,
): Promise<void> {
  const started = metadata?.start_time ?? Date.now()

  // Single guard: reject all tasks for sessions that are closing
  if (sessionID && closingSessions.has(sessionID)) {
    log.warn("refused to track task for closing session", { task_id: id, session_id: sessionID })
    return
  }

  const existing = backgroundTaskResults.get(id)
  if (!existing) {
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

    if (metadata?.release_slot) {
      try {
        metadata.release_slot()
      } catch (e) {
        log.warn("failed to release task slot", { error: e instanceof Error ? e.message : String(e) })
      }
    }
  }
}

// ─── Result Access ─────────────────────────────────────────────────

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

export function getInternalState() {
  return {
    cancelledTasks: new Set(cancelledTasks),
    closingSessions: new Set(closingSessions),
  }
}

// ─── Closing State ─────────────────────────────────────────────────

export function isClosing(sessionID: string): boolean {
  return closingSessions.has(sessionID)
}

export function markClosing(sessionID: string): void {
  closingSessions.add(sessionID)
}

export function clearClosing(sessionID: string): void {
  closingSessions.delete(sessionID)
}

// ─── Completion Delivery ───────────────────────────────────────────

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

// ─── Auto-Wakeup System ───────────────────────────────────────────

const autoWakeupSubscribers = new Map<string, () => void>()
const wakeupInProgress = new Set<string>()

export async function getLastUserAgent(sessionID: string): Promise<string | undefined> {
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
    const SessionPrompt = await getSessionPrompt()
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

// ─── Cancel ────────────────────────────────────────────────────────

export async function cancelBackgroundTask(id: string): Promise<boolean> {
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

  const sessionID = metadata?.session_id
  if (sessionID) {
    const SessionPrompt = await getSessionPrompt()
    SessionPrompt.cancel(sessionID)
  }

  return true
}

// ─── Lifecycle / Cleanup ───────────────────────────────────────────

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
    const SessionPrompt = await getSessionPrompt()
    SessionPrompt.cancel(sessionID)
  }

  const resultEntries = Array.from(backgroundTaskResults.entries())
  for (const [id, result] of resultEntries) {
    if (result.metadata?.session_id === sessionID) {
      backgroundTaskResults.delete(id)
      deliveredTaskResults.delete(id)
      cancelledTasks.delete(id)
    }
  }
}

export function cleanupAllTaskSlots(): void {
  for (const [sessionID] of reservedTaskSlots.entries()) {
    reservedTaskSlots.delete(sessionID)
    autoWakeupSubscribers.delete(sessionID)
  }
}
