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
import { getGithubRepo } from "../util/git"

// Allow 6 attempts to resolve minor test flakiness before escalating to PM
const MAX_ADVERSARIAL_ATTEMPTS = 6

// Branch name validation: only alphanumeric, hyphen, underscore, slash, dot, plus (anchors ensure full string match)
const BRANCH_REGEX = /^[a-zA-Z0-9_\-\/\+.]+$/

const log = Log.create({ service: "taskctl.pulse.verdicts" })

function safeBranch(name: string): string | null {
  return BRANCH_REGEX.test(name) ? name : null
}

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

  if (!task.branch) {
    log.error("Task has no branch for commit and push", { taskId: task.id })
    await escalateCommitFailure(task, projectId, pmSessionId, "No branch available - cannot push")
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

  const branchName = task.branch
  const commitMsg = `feat(taskctl): ${task.title} (#${task.parent_issue})`
  const opsPrompt = `Commit and push all changes in the worktree directory: ${task.worktree}
Commit message: "${commitMsg}"

Step 1: Commit locally
Use ${task.worktree} as the working directory for all bash commands (workdir parameter).
Run: git add -A && git commit -m "${commitMsg}"

Step 2: Push to remote
After successful commit, push the branch to origin:
git push -u origin ${branchName}

Report the full output from both steps so we can verify the push succeeded.`

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
    const hasPushSuccess = /branch '.*' set up to track|pushed to|Branch '\w+.*' set up to track/i.test(text)
    const hasPushFailure = /fatal:.*unable to access|Could not read from remote repository|authentication failed|Permission denied|rejected|! \[rejected\]/i.test(text)
    const hasNoRemote = /fatal: 'origin' does not appear to be a git repository|no such remote/i.test(text)

    if (nothingToCommit) {
      log.error("@ops reported nothing to commit", { taskId: task.id })
      await escalateCommitFailure(task, projectId, pmSessionId, "Nothing to commit — developer changes not found in worktree")
      return
    }

    const hasFatal = /fatal|error/i.test(text)
    if (hasFatal) {
      if (hasPushFailure || hasNoRemote || !hasPushSuccess) {
        log.error("@ops push failed", { taskId: task.id, output: text.substring(0, 200) })
        await escalateCommitFailure(task, projectId, pmSessionId, `Push failed: ${text.substring(0, 200)}`)
        return
      }
      if (!hasCommitHash) {
        log.error("@ops commit failed", { taskId: task.id, output: text.substring(0, 200) })
        await escalateCommitFailure(task, projectId, pmSessionId, `Commit failed: ${text.substring(0, 200)}`)
        return
      }
    }

    if (!hasPushSuccess && hasCommitHash) {
      log.warn("@ops commit appeared to succeed but push output not detected", { taskId: task.id, output: text.substring(0, 300) })
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
    parentSessionID: pmSessionId,
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
    parentSessionID: pmSessionId,
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
    parentSessionID: pmSessionId,
  })
}

async function mergeTaskBranchesToFeatureBranch(projectRoot: string, featureBranch: string, tasks: Task[]): Promise<{ ok: true } | { ok: false; error: string }> {
  // Validate feature branch name
  const safeFeatureBranch = safeBranch(featureBranch)
  if (!safeFeatureBranch) {
    log.error("feature branch name contains invalid characters", { featureBranch })
    return { ok: false, error: `Invalid feature branch name: ${featureBranch}` }
  }

  const branches: string[] = []
  for (const task of tasks) {
    if (task.branch && task.branch !== safeFeatureBranch) {
      const safeTaskBranch = safeBranch(task.branch)
      if (!safeTaskBranch) {
        log.warn("task branch name contains invalid characters, skipping", { taskId: task.id, branch: task.branch })
        continue
      }
      branches.push(safeTaskBranch)
    }
  }
  if (!branches.length) {
    log.debug("no task branches to merge", { featureBranch: safeFeatureBranch })
    return { ok: true }
  }

  try {
    const { $ } = await import("bun")

    // Verify origin remote exists
    const remoteCheck = await $`git ls-remote origin HEAD`.cwd(projectRoot).quiet().nothrow()
    if (remoteCheck.exitCode !== 0) {
      log.warn("origin remote not configured", { projectRoot })
      return { ok: false, error: "origin remote not configured" }
    }

    // Checkout feature branch
    const checkoutRes = await $`git checkout ${safeFeatureBranch}`.cwd(projectRoot).nothrow()
    if (checkoutRes.exitCode !== 0) {
      log.error("failed to checkout feature branch", { featureBranch: safeFeatureBranch })
      return { ok: false, error: `Failed to checkout feature branch ${safeFeatureBranch}` }
    }

    // Merge each task branch
    for (const branch of branches) {
      const mergeRes = await $`git merge --no-ff ${branch} -m "merge task branch ${branch}"`.cwd(projectRoot).nothrow()
      if (mergeRes.exitCode !== 0) {
        log.error("failed to merge task branch, aborting", { branch, featureBranch: safeFeatureBranch })
        // Abort merge to leave repository in clean state
        await $`git merge --abort`.cwd(projectRoot).nothrow()
        return { ok: false, error: `Merge conflict with branch ${branch}, aborting` }
      }
      log.info("merged task branch", { branch, featureBranch: safeFeatureBranch })
    }

    // Push feature branch
    const pushResult = await $`git push origin ${safeFeatureBranch}`.cwd(projectRoot).nothrow()
    if (pushResult.exitCode !== 0) {
      const stderr = pushResult.stderr ? new TextDecoder().decode(pushResult.stderr) : "Unknown error"
      log.error("failed to push feature branch", { featureBranch: safeFeatureBranch, error: stderr })
      return { ok: false, error: `Failed to push feature branch: ${stderr}` }
    }

    log.info("pushed feature branch after merging task branches", { featureBranch: safeFeatureBranch })
    return { ok: true }
  } catch (e) {
    log.error("error merging task branches", { featureBranch, error: String(e) })
    return { ok: false, error: String(e) }
  }
}

