import fs from "fs/promises"
import path from "path"
import { platform } from "os"
import { Global } from "../global"
import { Store } from "./store"
import { Scheduler } from "./scheduler"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { Bus } from "../bus"
import { BackgroundTaskEvent } from "../session/async-tasks"
import { Worktree } from "../worktree"
import { Log } from "../util/log"
import type { Task, Job } from "./types"

const log = Log.create({ service: "taskctl.pulse" })
const tickLock = new Map<string, Promise<void>>()

const TIMEOUT_MS = 30 * 60 * 1000

export function startPulse(jobId: string, projectId: string, pmSessionId: string): ReturnType<typeof setInterval> {
  const startJob = async (): Promise<void> => {
    const existingPid = await readLockPid(jobId, projectId).catch(() => null)
    if (existingPid && isPidAlive(existingPid)) {
      log.error("job already running", { jobId, existingPid })
      return
    }
    if (existingPid && !isPidAlive(existingPid)) {
      log.warn("overwriting stale lock file", { jobId, oldPid: existingPid })
    }
    writeLockFile(jobId, projectId, process.pid).catch((e) => log.error("failed to write lock file", { jobId, error: String(e) }))
  }

  startJob()

  const interval = setInterval(async () => {
    const prevTick = tickLock.get(jobId)
    const done = new Promise<void>((resolve) => {
      resolve()
    })
    tickLock.set(jobId, done)

    if (prevTick) {
      try {
        await prevTick
        return
      } catch {
        return
      }
    }

    try {
      const job = await Store.getJob(projectId, jobId)
      if (!job) {
        clearInterval(interval)
        tickLock.delete(jobId)
        return
      }
      if (job.stopping) {
        await gracefulStop(jobId, projectId, interval)
        return
      }
      await heartbeatActiveAgents(jobId, projectId)
      await scheduleReadyTasks(jobId, projectId, pmSessionId)
      await checkTimeouts(jobId, projectId)
      await checkCompletion(jobId, projectId, pmSessionId, interval)
    } catch (e) {
      log.error("tick failed with unrecoverable error", { jobId, error: String(e) })
    } finally {
      tickLock.delete(jobId)
    }
  }, 5_000)

  return interval
}

export async function resurrectionScan(jobId: string, projectId: string): Promise<void> {
  const tasks = await Store.listTasks(projectId)
  const jobTasks = tasks.filter((t) => t.job_id === jobId)

  for (const task of jobTasks) {
    if (task.status === "in_progress" || task.status === "review") {
      const sessionAlive = task.assignee ? await isSessionAlive(task.assignee) : false
      if (!sessionAlive) {
        let worktreeRemoved = false
        if (task.worktree) {
          try {
            await Worktree.remove({ directory: task.worktree })
            worktreeRemoved = true
            log.info("removed worktree during resurrection", { taskId: task.id, worktree: task.worktree })
          } catch (e) {
            log.error("failed to remove worktree during resurrection", { taskId: task.id, error: String(e) })
          }
        }

        await Store.updateTask(projectId, task.id, {
          status: "open",
          assignee: null,
          assignee_pid: null,
          worktree: null,
          branch: null,
        }, true)

        await Store.addComment(projectId, task.id, {
          author: "system",
          message: worktreeRemoved 
            ? "Resurrected: agent session not found on Pulse restart. Worktree cleaned up." 
            : "Resurrected: agent session not found on Pulse restart.",
          created_at: new Date().toISOString(),
        })
        log.info("resurrected task", { taskId: task.id, jobId, worktreeRemoved })
      }
    }
  }
}

async function isSessionAlive(sessionId: string): Promise<boolean> {
  try {
    const session = await Session.get(sessionId)
    return session !== null && session !== undefined
  } catch (e) {
    const errorStr = String(e).toLowerCase()
    const isNotFound = errorStr.includes("not found") || errorStr.includes("no such")
    if (!isNotFound) {
      log.error("session alive check failed with unexpected error", { sessionId, error: String(e) })
    }
    return false
  }
}

async function lockFilePath(jobId: string, projectId: string): Promise<string> {
  const tasksDir = path.join(Global.Path.data, "tasks", projectId)
  await fs.mkdir(tasksDir, { recursive: true })

  const files = await fs.readdir(tasksDir)
  for (const file of files) {
    if (file.startsWith(`job-${jobId}.lock.tmp.`)) {
      await fs.unlink(path.join(tasksDir, file)).catch(() => {})
    }
  }

  return path.join(tasksDir, `job-${jobId}.lock`)
}

