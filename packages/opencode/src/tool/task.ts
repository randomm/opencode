import { Tool } from "./tool"
import DESCRIPTION from "./task.txt"
import z from "zod"
import { Bus } from "../bus"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Agent } from "../agent/agent"
import { Session } from "../session"
import {
  type TaskMetadata,
  getSessionTaskCount,
  reserveTaskSlot,
  trackBackgroundTask,
  enableAutoWakeup,
  disableAutoWakeup,
} from "../session/async-tasks"
import { SessionPrompt } from "../session/prompt"
import { iife } from "@/util/iife"
import { defer } from "@/util/defer"
import { Config } from "../config/config"
import { PermissionNext } from "@/permission/next"
import { Wildcard } from "@/util/wildcard"
import { Log } from "@/util/log"

const parameters = z.object({
  description: z.string().describe("A short (3-5 words) description of the task"),
  prompt: z.string().describe("The task for the agent to perform"),
  subagent_type: z.string().describe("The type of specialized agent to use for this task"),
  session_id: z.string().describe("Existing Task session to continue").optional(),
  command: z.string().describe("The command that triggered this task").optional(),
  sync: z.boolean().describe("Execute synchronously and wait for result").optional(),
})

const MAX_CONCURRENT_TASKS_PER_SESSION = 5

type LockCallback = (release: () => void) => void
interface LockState {
  locked: boolean
  queue: LockCallback[]
}

const sessionLocks = new Map<string, LockState>()

async function acquireLock(sessionID: string): Promise<() => void> {
  let lock = sessionLocks.get(sessionID)

  if (!lock) {
    lock = { locked: true, queue: [] }
    sessionLocks.set(sessionID, lock)
    return () => releaseLock(sessionID)
  }

  if (!lock.locked) {
    lock.locked = true
    return () => releaseLock(sessionID)
  }

  return new Promise((resolve) => {
    const callback: LockCallback = (release: () => void) => resolve(release)
    lock.queue.push(callback)
  })
}

function releaseLock(sessionID: string): void {
  const lock = sessionLocks.get(sessionID)
  if (!lock) return

  const next = lock.queue.shift()
  if (next) {
    lock.locked = true
    next(() => releaseLock(sessionID))
  } else {
    lock.locked = false
    sessionLocks.delete(sessionID)
  }
}

export async function tryIncrementSessionCount(
  sessionID: string,
): Promise<{ allowed: boolean; releaseSlot?: () => void }> {
  const release = await acquireLock(sessionID)

  try {
    const current = getSessionTaskCount(sessionID)
    if (current >= MAX_CONCURRENT_TASKS_PER_SESSION) return { allowed: false }

    const releaseSlot = reserveTaskSlot(sessionID)

    const afterReserve = getSessionTaskCount(sessionID)
    if (afterReserve > MAX_CONCURRENT_TASKS_PER_SESSION) {
      releaseSlot()
      return { allowed: false }
    }

    return { allowed: true, releaseSlot }
  } finally {
    release()
  }
}

export async function cleanupSessionTaskMaps(sessionID: string): Promise<void> {
  const lock = sessionLocks.get(sessionID)

  if (lock) {
    for (const waiter of lock.queue) {
      waiter(() => {})
    }
  }

  sessionLocks.delete(sessionID)
}

