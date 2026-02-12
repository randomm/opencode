import { Tool } from "./tool"
import DESCRIPTION from "./list_tasks.txt"
import z from "zod"
import { listBackgroundTasks, getBackgroundTaskResult, getBackgroundTaskMetadata } from "../session/async-tasks"

interface TaskInfo {
  task_id: string
  status: "running" | "completed" | "failed"
  agent?: string
  description?: string
  started_at?: string
  completed_at?: string
}

interface ListTasksResult {
  pending: TaskInfo[]
  completed: TaskInfo[]
  total_count: number
}

// Helper: Timestamp validation (>= 2000-01-01, sane range)
function isValidTimestamp(timestamp: number): boolean {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return false
  }
  const date = new Date(timestamp)
  return date.getFullYear() >= 2000 && date.getFullYear() <= 2100
}

export const ListTasksTool = Tool.define("list_tasks", {
  description: DESCRIPTION,
  parameters: z.object({
    limit: z.number().optional().describe("Maximum number of tasks to return (default: 50)"),
    include_completed: z.boolean().optional().describe("Include completed tasks (default: true)"),
  }),
  async execute(params, ctx) {
    // CRITICAL #1: Session ownership filtering - only return tasks owned by caller's session
    const callerSessionId = ctx.sessionID!

    const tasks = listBackgroundTasks()
    const limit = params.limit ?? 50

    // Filter and map pending tasks
    const pending: TaskInfo[] = []
    for (const id of tasks.pending.slice(0, limit)) {
      const metadata = getBackgroundTaskMetadata(id)
      const result = getBackgroundTaskResult(id)

      // Ownership check: filter to caller's session
      const ownedByCaller =
        metadata?.parent_session_id === callerSessionId || result?.metadata?.parent_session_id === callerSessionId

      if (!ownedByCaller) {
        continue
      }

      // CRITICAL #2: Timestamp validation before Date() calls
      let started_at: string | undefined
      if (metadata?.start_time && isValidTimestamp(metadata.start_time)) {
        started_at = new Date(metadata.start_time).toISOString()
      } else if (result?.time.started && isValidTimestamp(result.time.started)) {
        started_at = new Date(result.time.started).toISOString()
      }

      pending.push({
        task_id: id,
        status: "running",
        agent: metadata?.agent_type,
        description: metadata?.description,
        started_at,
      })

      if (pending.length >= limit) {
        break
      }
    }

    // Filter and map completed tasks
    const completed: TaskInfo[] = []
    if (params.include_completed !== false) {
      // CRITICAL #4: Clamp slice end to prevent negative values (limit=0 case)
      const completedLimit = Math.max(0, limit - pending.length)

      // CRITICAL #3: Guard against undefined values from Object.entries
      for (const [id, result] of Object.entries(tasks.results)) {
        if (!result) {
          continue
        }

        // Ownership check: only return tasks owned by caller's session
        if (result.metadata?.parent_session_id !== callerSessionId) {
          continue
        }

        // CRITICAL #5: Timestamp validation before Date() calls
        const has_valid_started = isValidTimestamp(result.time.started)
        const has_valid_completed = result.time.completed && isValidTimestamp(result.time.completed)

        completed.push({
          task_id: id,
          status: result.status,
          agent: result.metadata?.agent_type,
          description: result.metadata?.description,
          started_at: has_valid_started ? new Date(result.time.started).toISOString() : undefined,
          completed_at: has_valid_completed ? new Date(result.time.completed).toISOString() : undefined,
        })

        if (completed.length >= completedLimit) {
          break
        }
      }
    }

    const taskResult: ListTasksResult = {
      pending,
      completed,
      total_count: pending.length + completed.length,
    }

    return {
      title: `List tasks: ${taskResult.total_count} total`,
      output: JSON.stringify(taskResult, null, 2),
      metadata: {
        pending_count: pending.length,
        completed_count: completed.length,
      },
    }
  },
})
