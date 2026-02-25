import { Store } from "./store"
import { Log } from "../util/log"
import { startPulse, resurrectionScan } from "./pulse"
import { removeLockFile, readLockPid, isPidAlive, sanitizeWorktree } from "./pulse-scheduler"
import { enableAutoWakeup } from "../session/async-tasks"
import { runComposer } from "./composer"
import { SessionPrompt } from "../session/prompt"
import { Worktree } from "../worktree"
import { Instance } from "../project/instance"

const log = Log.create({ service: "taskctl.tool.job-commands" })

// Branch name validation for security
const BRANCH_REGEX = /^[a-zA-Z0-9_\-\/\+.]+$/

function safeBranch(name: string): string | null {
  return BRANCH_REGEX.test(name) ? name : null
}

export async function executeStart(projectId: string, params: any, ctx: any): Promise<{ title: string; output: string; metadata: {} }> {
  const issueNumber = params.issueNumber
  if (!issueNumber || !Number.isInteger(Number(issueNumber)) || Number(issueNumber) <= 0) {
    throw new Error("issueNumber must be a valid positive integer")
  }

  const existingJob = await Store.findJobByIssue(projectId, issueNumber)
  if (existingJob) {
    const existingPid = await readLockPid(existingJob.id, projectId)

    if (existingJob.status === "running") {
      if (existingPid !== null && isPidAlive(existingPid)) {
        return {
          title: "Job already running",
          output: `Job is running. Status: taskctl status ${issueNumber}`,
          metadata: {},
        }
      }
      if (existingPid !== null) {
        await removeLockFile(existingJob.id, projectId)
      }
    }

    // Re-check job existence after lock cleanup to avoid race
    const recheckedJob = await Store.getJob(projectId, existingJob.id)
    if (recheckedJob === null) {
      // Job was deleted by another process, proceed to create new job
    } else if (recheckedJob.status === "running") {
      // Another process already started a new job
      return {
        title: "Job already running",
        output: `Job ${recheckedJob.id} is running. Status: taskctl status ${issueNumber}`,
        metadata: {},
      }
    } else {
      // Delete non-running jobs atomically
      await Store.deleteJobAndTasks(projectId, existingJob.id)
    }
  }

  const jobId = `job-${Date.now()}`
  const featureBranch = `feature/issue-${issueNumber}`

  // Validate feature branch name before using in git operations
  const safeFeatureBranch = safeBranch(featureBranch)
  if (!safeFeatureBranch) {
    log.error("feature branch name failed validation", { issueNumber, featureBranch })
    throw new Error(`Invalid feature branch name: ${featureBranch}`)
  }

  // Create the feature branch in the main repository.
  // Note: We try Instance.directory first (for normal CLI context), then fall back to
  // process.cwd() if Instance is unavailable (for MCP bridge contexts where AsyncLocalStorage
  // context may not be established).
  let cwd: string
  try {
    cwd = Instance.directory
  } catch {
    cwd = process.cwd()
  }

  try {
    const { $ } = await import("bun")
    const result = await $`git checkout -b ${safeFeatureBranch} dev`.cwd(cwd).quiet().nothrow()
    if (result.exitCode !== 0) {
      const stderr = result.stderr ? new TextDecoder().decode(result.stderr) : "Unknown error"
      log.error("failed to create feature branch", { issueNumber, featureBranch: safeFeatureBranch, error: stderr })
      throw new Error(`Failed to create feature branch ${safeFeatureBranch}: ${stderr}`)
    }

    // Push the feature branch to origin - MUST succeed before creating job
    const pushResult = await $`git push -u origin ${safeFeatureBranch}`.cwd(cwd).quiet().nothrow()
    if (pushResult.exitCode !== 0) {
      const stderr = pushResult.stderr ? new TextDecoder().decode(pushResult.stderr) : "Unknown error"
      log.error("failed to push feature branch to origin", { issueNumber, featureBranch: safeFeatureBranch, error: stderr })
      throw new Error(`Failed to push feature branch ${safeFeatureBranch} to origin: ${stderr}`)
    }
    log.info("feature branch created and pushed", { issueNumber, featureBranch: safeFeatureBranch })
  } catch (e) {
    log.error("error creating feature branch", { issueNumber, featureBranch: safeFeatureBranch, error: String(e) })
    throw e
  }

  await Store.createJob(projectId, {
    id: jobId,
    parent_issue: issueNumber,
    status: "running",
    created_at: new Date().toISOString(),
    stopping: false,
    pulse_pid: null,
    max_workers: 3,
    pm_session_id: ctx.sessionID,
    feature_branch: safeFeatureBranch,
  })

  enableAutoWakeup(ctx.sessionID)

  const repo = "randomm/opencode"

  let issueOutput: { title: string; body: string } | null = null
  const proc = Bun.spawn(["gh", "issue", "view", issueNumber.toString(), "--repo", repo, "--json", "title,body"], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const reader = proc.stdout.getReader()
  const decoder = new TextDecoder()
  let output = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    output += decoder.decode(value)
  }

  const exitCode = await proc.exited
  if (exitCode !== 0 || !output) {
    const errorReader = proc.stderr.getReader()
    let errorOutput = ""
    while (true) {
      const { done, value } = await errorReader.read()
      if (done) break
      errorOutput += decoder.decode(value)
    }
    await Store.updateJob(projectId, jobId, { status: "failed" })
    throw new Error(`Failed to fetch GitHub issue #${issueNumber}: ${errorOutput || "Unknown error"}`)
  }

  try {
    issueOutput = JSON.parse(output) as { title: string; body: string }
    if (!issueOutput || typeof issueOutput !== "object") {
      throw new Error("Invalid response format")
    }
  } catch {
    await Store.updateJob(projectId, jobId, { status: "failed" })
    throw new Error(`Failed to parse GitHub issue #${issueNumber} output`)
  }

  const issueTitle = issueOutput.title || ""
  const issueBody = issueOutput.body || ""

  const composerResult = await runComposer({
    jobId,
    projectId,
    pmSessionId: ctx.sessionID,
    issueNumber,
    issueTitle,
    issueBody,
  })

  if (composerResult.status === "needs_clarification") {
    await Store.updateJob(projectId, jobId, { status: "failed" })
    const questionLines = ["Composer needs clarification:", ...composerResult.questions.map((q) => `${q.id}. ${q.question}`)]
    return {
      title: "Composer needs clarification",
      output: questionLines.join("\n"),
      metadata: {},
    }
  }

  await resurrectionScan(jobId, projectId)
  startPulse(jobId, projectId, ctx.sessionID)

  return {
    title: "Pipeline started",
    output: `Job ${jobId} started: ${composerResult.taskCount} tasks queued. Pulse is running every 5 seconds. Use taskctl status ${issueNumber} to monitor.`,
    metadata: {},
  }
}

