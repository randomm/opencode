import fs from "fs/promises"
import path from "path"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { SessionStatus } from "../session/status"
import { MessageV2 } from "../session/message-v2"
import { Worktree } from "../worktree"
import { Log } from "../util/log"
import { Bus } from "../bus"
import { BackgroundTaskEvent } from "../session/async-tasks"
import { Global } from "../global"
import { Identifier } from "../id/id"
import { Store } from "./store"
import type { Task, AdversarialVerdict } from "./types"
import { scheduleReadyTasks } from "./pulse-scheduler"
import { sanitizeWorktree } from "./pulse-scheduler"
import { isSessionActivelyRunning, lockFilePath } from "./pulse-scheduler"

// Allow 6 attempts to resolve minor test flakiness before escalating to PM
const MAX_ADVERSARIAL_ATTEMPTS = 6

const log = Log.create({ service: "taskctl.pulse.verdicts" })

export { MAX_ADVERSARIAL_ATTEMPTS }

async function notifyPM(pmSessionId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!text || text.length === 0) {
      return { ok: false, error: "Notification text cannot be empty" }
    }
    if (text.length > 10000) {
      return { ok: false, error: "Notification text exceeds maximum length (10000 chars)" }
    }

    const messageId = Identifier.ascending("message")
    const partId = Identifier.ascending("part")
    const now = Date.now()

    if (!pmSessionId || typeof pmSessionId !== "string" || pmSessionId.length < 5) {
      return { ok: false, error: "Invalid PM session ID format" }
    }

    const pmSession = await Session.get(pmSessionId).catch(() => null)
    if (!pmSession) {
      log.warn("PM session not found for notification", { pmSessionId })
      return { ok: false, error: "PM session not found" }
    }

    let lastMsg: MessageV2.WithParts | null = null
    for await (const msg of MessageV2.stream(pmSessionId)) {
      lastMsg = msg
      break
    }

    const parentID = lastMsg?.info.id ?? pmSessionId

    await Session.updateMessage({
      id: messageId,
      sessionID: pmSessionId,
      role: "assistant",
      time: { created: now, completed: now },
      error: undefined,
      parentID,
      modelID: "notification",
      providerID: "system",
      mode: "notification",
      agent: "system",
      path: { cwd: pmSession.directory, root: pmSession.directory },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    })

    await Session.updatePart({
      id: partId,
      messageID: messageId,
      sessionID: pmSessionId,
      type: "text",
      text,
      synthetic: true,
    })

    log.info("PM notification sent", { pmSessionId })
    return { ok: true }
  } catch (e) {
    const errorMsg = String(e)
    log.error("failed to notify PM", { pmSessionId, error: errorMsg })
    return { ok: false, error: errorMsg }
  }
}

async function commitTask(task: Task, jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  const parentSession = await Session.get(pmSessionId).catch(() => null)
  if (!parentSession?.directory) {
    log.error("PM session not found for commit", { taskId: task.id })
    await escalateCommitFailure(task, projectId, pmSessionId, "PM session not found")
    return
  }

  if (!task.worktree) {
    log.error("Task has no worktree for commit", { taskId: task.id })
    await escalateCommitFailure(task, projectId, pmSessionId, "No worktree available")
    return
  }

  let opsSession
  try {
    opsSession = await Session.createNext({
      parentID: pmSessionId,
      directory: task.worktree,
      title: `@ops commit: ${task.title}`,
      permission: [],
    })
  } catch (e) {
    log.error("failed to create @ops session for commit", { taskId: task.id, error: String(e) })
    await escalateCommitFailure(task, projectId, pmSessionId, String(e))
    return
  }

  const commitMsg = `feat(taskctl): ${task.title} (#${task.parent_issue})`
  const opsPrompt = `Commit all changes in the worktree directory: ${task.worktree}
Commit message: "${commitMsg}"
Do NOT push to remote. Only commit locally.
Use ${task.worktree} as the working directory for all bash commands (workdir parameter).
Run: git add -A && git commit -m "${commitMsg}"
If there is an error, report the full error output.`

  try {
    await SessionPrompt.prompt({
      sessionID: opsSession.id,
      agent: "ops",
      parts: [{ type: "text", text: opsPrompt }],
    })
  } catch (e) {
    log.error("@ops commit prompt failed", { taskId: task.id, error: String(e) })
    await escalateCommitFailure(task, projectId, pmSessionId, `Commit prompt failed: ${String(e)}`)
    return
  }

  const maxWait = 5 * 60 * 1000
  const pollInterval = 2000
  const start = Date.now()
  let opsComplete = false

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollInterval))
    const alive = isSessionActivelyRunning(opsSession.id)
    if (!alive) {
      opsComplete = true
      break
    }
  }

  if (!opsComplete) {
    log.error("@ops commit timed out", { taskId: task.id })
    try {
      SessionPrompt.cancel(opsSession.id)
    } catch (e: any) {
      log.error("failed to cancel timed-out ops session", { sessionId: opsSession.id, error: String(e) })
    }
    await escalateCommitFailure(task, projectId, pmSessionId, "Commit timed out after 5 minutes")
    return
  }

  const msgs = await Array.fromAsync(MessageV2.stream(opsSession.id))
  const last = msgs.find((m) => m.info.role === "assistant")
  const textPart = last?.parts.find((p): p is MessageV2.TextPart => p.type === "text" && !p.synthetic)
  const text = textPart?.text ?? ""

  if (text) {
    const nothingToCommit = /nothing to commit/i.test(text)
    const hasCommitHash = /\b[0-9a-f]{7,40}\b/.test(text)
    const hasFatal = /fatal|error/i.test(text)

    if (nothingToCommit) {
      log.error("@ops reported nothing to commit", { taskId: task.id })
      await escalateCommitFailure(task, projectId, pmSessionId, "Nothing to commit — developer changes not found in worktree")
      return
    }

    if (hasFatal && !hasCommitHash) {
      log.error("@ops commit failed", { taskId: task.id, output: text.substring(0, 200) })
      await escalateCommitFailure(task, projectId, pmSessionId, `Commit failed: ${text.substring(0, 200)}`)
      return
    }
  }

  if (task.worktree) {
    const safeWorktree = sanitizeWorktree(task.worktree)
    if (safeWorktree) {
      await Worktree.remove({ directory: safeWorktree }).catch((e) =>
        log.error("failed to remove worktree after commit", { taskId: task.id, error: String(e) }),
      )
    }
  }

  await Store.updateTask(
    projectId,
    task.id,
    {
      status: "closed",
      close_reason: "approved and committed",
      worktree: null,
      branch: null,
      assignee: null,
      assignee_pid: null,
      pipeline: { ...task.pipeline, stage: "done", last_activity: null },
    },
    true,
  )

  await Store.addComment(projectId, task.id, {
    author: "system",
    message: `Committed to branch by @ops. Task closed.`,
    created_at: new Date().toISOString(),
  })

  Bus.publish(BackgroundTaskEvent.Completed, {
    taskID: task.id,
    sessionID: pmSessionId,
    parentSessionID: undefined,
  })

  const notifyResult = await notifyPM(pmSessionId, `✅ Task complete: ${task.title} (${task.id})`)
  if (!notifyResult.ok) {
    log.warn("failed to notify PM of task completion", { taskId: task.id, error: notifyResult.error })
  }

  log.info("task committed and closed", { taskId: task.id })

  await scheduleReadyTasks(jobId, projectId, pmSessionId).catch((e) =>
    log.error("failed to reschedule after commit", { taskId: task.id, error: String(e) }),
  )
}

