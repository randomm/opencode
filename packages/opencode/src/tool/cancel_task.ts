import { Tool } from "./tool"
import DESCRIPTION from "./cancel_task.txt"
import z from "zod"
import { Session } from "../session"

type CancellationStatus = "cancelled" | "not_found" | "already_completed"

interface CancelTaskResult {
  task_id: string
  status: CancellationStatus
  message?: string
}

interface CancelTaskMetadata {
  status: CancellationStatus
  taskId?: string
}

export const CancelTaskTool = Tool.define<z.ZodObject<{ task_id: z.ZodString }>, CancelTaskMetadata>("cancel_task", {
  description: DESCRIPTION,
  parameters: z.object({
    task_id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .describe("The ID of the background task to cancel"),
  }),
  async execute(params, ctx) {
    const result = Session.tryCancel(params.task_id)

    const response: CancelTaskResult = {
      task_id: params.task_id,
      status: result.status,
      message: result.message,
    }

    return {
      title: `Cancel task: ${params.task_id}`,
      output: JSON.stringify(response, null, 2),
      metadata: {
        status: result.status,
        taskId: params.task_id,
      },
    }
  },
})
