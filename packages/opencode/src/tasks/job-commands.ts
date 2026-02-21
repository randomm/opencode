import { Store } from "./store"
import { Log } from "../util/log"
import { startPulse, resurrectionScan } from "./pulse"
import { removeLockFile, readLockPid, isPidAlive, sanitizeWorktree } from "./pulse-scheduler"
import { enableAutoWakeup } from "../session/async-tasks"
import { runComposer } from "./composer"
import { SessionPrompt } from "../session/prompt"
import { Worktree } from "../worktree"

const log = Log.create({ service: "taskctl.tool.job-commands" })

export async function executeStart(projectId: string, params: any, ctx: any): Promise<{ title: string; output: string; metadata: {} }> {
  const issueNumber = params.issueNumber
  if (!issueNumber) throw new Error("start requires issueNumber")

  // KNOWN RACE CONDITION: Concurrent starts for the same issue can create multiple jobs
  // File locking around findJobByIssue + createJob transaction would fix this (medium complexity)
  // Issue tracked: GitHub #293 restart feature
  const existingJob = await Store.findJobByIssue(projectId, issueNumber)
  if (existingJob) {
    const existingPid = await readLockPid(existingJob.id, projectId)

    if (existingJob.status === "complete" || existingJob.status === "failed" || existingJob.status === "stopped") {
      // Clean up old terminal-state job before creating new one
      // Note: This is not atomic. If deleteTasksByJobId fails, orphaned task files may remain.
      // Known limitation without transaction support.
      await Store.deleteJob(projectId, existingJob.id)
      await Store.deleteTasksByJobId(projectId, existingJob.id)
    } else if (existingJob.status === "running") {
      if (existingPid !== null && isPidAlive(existingPid)) {
        return {
          title: "Already running",
          output: `Job already running (PID ${existingPid}). Use taskctl status ${issueNumber} to monitor.`,
          metadata: {},
        }
      }
      // Clean up lock file before job deletion (prevents orphaned lock files)
      if (existingPid !== null) {
        await removeLockFile(existingJob.id, projectId)
      }
    }
  }

  const jobId = `job-${Date.now()}`
  await Store.createJob(projectId, {
    id: jobId,
    parent_issue: issueNumber,
    status: "running",
    created_at: new Date().toISOString(),
    stopping: false,
    pulse_pid: null,
    max_workers: 3,
    pm_session_id: ctx.sessionID,
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

  // Single resurrection scan before job validation - checks for zombie processes
  // killed externally. Removed duplicate scan after status update.
  await resurrectionScan(jobId, projectId)

  const revalidated = await Store.getJob(projectId, jobId)
  if (!revalidated) throw new Error(`Job vanished after resurrection: ${jobId}`)
  if (revalidated.status === "complete" || revalidated.status === "failed" || revalidated.status === "stopped") {
    return {
      title: "Cannot resume",
      output: `Job is ${revalidated.status}. Use taskctl start <issueNumber> to create a new job.`,
      metadata: {},
    }
  }

  await Store.updateJob(projectId, jobId, { status: "running", stopping: false })
  enableAutoWakeup(ctx.sessionID)

  const tasks = await Store.listTasks(projectId)
  const remaining = tasks.filter((t) => t.job_id === jobId && t.status !== "closed").length
  startPulse(jobId, projectId, ctx.sessionID)

  return {
    title: "Pipeline resumed",
    output: `Pipeline resumed for job ${jobId}. ${remaining} tasks remaining. Pulse is running.`,
    metadata: {},
  }
}