export const TaskTool = Tool.define("task", async (initCtx) => {
  const agents = await Agent.list().then((x) => x.filter((a) => a.mode !== "primary"))

  const description = DESCRIPTION.replace(
    "{agents}",
    agents
      .map((a) => `- ${a.name}: ${a.description ?? "This subagent should only be called manually by the user."}`)
      .join("\n"),
  )

  type TaskResultMetadata = {
    sessionId?: string
    model?: { modelID: string; providerID: string }
    summary?: Array<{ id: string; tool: string; state: { status: string; title?: string } }>
  }

  return {
    description,
    parameters,
    async execute(params: z.infer<typeof parameters>, ctx) {
      const config = await Config.get()

      const result = await tryIncrementSessionCount(ctx.sessionID)
      if (!result.allowed) {
        return {
          title: params.description,
          output: JSON.stringify({
            task_id: null,
            status: "error",
            message: `Cannot spawn task: exceeded concurrent task limit (${MAX_CONCURRENT_TASKS_PER_SESSION}). Wait for existing tasks to complete or cancel them.`,
          }),
          metadata: {} as TaskResultMetadata,
        }
      }

      const agent = await Agent.get(params.subagent_type)
      if (!agent) throw new Error(`Unknown agent type: ${params.subagent_type} is not a valid agent type`)

      // FIRST: Check explicit agent-specific permissions from caller's config (BEFORE ctx.ask)
      // This ensures agent config is authoritative and cannot be bypassed by "Always Allow" prompts
      const callerAgent = ctx.agent ? await Agent.get(ctx.agent) : null

      // Safety: If caller agent ID is specified but agent not found, default deny for security
      if (ctx.agent && !callerAgent) {
        Log.create({ service: "task-permission" }).warn("Caller agent not found", {
          ctx_agent: ctx.agent,
          subagent_requested: agent.name,
        })
        if (result.releaseSlot) {
          result.releaseSlot()
        }
        return {
          title: params.description,
          output: JSON.stringify({
            task_id: null,
            status: "error",
            message: `Permission denied: Caller agent '${ctx.agent}' not found or misconfigured`,
          }),
          metadata: {} as TaskResultMetadata,
        }
      }

      const callerTaskPermissions = callerAgent?.permission?.filter((p) => p.permission === "task") || []

      // Debug logging for permission decision
      Log.create({ service: "task-permission" }).debug("Task permission check", {
        ctx_agent: ctx.agent,
        caller_agent: callerAgent?.name,
        subagent_requested: agent.name,
        caller_permissions_count: callerTaskPermissions.length,
      })

      // Evaluate if caller can spawn requested agent
      let canSpawn = false
      if (callerTaskPermissions.length === 0) {
        // No task permissions defined - allow all (backward compatibility)
        // This allows agents without explicit task permission config to spawn any agent,
        // matching behavior before permission system was introduced.
        canSpawn = true
      } else {
        // Check permissions in order, last matching wins
        // Only explicit "deny" blocks spawning; "allow" and "ask" both permit proceeding.
        // For "ask" action: the config allows potential spawning, but ctx.ask() will prompt user.
        // This agent config check is authoritative - "ask" and "allow" cannot be bypassed.
        for (const rule of callerTaskPermissions) {
          if (Wildcard.match(agent.name, rule.pattern)) {
            canSpawn = rule.action !== "deny"
          }
        }
      }

      if (!canSpawn) {
        Log.create({ service: "task-permission" }).debug("Task permission denied", {
          caller_agent: callerAgent?.name,
          subagent_requested: agent.name,
          reason: "explicit_config_deny",
        })
        if (result.releaseSlot) {
          result.releaseSlot()
        }
        return {
          title: params.description,
          output: JSON.stringify({
            task_id: null,
            status: "error",
            message: `Permission denied: Agent '${agent.name}' not permitted for your role`,
          }),
          metadata: {} as TaskResultMetadata,
        }
      }

      // SECOND: Ask user for confirmation only if agent config allows
      // ctx.ask() can only expand permissions, never restrict them
      if (!ctx.extra?.bypassAgentCheck) {
        await ctx.ask({
          permission: "task",
          patterns: [params.subagent_type],
          always: ["*"],
          metadata: {
            description: params.description,
            subagent_type: params.subagent_type,
          },
        })
      }

      const hasTaskPermission = agent.permission.some((rule) => rule.permission === "task")

      const taskId = Identifier.ascending("task")
      const startTime = Date.now()
      let slotReleased = false

      const session = await iife(async () => {
        if (params.session_id) {
          const found = await Session.get(params.session_id).catch(() => {})
          if (found) return found
        }

        const parentSession = await Session.get(ctx.sessionID).catch(() => null)
        if (!parentSession?.directory) throw new Error("Parent session not found or has no directory")

        // Load the child agent's OWN permissions - each agent's config is authoritative
        const childAgentPermissions =
          agent.permission
            ?.filter((p) => p.permission === "task")
            .map((p) => ({
              permission: "task" as const,
              pattern: p.pattern,
              action: p.action === "ask" ? ("deny" as const) : p.action,
            })) ?? []

        return await Session.createNext({
          parentID: ctx.sessionID,
          directory: parentSession.directory,
          title: params.description + ` (@${agent.name} subagent)`,
          permission: [
            {
              permission: "todowrite",
              pattern: "*",
              action: "deny",
            },
            {
              permission: "todoread",
              pattern: "*",
              action: "deny",
            },
            ...childAgentPermissions,
            ...(hasTaskPermission
              ? []
              : [
                  {
                    permission: "task" as const,
                    pattern: "*" as const,
                    action: "deny" as const,
                  },
                ]),
            ...(config.experimental?.primary_tools?.map((t) => ({
              pattern: "*",
              action: "allow" as const,
              permission: t,
            })) ?? []),
          ],
        })
      }).catch((error) => {
        if (!slotReleased && result.releaseSlot) {
          result.releaseSlot()
          slotReleased = true
        }
        throw error
      })

      const msg = await MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
      if (msg.info.role !== "assistant") throw new Error("Not an assistant message")

      const model = agent.model ?? {
        modelID: msg.info.modelID,
        providerID: msg.info.providerID,
      }

      ctx.metadata({
        title: params.description,
        metadata: {
          sessionId: session.id,
          model,
        },
      })

      const messageID = Identifier.ascending("message")
      const currentParts = new Map<string, { id: string; tool: string; state: { status: string; title?: string } }>()
      const unsub = Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
        if (evt.properties.part.sessionID !== session.id) return
        if (evt.properties.part.messageID === messageID) return
        if (evt.properties.part.type !== "tool") return
        const part = evt.properties.part
        const updatedPart = {
          id: part.id,
          tool: part.tool,
          state: {
            status: part.state.status,
            title: part.state.status === "completed" ? part.state.title : undefined,
          },
        }
        const updatedParts = new Map(currentParts)
        updatedParts.set(part.id, updatedPart)
        currentParts.clear()
        updatedParts.forEach((v, k) => currentParts.set(k, v))
        ctx.metadata({
          title: params.description,
          metadata: {
            summary: Array.from(currentParts.values()).sort((a, b) => a.id.localeCompare(b.id)),
            sessionId: session.id,
            model,
          },
        })
      })

      if (ctx.abort.aborted) {
        unsub()
        if (!slotReleased && result.releaseSlot) {
          result.releaseSlot()
          slotReleased = true
        }
        return {
          title: params.description,
          output: JSON.stringify({
            task_id: taskId,
            status: "aborted",
            message: "Task aborted before start",
          }),
          metadata: { sessionId: session.id } as TaskResultMetadata,
        }
      }

      function cancel() {
        SessionPrompt.cancel(session.id)
      }
      ctx.abort.addEventListener("abort", cancel)
      using _ = defer(() => ctx.abort.removeEventListener("abort", cancel))
      const promptParts = await SessionPrompt.resolvePromptParts(params.prompt)

      const taskMetadata: TaskMetadata = {
        agent_type: agent.name,
        description: params.description,
        session_id: session.id,
        parent_session_id: ctx.sessionID,
        start_time: startTime,
        release_slot: result.releaseSlot,
      }

      const taskTimeoutMs = 10 * 60 * 1000
      const syncAbortController = new AbortController()
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          SessionPrompt.cancel(session.id)
          syncAbortController.abort()
          reject(new Error("Task timeout after 10 minutes"))
        }, taskTimeoutMs)
      })

      // Check for abort before sync execution to prevent race condition
      if (ctx.abort.aborted) {
        unsub()
        if (!slotReleased && result.releaseSlot) {
          result.releaseSlot()
          slotReleased = true
        }
        return {
          title: params.description,
          output: JSON.stringify({
            task_id: taskId,
            status: "aborted",
            message: "Task aborted before execution",
          }),
          metadata: { sessionId: session.id } as TaskResultMetadata,
        }
      }

      // Sync mode: execute synchronously and return result directly
      if (params.sync) {
        try {
          const promptResult = await Promise.race([
            SessionPrompt.prompt({
              messageID,
              sessionID: session.id,
              model: {
                modelID: model.modelID,
                providerID: model.providerID,
              },
              agent: agent.name,
              tools: {
                todowrite: false,
                todoread: false,
                ...(hasTaskPermission ? {} : { task: false }),
                ...Object.fromEntries((config.experimental?.primary_tools ?? []).map((t) => [t, false])),
              },
              parts: promptParts,
            }),
            timeoutPromise,
          ])
          const textPart = promptResult.parts.find((p) => p.type === "text" && !p.synthetic)
          const textResult = textPart && "text" in textPart ? textPart.text : undefined
          if (result.releaseSlot) {
            result.releaseSlot()
            slotReleased = true
          }
          return {
            title: params.description,
            output: JSON.stringify({
              task_id: taskId,
              status: "completed",
              result: textResult,
            }),
            metadata: { sessionId: session.id } as TaskResultMetadata,
          }
        } catch (e) {
          if (!slotReleased && result.releaseSlot) {
            result.releaseSlot()
            slotReleased = true
          }
          const errorMessage = e instanceof Error ? e.message : String(e)
          return {
            title: params.description,
            output: JSON.stringify({
              task_id: taskId,
              status: "failed",
              error: errorMessage,
            }),
            metadata: { sessionId: session.id } as TaskResultMetadata,
          }
        } finally {
          unsub()
        }
      }

      // Async mode: spawn background task
      enableAutoWakeup(ctx.sessionID)

      try {
        trackBackgroundTask(
          taskId,
          (async () => {
            try {
              const promptResult = await SessionPrompt.prompt({
                messageID,
                sessionID: session.id,
                model: {
                  modelID: model.modelID,
                  providerID: model.providerID,
                },
                agent: agent.name,
                tools: {
                  todowrite: false,
                  todoread: false,
                  ...(hasTaskPermission ? {} : { task: false }),
                  ...Object.fromEntries((config.experimental?.primary_tools ?? []).map((t) => [t, false])),
                },
                parts: promptParts,
              })
              const textPart = promptResult.parts.find((p) => p.type === "text" && !p.synthetic)
              return textPart && "text" in textPart ? textPart.text : undefined
            } finally {
              unsub()
            }
          })(),
          ctx.sessionID,
          taskMetadata,
        )
      } catch (e) {
        disableAutoWakeup(ctx.sessionID)
        throw e
      }

      return {
        title: params.description,
        output: JSON.stringify({
          task_id: taskId,
          status: "started",
          message: `Task dispatched to @${agent.name}`,
        }),
        metadata: { sessionId: session.id } as TaskResultMetadata,
      }
    },
  }
})