export async function executeStatus(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  const issueNumber = params.issueNumber
  if (!issueNumber) throw new Error("status requires issueNumber")

  const job = await Store.findJobByIssue(projectId, issueNumber)
  if (!job) {
    const tasks = await Store.listTasks(projectId)
    const historicalTasks = tasks.filter((t) => t.parent_issue === issueNumber)
    if (historicalTasks.length > 0) {
      return {
        title: "Job completed",
        output: `Job completed. Historical tasks: ${historicalTasks.length} tasks found.`,
        metadata: {},
      }
    }
    return {
      title: "Job not found",
      output: `No job found for issue #${issueNumber}. Use "taskctl start ${issueNumber}" to start the pipeline.`,
      metadata: {},
    }
  }

  const tasks = await Store.listTasks(projectId)
  const jobTasks = tasks.filter((t) => t.job_id === job.id)

  const lines = [
    `Job: ${job.id}`,
    `Status: ${job.status}`,
    `Max Workers: ${job.max_workers}`,
    `PM Session: ${job.pm_session_id}`,
    `Created: ${job.created_at}`,
    `Pulse PID: ${job.pulse_pid ?? "none"}`,
    ``,
    `Tasks (${jobTasks.length}):`,
  ]

  for (const task of jobTasks.sort((a, b) => a.id.localeCompare(b.id))) {
    lines.push(`  ${task.id} [${task.status}] - ${task.title}`)
    if (task.assignee) {
      lines.push(`    Assignee: ${task.assignee}`)
    }
    if (task.worktree) {
      lines.push(`    Worktree: ${task.worktree}`)
    }
    if (task.pipeline.stage !== "idle") {
      lines.push(`    Pipeline: ${task.pipeline.stage} (attempt ${task.pipeline.attempt})`)
    }
  }

  return {
    title: `Job Status: #${issueNumber}`,
    output: lines.join("\n"),
    metadata: {},
  }
}