async function writeLockFile(jobId: string, projectId: string, pid: number): Promise<void> {
  const lockPath = await lockFilePath(jobId, projectId)
  const tmpPath = `${lockPath}.tmp.${process.pid}`
  await Bun.write(tmpPath, String(pid))
  await fs.rename(tmpPath, lockPath)
}

async function removeLockFile(jobId: string, projectId: string): Promise<void> {
  const lockPath = await lockFilePath(jobId, projectId)
  await fs.unlink(lockPath).catch(() => {})
}

async function readLockPid(jobId: string, projectId: string): Promise<number | null> {
  const lockPath = await lockFilePath(jobId, projectId)
  const content = await Bun.file(lockPath).text().catch(() => null)
  if (!content) return null
  const pid = parseInt(content, 10)
  if (isNaN(pid)) return null
  return pid
}

function isPidAlive(pid: number): boolean {
  if (platform() === "win32") {
    try {
      const { execSync } = require("child_process")
      execSync(`tasklist /FI "PID eq ${pid}"`, { stdio: "ignore" })
      return true
    } catch {
      return false
    }
  }
  try { process.kill(pid, 0); return true } catch { return false }
}

export {
  isPidAlive,
  writeLockFile,
  removeLockFile,
  readLockPid,
}

async function scheduleReadyTasks(jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  const job = await Store.getJob(projectId, jobId)
  if (!job) return

  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const inProgressCount = jobTasks.filter((t) => t.status === "in_progress" || t.status === "review").length

  if (inProgressCount >= job.max_workers) return

  const slots = job.max_workers - inProgressCount
  const ready = await Scheduler.getNextTasks(projectId, slots)
  const toSpawn = ready.filter((t) => t.job_id === jobId)

  for (const task of toSpawn) {
    const current = await Store.getTask(projectId, task.id)
    if (!current || current.status !== "open") {
      log.info("task no longer open, skipping spawn", { taskId: task.id, status: current?.status })
      continue
    }
    await spawnDeveloper(task, jobId, projectId, pmSessionId)
  }
}

async function spawnDeveloper(task: Task, jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  let worktreeInfo
  try {
    worktreeInfo = await Worktree.create({ name: task.id })
  } catch (e) {
    log.error("failed to create worktree", { taskId: task.id, error: String(e) })
    return
  }

  const now = new Date().toISOString()

  const parentSession = await Session.get(pmSessionId).catch(() => null)
  if (!parentSession?.directory) {
    await Worktree.remove({ directory: worktreeInfo.directory }).catch((e) =>
      log.error("failed to clean up worktree after PM session check failed", { taskId: task.id, error: String(e) })
    )
    log.error("PM session not found", { pmSessionId, taskId: task.id })
    return
  }

  let devSession
  try {
    devSession = await Session.createNext({
      parentID: pmSessionId,
      directory: worktreeInfo.directory,
      title: `Developer: ${task.title} (@developer subagent)`,
      permission: [],
    })
  } catch (e) {
    await Worktree.remove({ directory: worktreeInfo.directory }).catch((e) =>
      log.error("failed to clean up worktree after session creation failed", { taskId: task.id, error: String(e) })
    )
    log.error("failed to create developer session", { taskId: task.id, error: String(e) })
    return
  }

  await Store.updateTask(projectId, task.id, {
    status: "in_progress",
    assignee: devSession.id,
    assignee_pid: process.pid,
    worktree: worktreeInfo.directory,
    branch: worktreeInfo.branch,
  }, true)

  const prompt = buildDeveloperPrompt(task)
  try {
    await SessionPrompt.prompt({
      sessionID: devSession.id,
      agent: "developer",
      parts: [{ type: "text", text: prompt }],
    })
  } catch (e) {
    log.error("developer session failed to start", { taskId: task.id, sessionId: devSession.id, error: String(e) })

    try {
      SessionPrompt.cancel(devSession.id)
    } catch (e: any) {
      log.error("failed to cancel orphaned developer session", { sessionId: devSession.id, error: String(e) })
    }

    await Worktree.remove({ directory: worktreeInfo.directory }).catch((e) =>
      log.error("failed to clean up worktree after developer prompt failed", { taskId: task.id, error: String(e) })
    )

    await Store.updateTask(projectId, task.id, {
      status: "open",
      assignee: null,
      assignee_pid: null,
      worktree: null,
      branch: null,
    }, true)

    await Store.addComment(projectId, task.id, {
      author: "system",
      message: `Failed to start developer: ${String(e)}`,
      created_at: new Date().toISOString(),
    })
  }
}

