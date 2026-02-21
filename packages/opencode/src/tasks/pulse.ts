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
import { MessageV2 } from "../session/message-v2"
import { SessionStatus } from "../session/status"
import type { Task, Job, AdversarialVerdict } from "./types"
import { Instance, context as instanceContext } from "../project/instance"
import { GlobalBus } from "../bus/global"
import { Identifier } from "../id/id"

const log = Log.create({ service: "taskctl.pulse" })
const activeTicks = new Map<string, Set<string>>()
const intervalListeners = new Map<ReturnType<typeof setInterval>, (event: { directory?: string | undefined; payload: any }) => void>()

const TIMEOUT_MS = 30 * 60 * 1000

function clearIntervalSafe(interval: ReturnType<typeof setInterval>) {
  const listener = intervalListeners.get(interval)
  if (listener) {
    GlobalBus.off("event", listener)
    intervalListeners.delete(interval)
  }
  clearInterval(interval)
}

export function sanitizeWorktree(worktree: string | null | undefined): string | null {
  if (!worktree || typeof worktree !== "string") return null
  if (worktree.includes("..")) return null
  return path.resolve(worktree)
}

export function startPulse(jobId: string, projectId: string, pmSessionId: string): ReturnType<typeof setInterval> {
  const capturedCtx = instanceContext.tryGet()
  if (!capturedCtx) {
    log.error("refusing to start pulse: no instance context", { jobId, projectId })
    const noopInterval = setInterval(() => {}, 5_000)
    clearInterval(noopInterval)
    return noopInterval
  }

  const startJob = async (): Promise<void> => {
    await writeLockFile(jobId, projectId, process.pid)
    const lockPid = await readLockPid(jobId, projectId).catch(() => null)
    if (lockPid !== process.pid) {
      log.error("lost lock file race, aborting start", { jobId, lockPid, myPid: process.pid })
      return
    }
    await Store.updateJob(projectId, jobId, { pulse_pid: process.pid })
  }

  startJob()

  const interval = setInterval(async () => {
    const projectTicks = activeTicks.get(projectId) ?? new Set<string>()
    activeTicks.set(projectId, projectTicks)
    if (projectTicks.has(jobId)) return
    projectTicks.add(jobId)

    await instanceContext.provide(capturedCtx, async () => {
      try {
        const job = await Store.getJob(projectId, jobId)
        if (!job) {
          clearIntervalSafe(interval)
          projectTicks.delete(jobId)
          return
        }
        if (job.stopping) {
          await gracefulStop(jobId, projectId, interval)
          return
        }
        await heartbeatActiveAgents(jobId, projectId)
        await processAdversarialVerdicts(jobId, projectId, pmSessionId)
        await checkTimeouts(jobId, projectId)
        await checkSteering(jobId, projectId, pmSessionId)
        await scheduleReadyTasks(jobId, projectId, pmSessionId)
        await checkCompletion(jobId, projectId, pmSessionId, interval)
      } catch (e) {
        log.error("tick failed with unrecoverable error", { jobId, error: String(e) })
      } finally {
        projectTicks.delete(jobId)
      }
    })
  }, 5_000)

  const disposeListener = (event: { directory?: string | undefined; payload: any }) => {
    if (!intervalListeners.has(interval)) return
    if (event.directory === capturedCtx.directory && event.payload?.type === "server.instance.disposed") {
      log.info("instance disposed, clearing pulse interval", { jobId, projectId })
      clearIntervalSafe(interval)
      activeTicks.get(projectId)?.delete(jobId)
    }
  }
  intervalListeners.set(interval, disposeListener)
  GlobalBus.on("event", disposeListener)

  return interval
}

