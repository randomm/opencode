import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { Store } from "../../src/tasks/store"
import { Global } from "../../src/global"
import { gracefulStop } from "../../src/tasks/pulse-monitoring"
import type { Task, Job } from "../../src/tasks/types"
import path from "path"
import { randomUUID } from "crypto"
import fs from "fs/promises"

let testDataDir: string

beforeEach(async () => {
  testDataDir = path.join("/tmp", "opencode-pulse-monitoring-test-" + Math.random().toString(36).slice(2))
  await fs.mkdir(testDataDir, { recursive: true })
  process.env.OPENCODE_TEST_HOME = testDataDir
  await Global.init()
})

afterEach(async () => {
  await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {})
})

function getProjectId(): string {
  return `test-pulse-monitoring-${randomUUID()}`
}

function createJob(override: Partial<Job>): Job {
  return {
    id: `job-${randomUUID()}`,
    parent_issue: 1,
    status: "running",
    created_at: new Date().toISOString(),
    stopping: false,
    pulse_pid: 12345,
    max_workers: 4,
    pm_session_id: randomUUID(),
    ...override,
  }
}

function createTask(override: Partial<Task>): Task {
  const now = new Date().toISOString()
  return {
    id: `task-${randomUUID()}`,
    title: "Test task",
    description: "Test description",
    acceptance_criteria: "Test criteria",
    parent_issue: 1,
    job_id: "job-1",
    status: "in_progress",
    priority: 2,
    task_type: "implementation",
    labels: [],
    depends_on: [],
    assignee: null,
    assignee_pid: null,
    worktree: null,
    branch: null,
    base_commit: null,
    created_at: now,
    updated_at: now,
    close_reason: null,
    comments: [],
    pipeline: {
      stage: "developing",
      attempt: 0,
      last_activity: now,
      last_steering: null,
      history: [],
      adversarial_verdict: null,
    },
    ...override,
  }
}

describe("pulse-monitoring: gracefulStop", () => {
  test("removes lock file and clears pulse_pid on graceful stop", async () => {
    const projectId = getProjectId()
    const jobId = randomUUID()

    const job = createJob({ id: jobId, pulse_pid: 12345 })
    await Store.createJob(projectId, job)

    const task1 = createTask({ job_id: jobId })
    await Store.createTask(projectId, task1)

    const lockFilePath = path.join(Global.Path.data, "tasks", projectId, `job-${jobId}.lock`)
    await Bun.write(lockFilePath, String(process.pid))

    const intervalId = setInterval(() => {}, 1000) as ReturnType<typeof setInterval>

    await gracefulStop(jobId, projectId, intervalId)

    const lockFileExists = await fs.access(lockFilePath).then(() => true).catch(() => false)
    expect(lockFileExists).toBe(false)

    const updatedJob = await Store.getJob(projectId, jobId)
    expect(updatedJob).not.toBeNull()
    expect(updatedJob!.pulse_pid).toBeNull()
    expect(updatedJob!.status).toBe("stopped")
  })

  test("clears pulse_pid even when lock file doesn't exist", async () => {
    const projectId = getProjectId()
    const jobId = randomUUID()

    const job = createJob({ id: jobId, pulse_pid: 54321 })
    await Store.createJob(projectId, job)

    const intervalId = setInterval(() => {}, 1000) as ReturnType<typeof setInterval>

    await gracefulStop(jobId, projectId, intervalId)

    const updatedJob = await Store.getJob(projectId, jobId)
    expect(updatedJob).not.toBeNull()
    expect(updatedJob!.pulse_pid).toBeNull()
    expect(updatedJob!.status).toBe("stopped")
  })

  test("handles errors in lock file removal gracefully", async () => {
    const projectId = getProjectId()
    const jobId = randomUUID()

    const job = createJob({ id: jobId, pulse_pid: 99999 })
    await Store.createJob(projectId, job)

    const intervalId = setInterval(() => {}, 1000) as ReturnType<typeof setInterval>

    await gracefulStop(jobId, projectId, intervalId)

    const updatedJob = await Store.getJob(projectId, jobId)
    expect(updatedJob).not.toBeNull()
    expect(updatedJob!.pulse_pid).toBeNull()
  })

  test("removes lock file before updating job status (prevents race condition)", async () => {
    const projectId = getProjectId()
    const jobId = randomUUID()

    const job = createJob({ id: jobId, pulse_pid: 11111 })
    await Store.createJob(projectId, job)

    const lockFilePath = path.join(Global.Path.data, "tasks", projectId, `job-${jobId}.lock`)
    await Bun.write(lockFilePath, String(process.pid))

    const intervalId = setInterval(() => {}, 1000) as ReturnType<typeof setInterval>

    let lockRemovedBeforeJobUpdate = false
    const originalUpdate = Store.updateJob.bind(Store)
    Store.updateJob = async function(...args: Parameters<typeof Store.updateJob>) {
      const lockExists = await fs.access(lockFilePath).then(() => true).catch(() => false)
      lockRemovedBeforeJobUpdate = !lockExists
      return originalUpdate(...args)
    }

    await gracefulStop(jobId, projectId, intervalId)

    Store.updateJob = originalUpdate

    expect(lockRemovedBeforeJobUpdate).toBe(true)

    const updatedJob = await Store.getJob(projectId, jobId)
    expect(updatedJob!.status).toBe("stopped")
    expect(updatedJob!.pulse_pid).toBeNull()
  })
})