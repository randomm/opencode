import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { Worktree } from "../worktree"
import { Log } from "../util/log"
import { Store } from "./store"
import { sanitizeWorktree, isSessionActivelyRunning, isPidAlive } from "./pulse-scheduler"
import type { Task } from "./types"

const log = Log.create({ service: "taskctl.pulse.monitoring" })

const TIMEOUT_MS = 30 * 60 * 1000

export async function heartbeatActiveAgents(jobId: string, projectId: string): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const now = new Date().toISOString()

  for (const task of jobTasks) {
    if (task.status === "in_progress" && task.assignee) {
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

export async function checkTimeouts(jobId: string, projectId: string): Promise<void> {
  const allTasks = await Store.listTasks(projectId)
  const jobTasks = allTasks.filter((t) => t.job_id === jobId)
  const now = Date.now()
  const ADVERSARIAL_TIMEOUT_MS = 30 * 60 * 1000
  const SESSION_MESSAGE_TIMEOUT_MS = 30 * 60 * 1000

  for (const task of jobTasks) {
    if (task.status === "in_progress") {
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

  const responseText = textParts.map((p) => (p as any).text).join("\n")

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

export async function checkSteering(jobId: string, projectId: string, pmSessionId: string): Promise<void> {
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

    const sessionAlive = isSessionActivelyRunning(task.assignee)
    if (!sessionAlive) continue

    const history = await getRecentActivity(task.assignee)

    const result = await spawnSteering(task, history, pmSessionId)

    await Store.updateTask(
      projectId,
      task.id,
      {
        pipeline: { ...task.pipeline, last_steering: now.toISOString() },
      },
      true,
    )

    if (!result) {
      continue
    }

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

export async function gracefulStop(
  jobId: string,
  projectId: string,
  intervalId: ReturnType<typeof setInterval>,
): Promise<void> {
  const clearIntervalSafe = async (interval: ReturnType<typeof setInterval>) => {
    clearInterval(interval)
  }

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

    await clearIntervalSafe(intervalId)
    log.info("graceful stop completed", { jobId })
  } catch (e) {
    log.error("graceful stop encountered error", { jobId, error: String(e) })
  }
}