export async function resurrectionScan(jobId: string, projectId: string): Promise<void> {
  const tasks = await Store.listTasks(projectId)
  const jobTasks = tasks.filter((t) => t.job_id === jobId)

  for (const task of jobTasks) {
    if (task.status === "in_progress" || task.status === "review") {
      const pidAlive = task.assignee_pid ? isPidAlive(task.assignee_pid) : false
      const sessionAlive = task.assignee ? isSessionActivelyRunning(task.assignee) : false
      const alive = pidAlive || sessionAlive

      if (!alive) {
        if (task.pipeline.stage === "developing" || task.pipeline.stage === "adversarial-running") {
          // Developer or adversarial finished before restart — advance to reviewing, preserve worktree/branch
          await Store.updateTask(projectId, task.id, {
            assignee: null,
            assignee_pid: null,
            pipeline: { ...task.pipeline, stage: "reviewing", last_activity: new Date().toISOString() },
          }, true)
          await Store.addComment(projectId, task.id, {
            author: "system",
            message: task.pipeline.stage === "developing"
              ? "Resurrected: developer session ended before restart. Advanced to reviewing."
              : "Resurrected: adversarial session ended before restart. Returned to reviewing.",
            created_at: new Date().toISOString(),
          })
          log.info("resurrected task to reviewing", { taskId: task.id, jobId, fromStage: task.pipeline.stage })
        } else {
          // Other stages — reset to idle (existing behavior)
          let worktreeRemoved = false
          const safeWorktree = sanitizeWorktree(task.worktree)
          if (safeWorktree) {
            try {
              await Worktree.remove({ directory: safeWorktree })
              worktreeRemoved = true
              log.info("removed worktree during resurrection", { taskId: task.id, worktree: safeWorktree })
            } catch (e) {
              log.error("failed to remove worktree during resurrection", { taskId: task.id, error: String(e) })
            }
          }
          await Store.updateTask(
            projectId,
            task.id,
            {
              status: "open",
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: null,
              pipeline: { ...task.pipeline, stage: "idle", last_activity: null },
            },
            true,
          )

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
}

function isSessionActivelyRunning(sessionId: string): boolean {
  try {
    return SessionStatus.get(sessionId).type !== "idle"
  } catch {
    // Outside of Instance context (e.g., in tests), assume session is idle
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
  const content = await Bun.file(lockPath)
    .text()
    .catch(() => null)
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
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function notifyPM(pmSessionId: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    // Validate text input
    if (!text || text.length === 0) {
      return { ok: false, error: "Notification text cannot be empty" }
    }
    if (text.length > 10000) {
      return { ok: false, error: "Notification text exceeds maximum length (10000 chars)" }
    }

    const messageId = Identifier.ascending("message")
    const partId = Identifier.ascending("part")
    const now = Date.now()

    // Validate session ID format before attempting lookup
    if (!pmSessionId || typeof pmSessionId !== "string" || pmSessionId.length < 5) {
      return { ok: false, error: "Invalid PM session ID format" }
    }

    const pmSession = await Session.get(pmSessionId).catch(() => null)
    if (!pmSession) {
      log.warn("PM session not found for notification", { pmSessionId })
      return { ok: false, error: "PM session not found" }
    }

    // Use for await to avoid loading all messages into memory
    let lastMsg: MessageV2.WithParts | null = null
    for await (const msg of MessageV2.stream(pmSessionId)) {
      lastMsg = msg
      break // Only need the first (most recent) message
    }

    // Determine parent message ID with safety checks
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

export { isPidAlive, writeLockFile, removeLockFile, readLockPid, checkTimeouts, processAdversarialVerdicts, spawnAdversarial, scheduleReadyTasks, heartbeatActiveAgents, commitTask, escalateToPM, escalateCommitFailure, notifyPM }

async function scheduleReadyTasks(jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  const job = await Store.getJob(projectId, jobId)
  if (!job) return

  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const inProgressCount = jobTasks.filter((t) => t.status === "in_progress").length

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

  const reviewingTasks = jobTasks.filter(
    (t) =>
      t.pipeline.stage === "reviewing" && !t.pipeline.adversarial_verdict && !t.assignee && t.status === "in_progress",
  )

  for (const task of reviewingTasks) {
    await spawnAdversarial(task, jobId, projectId, pmSessionId)
  }
}

async function spawnDeveloper(task: Task, jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  let worktreeInfo
  try {
    worktreeInfo = await Worktree.create({
      name: task.id,
      rootPath: path.join(Instance.directory, ".worktrees"),
    })
  } catch (e) {
    log.error("failed to create worktree", { taskId: task.id, error: String(e) })
    return
  }

  const now = new Date().toISOString()

  const parentSession = await Session.get(pmSessionId).catch(() => null)
  if (!parentSession?.directory) {
    await Worktree.remove({ directory: worktreeInfo.directory }).catch((e) =>
      log.error("failed to clean up worktree after PM session check failed", { taskId: task.id, error: String(e) }),
    )
    log.error("PM session not found", { pmSessionId, taskId: task.id })
    return
  }

  let devSession
  try {
    devSession = await Session.createNext({
      parentID: pmSessionId,
      directory: worktreeInfo.directory,
      title: `Developer: ${task.title} (developer-pipeline)`,
      permission: [],
    })
  } catch (e) {
    await Worktree.remove({ directory: worktreeInfo.directory }).catch((e) =>
      log.error("failed to clean up worktree after session creation failed", { taskId: task.id, error: String(e) }),
    )
    log.error("failed to create developer session", { taskId: task.id, error: String(e) })
    return
  }

  await Store.updateTask(
    projectId,
    task.id,
    {
      status: "in_progress",
      assignee: devSession.id,
      assignee_pid: process.pid,
      worktree: worktreeInfo.directory,
      branch: worktreeInfo.branch,
      pipeline: { ...task.pipeline, stage: "developing", last_activity: now },
    },
    true,
  )

  const prompt = buildDeveloperPrompt(task)
  try {
    await SessionPrompt.prompt({
      sessionID: devSession.id,
      agent: "developer-pipeline",
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
      log.error("failed to clean up worktree after developer prompt failed", { taskId: task.id, error: String(e) }),
    )

await Store.updateTask(
          projectId,
          task.id,
          {
            status: "open",
            assignee: null,
            assignee_pid: null,
            worktree: null,
            branch: null,
            pipeline: { ...task.pipeline, stage: "idle", last_activity: null },
          },
          true,
        )

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
      // Check: Session is actively running (prompt not finished)
      const sessionAlive = isSessionActivelyRunning(task.assignee)
      const pidAlive = task.assignee_pid ? isPidAlive(task.assignee_pid) : false
      const alive = sessionAlive && pidAlive
      const updated = await Store.getTask(projectId, task.id)
      if (!updated) continue

      if (!alive) {
        log.info("developer session ended, transitioning to review stage", { taskId: task.id })
        await Store.updateTask(projectId, task.id, {
          assignee: null,
          assignee_pid: null,
          pipeline: { ...updated.pipeline, stage: "reviewing", last_activity: now },
        }, true)
      } else {
        await Store.updateTask(projectId, task.id, {
          pipeline: { ...updated.pipeline, last_activity: now },
        }, true)
      }
    }
  }
}

async function checkTimeouts(jobId: string, projectId: string): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const now = Date.now()
  const ADVERSARIAL_TIMEOUT_MS = 30 * 60 * 1000
  const SESSION_MESSAGE_TIMEOUT_MS = 30 * 60 * 1000

  for (const task of jobTasks) {
    if (task.status === "in_progress") {
      // Note: null/undefined last_activity defaults to 0, causing immediate timeout
      // This is safe because we only check tasks with status="in_progress", not "open" tasks that may have null timestamps
      const lastActivity = task.pipeline.last_activity ? new Date(task.pipeline.last_activity).getTime() : 0

      let timedOut = false
      if (lastActivity > 0 && now - lastActivity > TIMEOUT_MS) {
        timedOut = true
        log.info("task timed out by pipeline.last_activity", { taskId: task.id, lastActivity, now })
      }

      if (!timedOut && task.assignee) {
        const msgs = await Session.messages({ sessionID: task.assignee }).catch(() => [])
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1]
          const lastMsgTime = lastMsg.info.time.created
          if (lastMsgTime && now - lastMsgTime > SESSION_MESSAGE_TIMEOUT_MS) {
            timedOut = true
            log.info("task timed out by session message activity", { taskId: task.id, lastMsgTime, now })
          }
        }
      }

      if (timedOut) {
        let worktreeRemoved = false
        if (task.worktree) {
          try {
            const safeWorktree = sanitizeWorktree(task.worktree)
            if (!safeWorktree) {
              log.error("worktree sanitization failed for timed out task", { taskId: task.id, worktree: task.worktree })
            } else {
              await Worktree.remove({ directory: safeWorktree })
              worktreeRemoved = true
            }
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

        await Store.updateTask(
          projectId,
          task.id,
          {
            status: "open",
            assignee: null,
            assignee_pid: null,
            worktree: null,
            branch: null,
            pipeline: { ...task.pipeline, stage: "idle", last_activity: null },
          },
          true,
        )

        await Store.addComment(projectId, task.id, {
          author: "system",
          message: worktreeRemoved
            ? `Timed out after 30 minutes with no activity. Worktree cleaned up.`
            : `Timed out after 30 minutes with no activity.`,
          created_at: new Date().toISOString(),
        })
      }
    }

    if (task.status === "in_progress" && task.pipeline.stage === "adversarial-running") {
      const lastActivity = task.pipeline.last_activity ? new Date(task.pipeline.last_activity).getTime() : 0

      if (lastActivity > 0 && now - lastActivity > ADVERSARIAL_TIMEOUT_MS) {
        log.info("adversarial stage timed out — resetting to reviewing", { taskId: task.id })

        await Store.updateTask(
          projectId,
          task.id,
          {
            pipeline: { ...task.pipeline, stage: "reviewing", last_activity: new Date().toISOString() },
          },
          true,
        )

        await Store.addComment(projectId, task.id, {
          author: "system",
          message: "Adversarial agent timed out after 30 minutes. Will retry on next Pulse tick.",
          created_at: new Date().toISOString(),
        })
      }
    }
  }
}

async function processAdversarialVerdicts(jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)

  for (const task of jobTasks) {
    if (task.status !== "review") continue
    if (!task.pipeline.adversarial_verdict) continue

    const verdict = task.pipeline.adversarial_verdict

    // Clear verdict immediately to prevent double-processing
    await Store.updateTask(
      projectId,
      task.id,
      {
        pipeline: { ...task.pipeline, adversarial_verdict: null, last_activity: new Date().toISOString() },
      },
      true,
    )

    // Reload to get task without the cleared verdict
    const updatedTask = await Store.getTask(projectId, task.id)
    if (!updatedTask) {
      log.error("task disappeared after clearing verdict", { taskId: task.id })
      continue
    }

     if (verdict.verdict === "APPROVED") {
       await commitTask(updatedTask, jobId, projectId, pmSessionId)
    } else {
      const newAttempt = (updatedTask.pipeline.attempt || 0) + 1
      if (newAttempt >= 3) {
        await escalateToPM(updatedTask, jobId, projectId, pmSessionId)
      } else {
        await respawnDeveloper(updatedTask, jobId, projectId, pmSessionId, newAttempt, verdict)
      }
    }
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
    // Check: Session is no longer actively running (ops commit completed)
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

  // Read final ops session message to verify commit
  const msgs = await Array.fromAsync(MessageV2.stream(opsSession.id))
  const last = msgs.find((m) => m.info.role === "assistant")
  const textPart = last?.parts.find((p): p is MessageV2.TextPart => p.type === "text" && !p.synthetic)
  const text = textPart?.text ?? ""

  // Only verify if ops produced output — empty means no messages available, treat as success
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

  // Immediately reschedule after commit — don't wait for next Pulse tick
  await scheduleReadyTasks(jobId, projectId, pmSessionId).catch((e) =>
    log.error("failed to reschedule after commit", { taskId: task.id, error: String(e) }),
  )
}

async function respawnDeveloper(
  task: Task,
  jobId: string,
  projectId: string,
  pmSessionId: string,
  attempt: number,
  verdict: AdversarialVerdict,
): Promise<void> {
  const parentSession = await Session.get(pmSessionId).catch(() => null)
  if (!parentSession?.directory) {
    log.error("PM session not found for respawn", { taskId: task.id })
    return
  }

  if (!task.worktree) {
    log.error("Task has no worktree for respawn", { taskId: task.id })
    return
  }

  let devSession
  try {
    devSession = await Session.createNext({
      parentID: pmSessionId,
      directory: task.worktree,
      title: `Developer retry #${attempt}: ${task.title}`,
      permission: [],
    })
  } catch (e) {
    log.error("failed to respawn developer", { taskId: task.id, error: String(e) })
    return
  }

  await Store.updateTask(
    projectId,
    task.id,
    {
      status: "in_progress",
      assignee: devSession.id,
      pipeline: {
        ...task.pipeline,
        attempt,
        stage: "developing",
        last_activity: new Date().toISOString(),
      },
    },
    true,
  )

  const issueLines = verdict.issues.map((i) => `  - ${i.location} [${i.severity}]: ${i.fix}`).join("\n")
  const prompt = `This is retry attempt ${attempt} of 3. The previous implementation had issues that must be fixed.

**Task:** ${task.title}
**Description:** ${task.description}
**Acceptance Criteria:** ${task.acceptance_criteria}

**Adversarial feedback — fix these before signaling complete:**
Summary: ${verdict.summary}
Issues:
${issueLines}

The codebase changes are already in this worktree. Fix the specific issues listed above, run tests, and complete your work. The pulse system automatically detects completion.`

  try {
    await SessionPrompt.prompt({
      sessionID: devSession.id,
      agent: "developer-pipeline",
      parts: [{ type: "text", text: prompt }],
    })
  } catch (e) {
    log.error("failed to spawn respawn developer prompt", {
      taskId: task.id,
      sessionId: devSession.id,
      error: String(e),
    })
    try {
      SessionPrompt.cancel(devSession.id)
    } catch {}
    await Store.updateTask(
      projectId,
      task.id,
      {
        status: "open",
        assignee: null,
        assignee_pid: null,
        pipeline: { ...task.pipeline, stage: "idle", last_activity: null },
      },
      true,
    )
    await Store.addComment(projectId, task.id, {
      author: "system",
      message: `Respawn attempt ${attempt} failed: ${String(e)}. Task reset to open.`,
      created_at: new Date().toISOString(),
    })
    return
  }

  await Store.addComment(projectId, task.id, {
    author: "system",
    message: `Developer respawned for attempt ${attempt}. Adversarial feedback provided.`,
    created_at: new Date().toISOString(),
  })
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
    message: `Failed after 3 adversarial review cycles. Last verdict: ${task.pipeline.adversarial_verdict?.summary ?? "unknown"}. Worktree preserved for PM inspection.`,
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

   log.error("task escalated to PM after 3 failures", { taskId: task.id, jobId })
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

async function spawnAdversarial(task: Task, jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  if (task.assignee) {
    log.warn("refusing to spawn adversarial: task already has assignee", { taskId: task.id, assignee: task.assignee })
    return
  }

  const parentSession = await Session.get(pmSessionId).catch(() => null)
  if (!parentSession?.directory) {
    log.error("PM session not found for adversarial spawn", { taskId: task.id })
    return
  }

  if (!task.worktree || typeof task.worktree !== "string") {
    log.error("invalid worktree for adversarial spawn", { taskId: task.id, worktree: task.worktree })
    return
  }
  const safeWorktree = task.worktree.replace(/[^\w\-./]/g, "")
  if (!safeWorktree) {
    log.error("worktree sanitization resulted in empty string", { taskId: task.id, worktree: task.worktree })
    return
  }

  let adversarialSession
  try {
    adversarialSession = await Session.createNext({
      parentID: pmSessionId,
      directory: parentSession.directory,
      title: `Adversarial: ${task.title}`,
      permission: [],
    })
  } catch (e) {
    log.error("failed to create adversarial session", { taskId: task.id, error: String(e) })
    return
  }

  await Store.updateTask(projectId, task.id, {
    pipeline: { ...task.pipeline, stage: "adversarial-running", last_activity: new Date().toISOString() },
  }, true)

  const prompt = `Review the implementation in worktree at: ${safeWorktree}

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Acceptance Criteria: ${task.acceptance_criteria}

Read the changed files in the worktree, run typecheck, and record your verdict with taskctl verdict.`

  try {
    await SessionPrompt.prompt({
      sessionID: adversarialSession.id,
      agent: "adversarial-pipeline",
      parts: [{ type: "text", text: prompt }],
    })
  } catch (e) {
    log.error("adversarial session failed to start", { taskId: task.id, error: String(e) })
    try {
      SessionPrompt.cancel(adversarialSession.id)
    } catch (e: any) {
      log.error("failed to cancel orphaned adversarial session", { sessionId: adversarialSession.id, error: String(e) })
      await Store.addComment(projectId, task.id, {
        author: "system",
        message: `⚠️ Failed to cancel orphaned adversarial session: ${adversarialSession.id}. Manual cleanup may be required.`,
        created_at: new Date().toISOString(),
      })
    }

    // Remove worktree before resetting status to prevent orphaned worktrees
    if (task.worktree) {
      const safeWorktree = sanitizeWorktree(task.worktree)
      if (safeWorktree) {
        await Worktree.remove({ directory: safeWorktree }).catch((e) =>
          log.error("failed to remove worktree after adversarial spawn failed", { taskId: task.id, error: String(e) }),
        )
      }
    }

    await Store.updateTask(
      projectId,
      task.id,
      {
        status: "open",
        assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        pipeline: { ...task.pipeline, stage: "idle", last_activity: null },
      },
      true,
    )
  }
}

async function getRecentActivity(sessionId: string): Promise<string> {
  try {
    const msgs = await Session.messages({ sessionID: sessionId, limit: 10 })
    if (!msgs || msgs.length === 0) {
      return `Session ${sessionId} is active. No message history available.`
    }

    const assistantMsgs = msgs.filter((m) => m.info.role === "assistant")
    if (assistantMsgs.length === 0) {
      return `Session ${sessionId} is active. Developer has not yet responded.`
    }

    const summary = assistantMsgs.map((_, i) => `${i + 1}. [assistant response]`).join("\n")
    return `Recent developer activity:\n${summary}`
  } catch {
    return "Unable to retrieve session history."
  }
}

async function spawnSteering(
  task: Task,
  history: string,
  pmSessionId: string,
): Promise<{ action: string; message: string | null } | null> {
  const parentSession = await Session.get(pmSessionId).catch(() => null)
  if (!parentSession?.directory) return null

  let steeringSession
  try {
    steeringSession = await Session.createNext({
      parentID: pmSessionId,
      directory: parentSession.directory,
      title: `Steering: ${task.title}`,
      permission: [],
    })
  } catch (e) {
    log.error("failed to create steering session", { taskId: task.id, error: String(e) })
    return null
  }

  const prompt = `Task: ${task.title}
Description: ${task.description}
Acceptance criteria: ${task.acceptance_criteria}

Recent developer activity:
${history}

Assess the developer's progress and respond with the appropriate JSON action.`

  try {
    await SessionPrompt.prompt({
      sessionID: steeringSession.id,
      agent: "steering",
      parts: [{ type: "text", text: prompt }],
    })
  } catch (e) {
    log.error("failed to prompt steering agent", { taskId: task.id, error: String(e) })
    return null
  }

  const maxWait = 2 * 60 * 1000
  const pollMs = 3000
  const start = Date.now()

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollMs))
    // Check: Session is no longer actively running (steering agent finished)
    const alive = isSessionActivelyRunning(steeringSession.id)
    if (!alive) break
  }

  const msgs = await Session.messages({ sessionID: steeringSession.id })
  if (!msgs || msgs.length === 0) {
    log.warn("steering session produced no messages", { taskId: task.id })
    return { action: "continue", message: null }
  }

  const assistantMsgs = msgs.filter((m) => m.info.role === "assistant")
  if (assistantMsgs.length === 0) {
    log.warn("steering session has no assistant response", { taskId: task.id })
    return { action: "continue", message: null }
  }

  const lastMsg = assistantMsgs[assistantMsgs.length - 1]
  const textParts = lastMsg.parts.filter((p) => p.type === "text")
  if (textParts.length === 0) {
    log.warn("steering agent response has no text parts", { taskId: task.id })
    return { action: "continue", message: null }
  }

  const responseText = textParts.map((p) => (p as MessageV2.TextPart).text).join("\n")

  let response
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      log.warn("steering agent response contains no JSON", { taskId: task.id })
      return { action: "continue", message: null }
    }
    response = JSON.parse(jsonMatch[0])
  } catch (e) {
    log.warn("failed to parse steering agent JSON response", { taskId: task.id, error: String(e) })
    return { action: "continue", message: null }
  }

  if (!response.action || typeof response.action !== "string") {
    log.warn("steering response missing action field", { taskId: task.id })
    return { action: "continue", message: null }
  }

  return { action: response.action, message: response.message ?? null }
}

async function checkSteering(jobId: string, projectId: string, pmSessionId: string): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const now = new Date()

  for (const task of jobTasks) {
    if (task.status !== "in_progress") continue
    if (task.pipeline.stage === "adversarial-running" || task.pipeline.stage === "reviewing") continue

    const lastSteering = task.pipeline.last_steering ? new Date(task.pipeline.last_steering) : new Date(0)
    const minutesSince = (now.getTime() - lastSteering.getTime()) / 60_000
    if (minutesSince < 15) continue

    if (!task.assignee) continue

    // Check: Session is actively running (developer still working)
    const sessionAlive = isSessionActivelyRunning(task.assignee)
    if (!sessionAlive) continue

    const history = await getRecentActivity(task.assignee)

    const result = await spawnSteering(task, history, pmSessionId)
    if (!result) {
      await Store.updateTask(
        projectId,
        task.id,
        {
          pipeline: { ...task.pipeline, last_steering: now.toISOString() },
        },
        true,
      )
      continue
    }

    await Store.updateTask(
      projectId,
      task.id,
      {
        pipeline: { ...task.pipeline, last_steering: now.toISOString() },
      },
      true,
    )

    if (result.action === "continue") {
      log.info("steering: continue", { taskId: task.id })
    } else if (result.action === "steer") {
      log.info("steering: sending guidance", { taskId: task.id, message: result.message })
      if (task.assignee) {
        const sessionId = task.assignee
        try {
          await SessionPrompt.prompt({
            sessionID: sessionId,
            agent: "developer-pipeline",
            parts: [{ type: "text", text: `[Steering guidance]: ${result.message}` }],
          })
        } catch (e) {
          log.error("failed to send steering message", { taskId: task.id, error: String(e) })
        }
      }

      await Store.addComment(projectId, task.id, {
        author: "system",
        message: `Steering guidance sent: ${result.message}`,
        created_at: now.toISOString(),
      })
    } else if (result.action === "replace") {
      log.info("steering: replacing developer", { taskId: task.id, reason: result.message })

      if (task.assignee) {
        try {
          SessionPrompt.cancel(task.assignee)
        } catch {}
      }

      await Store.updateTask(
        projectId,
        task.id,
        {
          status: "open",
          assignee: null,
          assignee_pid: null,
          pipeline: {
            ...task.pipeline,
            stage: "idle",
            last_activity: null,
            last_steering: now.toISOString(),
          },
        },
        true,
      )

      await Store.addComment(projectId, task.id, {
        author: "system",
        message: `Developer replaced by steering agent: ${result.message}. Task reset to open — Pulse will reschedule.`,
        created_at: now.toISOString(),
      })
    }
  }
}

export async function checkCompletion(
  jobId: string,
  projectId: string,
  pmSessionId: string,
  interval: ReturnType<typeof setInterval>,
): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const allClosed = jobTasks.every((t) => t.status === "closed")

  if (allClosed) {
    log.info("all tasks completed", { jobId })
    try {
      clearIntervalSafe(interval)
      activeTicks.get(projectId)?.delete(jobId)
      await removeLockFile(jobId, projectId)
       await Store.updateJob(projectId, jobId, { status: "complete" })
       Bus.publish(BackgroundTaskEvent.Completed, { taskID: jobId, sessionID: pmSessionId, parentSessionID: undefined })
       const notifyResult = await notifyPM(pmSessionId, `🎉 Job complete: all tasks done for issue #${jobTasks[0]?.parent_issue ?? "unknown"}`)
       if (!notifyResult.ok) {
         log.warn("failed to notify PM of job completion", { jobId, error: notifyResult.error })
       }
    } catch (e) {
      activeTicks.get(projectId)?.delete(jobId)
      await removeLockFile(jobId, projectId).catch(() => {})
    }
  }
}