async function createPRForJob(projectId: string, tasks: Task[], pmSessionId: string, issueNumber: number): Promise<{ ok: true; prUrl: string } | { ok: false; error: string }> {
  if (tasks.length === 0) {
    return { ok: false, error: "No tasks found in job" }
  }

  const job = await Store.getJob(projectId, tasks[0].job_id)
  let featureBranch = job?.feature_branch

  // Fallback to first task branch if job or feature_branch is missing
  if (!featureBranch) {
    const firstTaskWithBranch = tasks.find((t) => t.branch && t.branch.trim().length > 0)
    if (firstTaskWithBranch) {
      featureBranch = firstTaskWithBranch.branch
    } else {
      return { ok: false, error: "No feature branch found for job" }
    }
  }

  // After fallback, validate featureBranch is not empty
  if (!featureBranch || featureBranch.trim().length === 0) {
    return { ok: false, error: "Invalid feature branch name for job" }
  }

  // Validate branch name contains only safe characters
  const safeFeatureBranch = safeBranch(featureBranch)
  if (!safeFeatureBranch) {
    log.error("feature branch name contains invalid characters", { featureBranch })
    return { ok: false, error: `Invalid feature branch name: ${featureBranch}` }
  }

  try {
    const parentSession = await Session.get(pmSessionId).catch(() => null)
    if (!parentSession?.directory) {
      return { ok: false, error: `PM session not found for PR creation (session: ${pmSessionId}, branch: ${safeFeatureBranch})` }
    }

    const { $ } = await import("bun")

    // Check if feature branch has commits ahead of dev
    const ahead = await $`git rev-list --count dev..${safeFeatureBranch}`.cwd(parentSession.directory).quiet().nothrow()
    const count = parseInt(new TextDecoder().decode(ahead.stdout).trim() || "0")
    if (count === 0) {
      log.warn("feature branch has no commits ahead of dev, skipping PR creation", { featureBranch: safeFeatureBranch })
      return { ok: false, error: `Feature branch ${safeFeatureBranch} has no commits ahead of dev` }
    }

    const repo = await getGithubRepo(parentSession.directory) ?? "randomm/opencode"
    const prTitle = `Issue #${issueNumber}: Automated PR from taskctl`
    const prBody = `Closes #${issueNumber}

This PR was automatically created by the taskctl pipeline after all tasks completed.`

    // Bun Shell auto-escapes interpolated values; no manual escaping needed
    const result = await $`gh pr create --repo ${repo} --base dev --head ${safeFeatureBranch} --title ${prTitle} --body ${prBody}`
      .cwd(parentSession.directory)
      .quiet()
      .nothrow()

    if (result.exitCode !== 0) {
      const stderr = result.stderr ? new TextDecoder().decode(result.stderr) : "Unknown error"
      return { ok: false, error: `gh pr create failed: ${stderr}` }
    }

    const stdout = result.stdout ? new TextDecoder().decode(result.stdout).trim() : ""
    const prUrl = stdout.match(/https:\/\/github\.com\/[^\/]+\/[^\/]+\/pull\/\d+/)?.[0] || stdout

    return { ok: true, prUrl }
  } catch (e) {
    log.error("failed to create PR", { error: String(e) })
    return { ok: false, error: String(e) }
  }
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

export {
  processAdversarialVerdicts,
  commitTask,
  escalateToPM,
  escalateCommitFailure,
  notifyPM,
  createPRForJob,
  mergeTaskBranchesToFeatureBranch,
}