import { Tool } from "./tool"
import DESCRIPTION from "./check_task.txt"
import z from "zod"
import { Session } from "../session"
import { SessionStatus } from "../session/status"
import { MessageV2 } from "../session/message-v2"

type TaskStatus = "running" | "completed" | "failed" | "not_found"

interface TaskResult {
  task_id: string
  status: TaskStatus
  result?: string
  error?: string
  agent?: string
  description?: string
  duration_seconds?: number
  started_at?: string
  completed_at?: string
}

interface CheckTaskMetadata {
  status: TaskStatus
  taskId?: string
  sessionId?: string
}

function checkBackgroundTask(id: string): TaskResult | undefined {
  const tasks = Session.listBackgroundTasks()
  if (tasks.pending.includes(id)) {
    const result = Session.getBackgroundTaskResult(id)
    const metadata = Session.getBackgroundTaskMetadata(id) ?? result?.metadata
    const startTime = metadata?.start_time ?? result?.time.started ?? Date.now()

    return {
      task_id: id,
      status: "running",
      agent: metadata?.agent_type,
      description: metadata?.description,
      duration_seconds: Math.round((Date.now() - startTime) / 1000),
    }
  }
  const result = Session.getBackgroundTaskResult(id)
  if (!result) return undefined

  const metadata = result.metadata
  const duration = Math.round((result.time.completed - result.time.started) / 1000)

  const base = {
    task_id: id,
    status: result.status,
    agent: metadata?.agent_type,
    description: metadata?.description,
    duration_seconds: duration,
    started_at: new Date(result.time.started).toISOString(),
    completed_at: new Date(result.time.completed).toISOString(),
    result: result.result,
  }

  if (result.error) {
    return { ...base, error: result.error }
  }

  return base
}

async function checkSessionTask(id: string, callerSessionId?: string): Promise<TaskResult | undefined> {
  const session = await Promise.resolve()
    .then(() => Session.get(id))
    .catch(() => undefined)
  if (!session) return undefined

  if (callerSessionId) {
    const isOwnerOrParent = session.id === callerSessionId || session.parentID === callerSessionId
    if (!isOwnerOrParent) return undefined
  }

  const started = new Date(session.time.created).toISOString()
  const status = SessionStatus.get(id)

  if (status.type === "busy") {
    return {
      task_id: id,
      status: "running",
      started_at: started,
    }
  }

  if (status.type === "retry") {
    return {
      task_id: id,
      status: "failed",
      error: status.message,
      started_at: started,
      completed_at: new Date(session.time.updated).toISOString(),
    }
  }

  const messages = await Session.messages({ sessionID: id })
  const assistant = messages.find((msg) => msg.info.role === "assistant")
  const text = assistant?.parts.findLast((part): part is MessageV2.TextPart => part.type === "text")

  return {
    task_id: id,
    status: "completed",
    result: text?.text,
    started_at: started,
    completed_at: new Date(session.time.updated).toISOString(),
  }
}

export const CheckTaskTool = Tool.define<z.ZodObject<{ task_id: z.ZodString }>, CheckTaskMetadata>("check_task", {
  description: DESCRIPTION,
  parameters: z.object({
    task_id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .describe("The ID of the background task or session to check"),
  }),
  async execute(params, ctx) {
    const background = checkBackgroundTask(params.task_id)
    if (background) {
      return {
        title: `Check task: ${params.task_id}`,
        output: JSON.stringify(background, null, 2),
        metadata: {
          status: background.status,
          taskId: params.task_id,
        },
      }
    }

    const session = await checkSessionTask(params.task_id, ctx.sessionID)
    if (session) {
      return {
        title: `Check task: ${params.task_id}`,
        output: JSON.stringify(session, null, 2),
        metadata: {
          status: session.status,
          sessionId: params.task_id,
        },
      }
    }

    const notFound: TaskResult = {
      task_id: params.task_id,
      status: "not_found",
    }

    return {
      title: `Check task: ${params.task_id}`,
      output: JSON.stringify(notFound, null, 2),
      metadata: {
        status: "not_found",
      },
    }
  },
})
