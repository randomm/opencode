import { Tool } from "./tool"
import DESCRIPTION from "./task.txt"
import z from "zod"
import { Bus } from "../bus"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Agent } from "../agent/agent"
import { Session, type TaskMetadata, getSessionTaskCount, reserveTaskSlot } from "../session"
import { SessionPrompt } from "../session/prompt"
import { iife } from "@/util/iife"
import { defer } from "@/util/defer"
import { Config } from "../config/config"
import { PermissionNext } from "@/permission/next"

const parameters = z.object({
  description: z.string().describe("A short (3-5 words) description of the task"),
  prompt: z.string().describe("The task for the agent to perform"),
  subagent_type: z.string().describe("The type of specialized agent to use for this task"),
  session_id: z.string().describe("Existing Task session to continue").optional(),
  command: z.string().describe("The command that triggered this task").optional(),
})

const MAX_CONCURRENT_TASKS_PER_SESSION = 5

type LockCallback = (release: () => void) => void
interface LockState {
  locked: boolean
  queue: LockCallback[]
}

const sessionLocks = new Map<string, LockState>()
const releaseCallbacks = new Map<string, Array<() => void>>()

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

export async function tryIncrementSessionCount(sessionID: string): Promise<boolean> {
  const release = await acquireLock(sessionID)

  try {
    const current = getSessionTaskCount(sessionID)
    if (current >= MAX_CONCURRENT_TASKS_PER_SESSION) return false

    const releaseSlot = reserveTaskSlot(sessionID)

    const afterReserve = getSessionTaskCount(sessionID)
    if (afterReserve > MAX_CONCURRENT_TASKS_PER_SESSION) {
      releaseSlot()
      return false
    }

    const callbacks = releaseCallbacks.get(sessionID) ?? []
    callbacks.push(releaseSlot)
    releaseCallbacks.set(sessionID, callbacks)

    return true
  } finally {
    release()
  }
}

export async function decrementSessionCount(sessionID: string): Promise<void> {
  const release = await acquireLock(sessionID)

  try {
    const callbacks = releaseCallbacks.get(sessionID)
    if (!callbacks || callbacks.length === 0) return

    const releaseSlot = callbacks.shift()
    if (releaseSlot) releaseSlot()

    if (callbacks.length === 0) releaseCallbacks.delete(sessionID)
  } finally {
    release()
  }
}

export async function cleanupSessionTaskMaps(sessionID: string): Promise<void> {
  const lock = sessionLocks.get(sessionID)
  const callbacks = releaseCallbacks.get(sessionID)

  if (callbacks) {
    for (const callback of callbacks) callback()
  }

  releaseCallbacks.delete(sessionID)

  if (lock) {
    for (const waiter of lock.queue) {
      waiter(() => {})
    }
  }

  sessionLocks.delete(sessionID)
}

export const TaskTool = Tool.define("task", async (initCtx) => {
  const agents = await Agent.list().then((x) => x.filter((a) => a.mode !== "primary"))

  const caller = initCtx?.agent
  const accessibleAgents = caller
    ? agents.filter((a) => PermissionNext.evaluate("task", a.name, caller.permission).action !== "deny")
    : agents

  const description = DESCRIPTION.replace(
    "{agents}",
    accessibleAgents
      .map((a) => `- ${a.name}: ${a.description ?? "This subagent should only be called manually by the user."}`)
      .join("\n"),
  )

  type TaskResultMetadata = { sessionId?: string }

  return {
    description,
    parameters,
    async execute(params: z.infer<typeof parameters>, ctx) {
      const config = await Config.get()

      const allowed = await tryIncrementSessionCount(ctx.sessionID)
      if (!allowed) {
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

      const agent = await Agent.get(params.subagent_type)
      if (!agent) throw new Error(`Unknown agent type: ${params.subagent_type} is not a valid agent type`)

      const hasTaskPermission = agent.permission.some((rule) => rule.permission === "task")

      const taskId = Identifier.ascending("task")
      const startTime = Date.now()

      const session = await iife(async () => {
        if (params.session_id) {
          const found = await Session.get(params.session_id).catch(() => {})
          if (found) return found
        }

        return await Session.create({
          parentID: ctx.sessionID,
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
        await decrementSessionCount(ctx.sessionID)
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
        session_id: ctx.sessionID,
        start_time: startTime,
      }

      Session.enableAutoWakeup(ctx.sessionID)

      try {
        Session.trackBackgroundTask(
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
              await decrementSessionCount(ctx.sessionID)
            }
          })(),
          session.id,
          taskMetadata,
        )
      } catch (e) {
        Session.disableAutoWakeup(ctx.sessionID)
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