async function gracefulStop(jobId: string, projectId: string, interval: ReturnType<typeof setInterval>): Promise<void> {
  log.info("graceful stop requested", { jobId })

  try {
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
          const safeWorktree = sanitizeWorktree(task.worktree)
          if (!safeWorktree) {
            log.error("worktree sanitization failed during graceful stop", { taskId: task.id, worktree: task.worktree })
          } else {
            await Worktree.remove({ directory: safeWorktree })
            worktreeRemoved = true
          }
        } catch (e) {
          log.error("failed to remove worktree during graceful stop", { taskId: task.id, error: String(e) })
        }
      }

await Store.updateTask(
          projectId,
          task.id,
          {
            status: "open",
            assignee: null,
            assignee_pid: null,
            worktree: null,
            branch: null,
            pipeline: { ...task.pipeline, stage: "idle", last_activity: null },
          },
          true,
        )

      await Store.addComment(projectId, task.id, {
        author: "system",
        message: worktreeRemoved ? "Job stopped by PM. Worktree cleaned up." : "Job stopped by PM.",
        created_at: new Date().toISOString(),
      })
    }

    clearIntervalSafe(interval)
    await removeLockFile(jobId, projectId)
    await Store.updateJob(projectId, jobId, { status: "stopped" })
  } catch (e) {
    log.error("graceful stop encountered error", { jobId, error: String(e) })
  } finally {
    activeTicks.get(projectId)?.delete(jobId)
  }

  log.info("graceful stop completed", { jobId })
}