function buildDeveloperPrompt(task: Task): string {
  return `Implement the following task with TDD:

**Title:** ${task.title}

**Description:** ${task.description}

**Acceptance Criteria:** ${task.acceptance_criteria}

Follow these steps:
1. Write failing test(s) for the required behavior
2. Write minimal code to make tests pass
3. Refactor for clarity and maintainability
4. Run all tests to verify nothing broke

Important: Only implement what's explicitly requested. Do not add "helpful" features.`
}

async function heartbeatActiveAgents(jobId: string, projectId: string): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const now = new Date().toISOString()

  for (const task of jobTasks) {
    if (task.status === "in_progress" && task.assignee) {
      const sessionAlive = await isSessionAlive(task.assignee)
      const updated = await Store.getTask(projectId, task.id)
      if (!updated) continue

      if (!sessionAlive) {
        log.info("developer session ended, awaiting adversarial", { taskId: task.id })
        updated.pipeline.stage = "reviewing"
      }

      updated.pipeline.last_activity = now
      await Store.updateTask(projectId, task.id, updated, true)
    }
  }
}

async function checkTimeouts(jobId: string, projectId: string): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const now = Date.now()

  for (const task of jobTasks) {
    if (task.status === "in_progress") {
      const lastActivity = task.pipeline.last_activity
        ? new Date(task.pipeline.last_activity).getTime()
        : 0

      if (lastActivity > 0 && now - lastActivity > TIMEOUT_MS) {
        log.info("task timed out", { taskId: task.id, lastActivity, now })

        let worktreeRemoved = false
        if (task.worktree) {
          try {
            await Worktree.remove({ directory: task.worktree })
            worktreeRemoved = true
          } catch (e) {
            log.error("failed to remove worktree for timed out task", { taskId: task.id, error: String(e) })
          }
        }

        if (task.assignee) {
          try {
            SessionPrompt.cancel(task.assignee)
          } catch (e: any) {
            log.error("failed to cancel session for timed out task", { taskId: task.id, error: String(e) })
          }
        }

        await Store.updateTask(projectId, task.id, {
          status: "open",
          assignee: null,
          assignee_pid: null,
          worktree: null,
          branch: null,
        }, true)

        await Store.addComment(projectId, task.id, {
          author: "system",
          message: worktreeRemoved
            ? `Timed out after 30 minutes with no activity. Worktree cleaned up.`
            : `Timed out after 30 minutes with no activity.`,
          created_at: new Date().toISOString(),
        })
      }
    }
  }
}

export async function checkCompletion(jobId: string, projectId: string, pmSessionId: string, interval: ReturnType<typeof setInterval>): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const allClosed = jobTasks.every((t) => t.status === "closed")

  if (allClosed) {
    log.info("all tasks completed", { jobId })
    try {
      clearInterval(interval)
      tickLock.delete(jobId)
      await removeLockFile(jobId, projectId)
      await Store.updateJob(projectId, jobId, { status: "complete" })
      Bus.publish(BackgroundTaskEvent.Completed, { taskID: jobId, sessionID: pmSessionId, parentSessionID: undefined })
    } catch (e) {
      tickLock.delete(jobId)
      await removeLockFile(jobId, projectId).catch(() => {})
    }
  }
}

async function gracefulStop(jobId: string, projectId: string, interval: ReturnType<typeof setInterval>): Promise<void> {
  log.info("graceful stop requested", { jobId })

  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const inProgressTasks = jobTasks.filter((t) => t.status === "in_progress" || t.status === "review")

  for (const task of inProgressTasks) {
    if (task.assignee) {
      await Session.get(task.assignee).catch(() => {})
      try {
        SessionPrompt.cancel(task.assignee)
      } catch (e: any) {
        log.error("failed to cancel session during graceful stop", { taskId: task.id, error: String(e) })
      }
    }

    let worktreeRemoved = false
    if (task.worktree) {
      try {
        await Worktree.remove({ directory: task.worktree })
        worktreeRemoved = true
      } catch (e) {
        log.error("failed to remove worktree during graceful stop", { taskId: task.id, error: String(e) })
      }
    }

    await Store.updateTask(projectId, task.id, {
      status: "open",
      assignee: null,
      assignee_pid: null,
      worktree: null,
      branch: null,
    }, true)

    await Store.addComment(projectId, task.id, {
      author: "system",
      message: worktreeRemoved 
        ? "Job stopped by PM. Worktree cleaned up." 
        : "Job stopped by PM.",
      created_at: new Date().toISOString(),
    })
  }

  clearInterval(interval)
  tickLock.delete(jobId)
  await removeLockFile(jobId, projectId)

  await Store.updateJob(projectId, jobId, { status: "stopped" })
  log.info("graceful stop completed", { jobId })
}