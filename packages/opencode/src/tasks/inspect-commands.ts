import { Store } from "./store"
import { Log } from "../util/log"
import { SessionPrompt } from "../session/prompt"
import { Worktree } from "../worktree"
import { sanitizeWorktree } from "./pulse-scheduler"
import { Locale } from "../util/locale"
import type { Task } from "./types"

const log = Log.create({ service: "taskctl.tool.inspect-commands" })

export function formatElapsed(ms: number): string {
  return Locale.duration(ms)
}

export async function executeInspect(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (!params.taskId) throw new Error("inspect requires taskId")

  const task = await Store.getTask(projectId, params.taskId)
  if (!task) throw new Error(`Task not found: ${params.taskId}`)

  const lines: string[] = [
    `Task: ${task.id}`,
    `Status: ${task.status}${task.close_reason ? ` (${task.close_reason})` : ""}`,
    `Branch: ${task.branch ?? "none"}`,
    `Worktree: ${task.worktree ?? "none"}`,
    ``,
    `Pipeline:`,
    `  Stage: ${task.pipeline.stage}`,
    `  Attempt: ${task.pipeline.attempt}`,
    `  Last activity: ${task.pipeline.last_activity ?? "never"}`,
    `  Last steering: ${task.pipeline.last_steering ?? "never"}`,
  ]

  if (task.pipeline.history && task.pipeline.history.length > 0) {
    lines.push(``, `Pipeline history:`)
    for (let i = 0; i < task.pipeline.history.length; i++) {
      const entry = task.pipeline.history[i]
      const next = task.pipeline.history[i + 1]
      const endMs = next ? new Date(next.timestamp).getTime() : Date.now()
      const durationMs = endMs - new Date(entry.timestamp).getTime()
      const duration = formatElapsed(durationMs)
      const label = entry.message ? ` (${entry.message})` : ""
      lines.push(`  ${entry.from}->${entry.to} [attempt ${entry.attempt}]: ${duration}${label}`)
    }
  }

  if (task.pipeline.adversarial_verdict) {
    const v = task.pipeline.adversarial_verdict
    lines.push(``, `Last adversarial verdict:`, `  ${v.verdict}`)
    if (v.summary) lines.push(`  Summary: ${v.summary}`)
    if (v.issues.length > 0) {
      lines.push(`  Issues:`)
      for (const issue of v.issues) {
        lines.push(`    - ${issue.location} [${issue.severity}]: ${issue.fix}`)
      }
    }
  }

  if (task.comments.length > 0) {
    lines.push(``, `Comments (${task.comments.length} total):`)
    for (const comment of task.comments) {
      lines.push(`  [${comment.author}] ${comment.message}`)
    }
  }

  return {
    title: `Task inspect: ${task.id}`,
    output: lines.join("\n"),
    metadata: {},
  }
}

export async function executeOverride(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (!params.taskId) throw new Error("override requires taskId")
  if (!params.overrideMode) throw new Error("override requires --skip or --commit-as-is")

  const task = await Store.getTask(projectId, params.taskId)
  if (!task) throw new Error(`Task not found: ${params.taskId}`)

  const validStates = ["failed", "in_progress", "review", "blocked_on_conflict"]
  if (!validStates.includes(task.status)) {
    throw new Error(`override requires task in state: ${validStates.join(", ")}. Current: ${task.status}`)
  }

  if (params.overrideMode === "skip") {
    if (task.assignee) {
      try {
        SessionPrompt.cancel(task.assignee)
      } catch {}
    }

    if (task.worktree) {
      const safeWorktree = sanitizeWorktree(task.worktree)
      if (safeWorktree) {
        await Worktree.remove({ directory: safeWorktree }).catch((e) =>
          log.error("failed to remove worktree in override --skip", { taskId: task.id, error: String(e) })
        )
      }
    }

    await Store.updateTask(projectId, params.taskId, {
      status: "closed",
      close_reason: "skipped by PM",
      worktree: null,
      branch: null,
      assignee: null,
      assignee_pid: null,
      pipeline: { ...task.pipeline, stage: "done" },
    }, true)

    await Store.addComment(projectId, params.taskId, {
      author: "system",
      message: "Skipped by PM override. Dependent tasks are now unblocked.",
      created_at: new Date().toISOString(),
    })

    return {
      title: "Task skipped",
      output: `Task ${params.taskId} skipped. Dependent tasks are now unblocked. Pulse will schedule them on next tick.`,
      metadata: {},
    }
  }

  if (!task.worktree) {
    throw new Error(`Task ${params.taskId} has no worktree to commit`)
  }

  return {
    title: "Commit as-is",
    output: `To commit worktree for task ${params.taskId}:\n1. @ops: cd ${task.worktree} && git add -A && git commit -m "feat(taskctl): ${task.title} (#${task.parent_issue}) — committed as-is by PM"\n2. Then: taskctl override ${params.taskId} --skip (to close the task)`,
    metadata: {},
  }
}

export async function executeRetry(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (!params.taskId) throw new Error("retry requires taskId")

  const task = await Store.getTask(projectId, params.taskId)
  if (!task) throw new Error(`Task not found: ${params.taskId}`)

  if (task.assignee) {
    try {
      SessionPrompt.cancel(task.assignee)
    } catch {}
  }

  if (task.worktree) {
    const safeWorktree = sanitizeWorktree(task.worktree)
    if (safeWorktree) {
      await Worktree.remove({ directory: safeWorktree }).catch((e) =>
        log.error("failed to remove worktree in retry", { taskId: task.id, error: String(e) })
      )
    }
  }

  await Store.updateTask(projectId, params.taskId, {
    status: "open",
    assignee: null,
    assignee_pid: null,
    worktree: null,
    branch: null,
    pipeline: {
      ...task.pipeline,
      stage: "idle",
      attempt: 1,
      adversarial_verdict: null,
      last_activity: null,
    },
  }, true)

  await Store.addComment(projectId, params.taskId, {
    author: "system",
    message: `Retried by PM. Task reset to open. Pulse will reschedule on next tick.`,
    created_at: new Date().toISOString(),
  })

  return {
    title: "Task retried",
    output: `Task ${params.taskId} reset to open with fresh state. Pulse will reschedule it on next tick.`,
    metadata: {},
  }
}

export async function executeVerdict(projectId: string, params: any, ctx: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (ctx.agent !== "adversarial-pipeline") {
    throw new Error("verdict command can only be called by adversarial-pipeline agent")
  }

  const taskId = params.taskId!
  const verdict = params.verdict!
  if (!taskId) throw new Error("verdict requires taskId")
  if (!verdict) throw new Error("verdict requires verdict")

  const task = await Store.getTask(projectId, taskId)
  if (!task) throw new Error(`Task not found: ${taskId}`)

  const issues = params.verdictIssues ?? []
  const summary = params.verdictSummary ?? ""

  const verdictData = {
    verdict,
    summary,
    issues,
    created_at: new Date().toISOString(),
  }

  await Store.updateTask(projectId, taskId, {
    status: "review",
    pipeline: {
      ...task!.pipeline,
      adversarial_verdict: verdictData,
      stage: "reviewing",
    }
  }, true)

  await Store.addComment(projectId, taskId, {
    author: "adversarial-pipeline",
    message: `Verdict: ${verdict}${summary ? ` — ${summary}` : ""}`,
    created_at: new Date().toISOString(),
  })

  return {
    title: "Verdict recorded",
    output: `Recorded ${verdict} verdict for task ${taskId}`,
    metadata: {},
  }
}
