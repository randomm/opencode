import { GlobalBus } from "../bus/global"
import { Log } from "../util/log"
import { Bus } from "../bus"
import { BackgroundTaskEvent } from "../session/async-tasks"
import { Instance, context as instanceContext } from "../project/instance"
import { Store } from "./store"
import { MessageV2 } from "../session/message-v2"
import { Provider } from "../provider/provider"
import {
  writeLockFile,
  removeLockFile,
  readLockPid,
  isPidAlive,
  isSessionActivelyRunning,
  scheduleReadyTasks,
  sanitizeWorktree,
} from "./pulse-scheduler"
import { processAdversarialVerdicts, notifyPM, escalateToPM, createPRForJob } from "./pulse-verdicts"
import { heartbeatActiveAgents, checkTimeouts, checkSteering, gracefulStop } from "./pulse-monitoring"

// Re-exports for backward compatibility with tests
export {
  writeLockFile,
  removeLockFile,
  readLockPid,
  isPidAlive,
  isSessionActivelyRunning,
  scheduleReadyTasks,
  sanitizeWorktree,
} from "./pulse-scheduler"
export { processAdversarialVerdicts, notifyPM, escalateToPM, createPRForJob } from "./pulse-verdicts"
export { heartbeatActiveAgents, checkTimeouts, checkSteering, gracefulStop } from "./pulse-monitoring"

const log = Log.create({ service: "taskctl.pulse" })
const activeTicks = new Map<string, Set<string>>()

export async function resolveModel(pmSessionId: string): Promise<{ modelID: string; providerID: string }> {
  for await (const msg of MessageV2.stream(pmSessionId)) {
    if (msg.info.role === "assistant") {
      return { modelID: msg.info.modelID, providerID: msg.info.providerID }
    }
  }
  return Provider.defaultModel()
}
const intervalListeners = new Map<ReturnType<typeof setInterval>, (event: { directory?: string | undefined; payload: any }) => void>()

function clearIntervalSafe(interval: ReturnType<typeof setInterval>) {
  const listener = intervalListeners.get(interval)
  if (listener) {
    GlobalBus.off("event", listener)
    intervalListeners.delete(interval)
  }
  clearInterval(interval)
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
  
  // Guard: only resurrect tasks if job exists and is running (prevent resurrecting deleted job's tasks)
  const job = await Store.getJob(projectId, jobId)
  if (!job || job.status !== "running") {
    return
  }
  
  const { isPidAlive } = await import("./pulse-scheduler")
  const { sanitizeWorktree } = await import("./pulse-scheduler")

  for (const task of jobTasks) {
    if (task.status === "in_progress" || task.status === "review") {
      const pidAlive = task.assignee_pid ? isPidAlive(task.assignee_pid) : false
      const sessionAlive = task.assignee && isSessionActivelyRunning(task.assignee)
      const alive = pidAlive || sessionAlive

      if (!alive) {
        if (task.pipeline.stage === "developing" || task.pipeline.stage === "adversarial-running") {
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
          let worktreeRemoved = false
          const safeWorktree = sanitizeWorktree(task.worktree)
          if (safeWorktree) {
            const { Worktree } = await import("../worktree")
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
              base_commit: null,
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

      // Create PR for the job
      const issueNumber = jobTasks[0]?.parent_issue ?? 0
      const prResult = await createPRForJob(projectId, jobTasks, pmSessionId, issueNumber)
      if (prResult.ok) {
        log.info("PR created successfully", { jobId, prUrl: prResult.prUrl })
        const notifyResult = await notifyPM(
          pmSessionId,
          `🎉 Job complete: all tasks done for issue #${jobTasks[0]?.parent_issue ?? "unknown"}\n\nPR created: ${prResult.prUrl}`,
        )
        if (!notifyResult.ok) {
          log.warn("failed to notify PM of job completion with PR", { jobId, error: notifyResult.error })
        }
      } else {
        log.warn("failed to create PR for completed job", { jobId, error: prResult.error })
        const notifyResult = await notifyPM(
          pmSessionId,
          `🎉 Job complete: all tasks done for issue #${jobTasks[0]?.parent_issue ?? "unknown"}\n\n⚠️ PR creation failed: ${prResult.error}`,
        )
        if (!notifyResult.ok) {
          log.warn("failed to notify PM of job completion", { jobId, error: notifyResult.error })
        }
      }
    } catch (e) {
      activeTicks.get(projectId)?.delete(jobId)
      await removeLockFile(jobId, projectId).catch(() => {})
      log.error("error during job completion", { jobId, error: String(e) })
    }
  }
}