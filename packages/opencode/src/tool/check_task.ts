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
    return {
      task_id: id,
      status: "running",
    }
  }
  const result = Session.getBackgroundTaskResult(id)
  if (!result) return undefined
  return {
    task_id: id,
    status: result.status,
    error: result.error,
    started_at: new Date(result.time.started).toISOString(),
    completed_at: new Date(result.time.completed).toISOString(),
  }
}

async function checkSessionTask(id: string): Promise<TaskResult | undefined> {
  const session = await Promise.resolve()
    .then(() => Session.get(id))
    .catch(() => undefined)
  if (!session) return undefined

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
    task_id: z.string().describe("The ID of the background task to check"),
  }),
  async execute(params) {
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

    const session = await checkSessionTask(params.task_id)
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
