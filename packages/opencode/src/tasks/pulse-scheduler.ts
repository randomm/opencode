import fs from "fs/promises"
import os from "os"
import path from "path"
import { $ } from "bun"
import { Session } from "../session"
import { Worktree } from "../worktree"
import { SessionPrompt } from "../session/prompt"
import { SessionStatus } from "../session/status"
import { MessageV2 } from "../session/message-v2"
import { Instance, context as instanceContext } from "../project/instance"
import { GlobalBus } from "../bus/global"
import { Log } from "../util/log"
import { Store } from "./store"
import { Scheduler } from "./scheduler"
import { Global } from "../global"
import { Instance as InstanceImport } from "../project/instance"
import type { Task, AdversarialVerdict } from "./types"
import { MAX_ADVERSARIAL_ATTEMPTS } from "./pulse-verdicts"
import { resolveModel } from "./pulse"
import * as PulseUtils from "./pulse-utils"

const log = Log.create({ service: "taskctl.pulse.scheduler" })

async function lockFilePath(jobId: string, projectId: string): Promise<string> {
  let tasksDir: string
  try {
    const worktree = Instance.worktree
    tasksDir = path.join(worktree, ".opencode", "tasks", projectId)
  } catch {
    // Fallback for tests without Instance context
    tasksDir = path.join(Global.Path.data, "tasks", projectId)
  }

  // Safe fallback: if path resolves to /.opencode or /, use tmpdir
  if (tasksDir.startsWith("/.opencode") || tasksDir === "/") {
    tasksDir = path.join(os.tmpdir(), "opencode-tasks-test", projectId)
  }

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
  const { platform } = require("os")
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

function isSessionActivelyRunning(sessionId: string): boolean {
  try {
    return SessionStatus.get(sessionId).type !== "idle"
  } catch {
    return false
  }
}

function sanitizeWorktree(worktree: string | null | undefined): string | null {
  if (!worktree || typeof worktree !== "string") return null
  if (worktree.includes("..")) return null
  return path.resolve(worktree)
}

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
      rootPath: path.join(InstanceImport.directory, ".worktrees"),
    })
  } catch (e) {
    log.error("failed to create worktree", { taskId: task.id, error: String(e) })
    return
  }

  const now = new Date().toISOString()

  // Detect the default branch dynamically
  let base: string
  try {
    base = await PulseUtils.defaultBranch(worktreeInfo.directory)
  } catch (e) {
    log.warn("failed to detect default branch, using fallback", { taskId: task.id, error: String(e) })
    base = "dev"
  }

  let baseBranchExists = false
  try {
    const res = await $`git rev-parse --verify ${base}`.quiet().nothrow().cwd(worktreeInfo.directory)
    if (res.exitCode === 0) {
      baseBranchExists = true
    }
  } catch (e) {
    log.warn("failed to verify base branch exists", { taskId: task.id, baseBranch: base, error: String(e) })
  }

  let baseCommit: string | null = null
  if (baseBranchExists) {
    try {
      const res = await $`git merge-base ${base} HEAD`.quiet().nothrow().cwd(worktreeInfo.directory)
      if (res.exitCode === 0 && res.stdout) {
        baseCommit = new TextDecoder().decode(res.stdout).trim()
      }

      if (baseCommit) {
        const headRes = await $`git rev-parse HEAD`.quiet().nothrow().cwd(worktreeInfo.directory)
        if (headRes.exitCode === 0 && headRes.stdout) {
          const headCommit = new TextDecoder().decode(headRes.stdout).trim()
          if (baseCommit === headCommit) {
            log.warn("worktree HEAD equals merge-base (likely worktree-on-base), setting base_commit to null", {
              taskId: task.id,
              base_commit: baseCommit,
              base_branch: base,
            })
            baseCommit = null
          }
        }
      }
    } catch (e) {
      log.warn("failed to capture base_commit", { taskId: task.id, baseBranch: base, error: String(e) })
    }
  } else {
    log.warn("base branch not found in worktree, skipping merge-base capture", { taskId: task.id, baseBranch: base })
  }

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
      base_commit: baseCommit,
      pipeline: { ...task.pipeline, stage: "developing", last_activity: now },
    },
    true,
  )

  const model = await resolveModel(pmSessionId)
  const prompt = buildDeveloperPrompt(task, worktreeInfo.directory, worktreeInfo.branch)
  try {
    await SessionPrompt.prompt({
      sessionID: devSession.id,
      agent: "developer-pipeline",
      model,
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

function buildDeveloperPrompt(task: Task, worktreeDir: string, branch: string): string {
  const directiveHeader = `⛔ CRITICAL: YOUR WORKING DIRECTORY IS: ${worktreeDir}
⛔ Branch: ${branch}

YOUR FIRST ACTION — run pwd and confirm output matches exactly: ${worktreeDir}
If pwd output does NOT match → STOP immediately, report the mismatch, do not touch any files.

ABSOLUTE RULES:
- NEVER use relative paths like ../ or ../Claude or ../anything
- ALL file paths must start with ${worktreeDir}
- NEVER navigate outside this directory
- The project package is at ${worktreeDir}/packages/opencode/
- Tests go in ${worktreeDir}/packages/opencode/test/
- Source goes in ${worktreeDir}/packages/opencode/src/
- Run commands from ${worktreeDir}/packages/opencode/
`

  return `${directiveHeader}
Implement the following task with TDD:

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
  const safeWorktree = sanitizeWorktree(task.worktree)
  if (!safeWorktree) {
    log.error("worktree sanitization failed or resulted in null", { taskId: task.id, worktree: task.worktree })
    return
  }

  await Store.updateTask(projectId, task.id, {
    pipeline: { ...task.pipeline, stage: "adversarial-running", last_activity: new Date().toISOString() },
  }, true)

  // Check if developer committed changes
  const hasChanges = await PulseUtils.hasCommittedChanges(safeWorktree, task.base_commit)
  if (!hasChanges) {
    await Store.addComment(projectId, task.id, {
      author: "system",
      message: "No committed changes found. Developer wrote code but did not commit. Respawning developer.",
      created_at: new Date().toISOString(),
    })
    await Store.updateTask(projectId, task.id, {
      pipeline: { ...task.pipeline, stage: "developing", last_activity: new Date().toISOString() },
    }, true)
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

  const validatedBaseCommit = PulseUtils.validateBaseCommit(task.base_commit) ?? "dev"
  const baseCommitStr = task.base_commit ? `Base Commit: ${validatedBaseCommit}` : "Base Commit: Not captured"
  const prompt = `Review the implementation in worktree at: ${safeWorktree}

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Acceptance Criteria: ${task.acceptance_criteria}
${baseCommitStr}

When reviewing changes, use git diff to see ONLY the developer's changes:
\`\`\`bash
cd ${safeWorktree}
git diff ${validatedBaseCommit}..HEAD
\`\`\`

This ensures you only review changes made by the developer, not commits that were already in the base branch.

  Read the changed files in the worktree, run typecheck, and record your verdict with taskctl verdict.`

  const model = await resolveModel(pmSessionId)
  try {
    await SessionPrompt.prompt({
      sessionID: adversarialSession.id,
      agent: "adversarial-pipeline",
      model,
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
        base_commit: null,
        pipeline: { ...task.pipeline, stage: "idle", last_activity: null },
      },
      true,
    )
  }
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

  const safeWorktree = sanitizeWorktree(task.worktree)
  if (!safeWorktree) {
    log.error("worktree sanitization failed for respawn", { taskId: task.id, worktree: task.worktree })
    return
  }

  let devSession
  try {
    devSession = await Session.createNext({
      parentID: pmSessionId,
      directory: safeWorktree,
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

  const directiveHeader = `⛔ CRITICAL: YOUR WORKING DIRECTORY IS: ${safeWorktree}
⛔ Branch: ${task.branch}

YOUR FIRST ACTION — run pwd and confirm output matches exactly: ${safeWorktree}
If pwd output does NOT match → STOP immediately, report the mismatch, do not touch any files.

ABSOLUTE RULES:
- NEVER use relative paths like ../ or ../Claude or ../anything
- ALL file paths must start with ${safeWorktree}
- NEVER navigate outside this directory
- The project package is at ${safeWorktree}/packages/opencode/
- Tests go in ${safeWorktree}/packages/opencode/test/
- Source goes in ${safeWorktree}/packages/opencode/src/
- Run commands from ${safeWorktree}/packages/opencode/
`

  const issueLines = verdict.issues.map((i) => `  - ${i.location} [${i.severity}]: ${i.fix}`).join("\n")
  const prompt = `${directiveHeader}This is retry attempt ${attempt} of ${MAX_ADVERSARIAL_ATTEMPTS}. The previous implementation had issues that must be fixed.

**Task:** ${task.title}
**Description:** ${task.description}
**Acceptance Criteria:** ${task.acceptance_criteria}

**Adversarial feedback — fix these before signaling complete:**
Summary: ${verdict.summary}
Issues:
${issueLines}

Follow TDD for any fixes:
1. Write failing test(s) for each issue
2. Fix the code to make tests pass
3. Run all tests to verify nothing broke
4. Only implement what's explicitly requested in the feedback

Important: Continue following the same TDD discipline as the initial implementation. The codebase changes are already in this worktree. Fix the specific issues listed above, run tests, and complete your work. The pulse system automatically detects completion.`

  const model = await resolveModel(pmSessionId)
  try {
    await SessionPrompt.prompt({
      sessionID: devSession.id,
      agent: "developer-pipeline",
      model,
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

export { scheduleReadyTasks, spawnDeveloper, spawnAdversarial, respawnDeveloper, sanitizeWorktree, writeLockFile, removeLockFile, readLockPid, isPidAlive, isSessionActivelyRunning, lockFilePath }