export async function executeStop(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  const jobId = params.jobId
  if (!jobId) throw new Error("stop requires jobId")

  const job = await Store.getJob(projectId, jobId)
  if (!job) throw new Error(`Job not found: ${jobId}`)
  if (job.status !== "running") {
    return {
      title: "Job not running",
      output: `Job ${jobId} is not running (status: ${job.status}). Nothing to stop.`,
      metadata: {},
    }
  }
  if (job.stopping) {
    return {
      title: "Already stopping",
      output: `Job ${jobId} is already stopping. Use taskctl status to monitor.`,
      metadata: {},
    }
  }

  await Store.updateJob(projectId, jobId, { stopping: true })
  return {
    title: "Stop signal sent",
    output: `Stop signal sent to job ${jobId}. Pipeline will finish in-flight work and halt. Use taskctl status to monitor.`,
    metadata: {},
  }
}

export async function executeResume(projectId: string, params: any, ctx: any): Promise<{ title: string; output: string; metadata: {} }> {
  const jobId = params.jobId
  if (!jobId) throw new Error("resume requires jobId")

  const job = await Store.getJob(projectId, jobId)
  if (!job) throw new Error(`Job not found: ${jobId}`)
  // Auto-recover if job is "running" but Pulse PID is dead (binary restart scenario)
  if (job.status === "running") {
    const livePid = await readLockPid(jobId, projectId)
    if (livePid === null || !isPidAlive(livePid)) {
      // Pulse is dead — reset job to stopped and reset in-flight tasks
      await removeLockFile(jobId, projectId)
      await Store.updateJob(projectId, jobId, { status: "stopped", stopping: false })
      const allTasks = await Store.listTasks(projectId)
      const stale = allTasks.filter(t =>
        t.job_id === jobId &&
        t.status === "in_progress" &&
        ["developing", "reviewing", "adversarial-running"].includes(t.pipeline.stage)
      )
      for (const task of stale) {
        await Store.updateTask(projectId, task.id, {
          status: "open",
          assignee: null,
          assignee_pid: null,
          pipeline: { ...task.pipeline, stage: "idle", last_activity: null },
        }, true)
        await Store.addComment(projectId, task.id, {
          author: "system",
          message: `Task reset to open after binary restart (was ${task.pipeline.stage} with dead Pulse).`,
          created_at: new Date().toISOString(),
        })
      }
      // Fall through to normal resume logic (job is now "stopped")
    } else {
      return { title: "Already running", output: `Pipeline is already running (PID ${livePid}).`, metadata: {} }
    }
  }

  const existingPid = await readLockPid(jobId, projectId)
  if (existingPid !== null) {
    if (isPidAlive(existingPid)) {
      return {
        title: "Already running",
        output: `Pipeline is already running (PID ${existingPid}). Use taskctl status to monitor.`,
        metadata: {},
      }
    }
    await removeLockFile(jobId, projectId)
  }

  await resurrectionScan(jobId, projectId)

  const revalidated = await Store.getJob(projectId, jobId)
  if (!revalidated) throw new Error(`Job vanished after resurrection: ${jobId}`)
  
  if (revalidated.status !== "stopped") {
    return {
      title: "Cannot resume",
      output: `Job status must be "stopped" to resume. Current status: ${revalidated.status}. Status: taskctl status`,
      metadata: {},
    }
  }
  
  await Store.updateJob(projectId, jobId, { stopping: false, status: "running" })
  enableAutoWakeup(ctx.sessionID)
  if (job.pm_session_id && job.pm_session_id !== ctx.sessionID) {
    enableAutoWakeup(job.pm_session_id)
  }

  const tasks = await Store.listTasks(projectId)
  const remaining = tasks.filter((t) => t.job_id === jobId && t.status !== "closed").length
  startPulse(jobId, projectId, ctx.sessionID)

  return {
    title: "Pipeline resumed",
    output: `Pipeline resumed for job ${jobId}. ${remaining} tasks remaining. Pulse is running.`,
    metadata: {},
  }
}