async function escalateToPM(task: Task, jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  await Store.updateTask(
    projectId,
    task.id,
    {
      status: "failed",
      pipeline: { ...task.pipeline, stage: "failed", last_activity: null },
    },
    true,
  )

  await Store.addComment(projectId, task.id, {
    author: "system",
    message: `Failed after ${MAX_ADVERSARIAL_ATTEMPTS} adversarial review cycles. Last verdict: ${task.pipeline.adversarial_verdict?.summary ?? "unknown"}. Worktree preserved for PM inspection.`,
    created_at: new Date().toISOString(),
  })

  Bus.publish(BackgroundTaskEvent.Completed, {
    taskID: `escalation-${task.id}`,
    sessionID: pmSessionId,
    parentSessionID: undefined,
  })

  const notifyResult = await notifyPM(
    pmSessionId,
    `❌ Task failed: ${task.title} (${task.id})\nUse: taskctl retry ${task.id}`
  )
  if (!notifyResult.ok) {
    log.warn("failed to notify PM of task escalation", { taskId: task.id, error: notifyResult.error })
  }

  log.error(`task escalated to PM after ${MAX_ADVERSARIAL_ATTEMPTS} failures`, { taskId: task.id, jobId })
}

async function escalateCommitFailure(
  task: Task,
  projectId: string,
  pmSessionId: string,
  reason: string,
): Promise<void> {
  await Store.updateTask(
    projectId,
    task.id,
    {
      status: "blocked_on_conflict",
      pipeline: { ...task.pipeline, stage: "commit-failed", last_activity: null },
    },
    true,
  )

  await Store.addComment(projectId, task.id, {
    author: "system",
    message: `Commit failed: ${reason}. Worktree preserved. Use taskctl override ${task.id} --commit-as-is to force commit or taskctl retry to reset.`,
    created_at: new Date().toISOString(),
  })

  Bus.publish(BackgroundTaskEvent.Completed, {
    taskID: `commit-failure-${task.id}`,
    sessionID: pmSessionId,
    parentSessionID: undefined,
  })
}

async function processAdversarialVerdicts(jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)

  for (const task of jobTasks) {
    if (task.status !== "review") continue
    if (!task.pipeline.adversarial_verdict) continue

    const verdict = task.pipeline.adversarial_verdict

    await Store.updateTask(
      projectId,
      task.id,
      {
        pipeline: { ...task.pipeline, adversarial_verdict: null, last_activity: new Date().toISOString() },
      },
      true,
    )

    const updatedTask = await Store.getTask(projectId, task.id)
    if (!updatedTask) {
      log.error("task disappeared after clearing verdict", { taskId: task.id })
      continue
    }

    if (verdict.verdict === "APPROVED") {
      await commitTask(updatedTask, jobId, projectId, pmSessionId)
    } else {
      const newAttempt = (updatedTask.pipeline.attempt || 0) + 1
      if (newAttempt >= MAX_ADVERSARIAL_ATTEMPTS) {
        await escalateToPM(updatedTask, jobId, projectId, pmSessionId)
      } else {
        const { respawnDeveloper } = await import("./pulse-scheduler")
        await respawnDeveloper(updatedTask, jobId, projectId, pmSessionId, newAttempt, verdict)
      }
    }
  }
}

export { processAdversarialVerdicts, commitTask, escalateToPM, escalateCommitFailure, notifyPM }