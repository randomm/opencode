import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { executeStatus } from "../../src/tasks/job-commands"
import { Store } from "../../src/tasks/store"
import type { Task, Job } from "../../src/tasks/types"
import { Global } from "../../src/global"
import path from "path"
import fs from "fs/promises"

async function withTestProject(fn: (projectId: string) => Promise<void>) {
  const projectId = `test-${Date.now()}`
  const tasksDir = path.join(Global.Path.data, "tasks", projectId)

  try {
    await fn(projectId)
  } finally {
    await fs.rm(tasksDir, { recursive: true, force: true }).catch(() => {})
  }
}

describe("taskctl start (terminal state rejection)", () => {
  test("rejects jobs with complete status", async () => {
    await withTestProject(async (projectId) => {
      const jobId = "job-complete"
      const issueNumber = 123

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "complete",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const job = await Store.getJob(projectId, jobId)
      expect(job).not.toBeNull()
      expect(job?.status).toBe("complete")
    })
  })

  test("rejects jobs with failed status", async () => {
    await withTestProject(async (projectId) => {
      const jobId = "job-failed"
      const issueNumber = 124

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "failed",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const job = await Store.getJob(projectId, jobId)
      expect(job).not.toBeNull()
      expect(job?.status).toBe("failed")
    })
  })

  test("rejects jobs with stopped status", async () => {
    await withTestProject(async (projectId) => {
      const jobId = "job-stopped"
      const issueNumber = 125

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "stopped",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const job = await Store.getJob(projectId, jobId)
      expect(job).not.toBeNull()
      expect(job?.status).toBe("stopped")
    })
  })
})

describe("taskctl stop", () => {
  test("sets stopping flag", async () => {
    await withTestProject(async (projectId) => {
      const jobId = "job-test"
      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: 1,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const { readLockPid, removeLockFile } = await import("../../src/tasks/pulse")

      const job = await Store.getJob(projectId, jobId)
      const existingPid = await readLockPid(jobId, projectId)
      if (existingPid !== null) {
        await removeLockFile(jobId, projectId)
      }

      await Store.updateJob(projectId, jobId, { stopping: true })

      const updated = await Store.getJob(projectId, jobId)
      expect(updated?.stopping).toBe(true)
    })
  })

  test("rejects non-running jobs", async () => {
    await withTestProject(async (projectId) => {
      const jobId = "job-test"
      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: 1,
        status: "complete",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const job = await Store.getJob(projectId, jobId)
      expect(job?.status).toBe("complete")
      expect(job?.stopping).toBe(false)
    })
  })
})

describe("taskctl inspect", () => {
  test("shows full task history", async () => {
    await withTestProject(async (projectId) => {
      const now = new Date().toISOString()
      const task: Task = {
        id: "test-task",
        title: "Test Task",
        description: "Test description",
        acceptance_criteria: "Test criteria",
        parent_issue: 1,
        job_id: "job-test",
        status: "failed",
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
        close_reason: "test failure",
        comments: [
          { author: "developer", message: "Working on it", created_at: now },
          { author: "system", message: "Task failed", created_at: now },
        ],
        pipeline: {
          stage: "failed",
          attempt: 3,
          last_activity: now,
          last_steering: null,
          history: [
            { from: "idle", to: "developing", attempt: 1, timestamp: now, message: "Started" },
            { from: "developing", to: "reviewing", attempt: 1, timestamp: now, message: "Developer done" },
          ],
          adversarial_verdict: {
            verdict: "ISSUES_FOUND",
            issues: [
              { location: "src/test.ts:42", severity: "HIGH", fix: "Add null check" },
            ],
            summary: "Missing null check",
            created_at: new Date().toISOString(),
          },
        },
      }

      await Store.createTask(projectId, task)

      const retrieved = await Store.getTask(projectId, "test-task")
      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe("test-task")
      expect(retrieved?.status).toBe("failed")
      expect(retrieved?.close_reason).toBe("test failure")
      expect(retrieved?.comments.length).toBe(2)
      expect(retrieved?.pipeline.attempt).toBe(3)
      expect(retrieved?.pipeline.history.length).toBe(2)
      expect(retrieved?.pipeline.adversarial_verdict?.verdict).toBe("ISSUES_FOUND")
      expect(retrieved?.pipeline.adversarial_verdict?.issues.length).toBe(1)
    })
  })
})

describe("taskctl override --skip", () => {
  test("closes task with skip reason", async () => {
    await withTestProject(async (projectId) => {
      const now = new Date().toISOString()
      const task: Task = {
        id: "test-task",
        title: "Test Task",
        description: "Test description",
        acceptance_criteria: "Test criteria",
        parent_issue: 1,
        job_id: "job-test",
        status: "failed",
        priority: 2,
        task_type: "implementation",
        labels: [],
        depends_on: [],
        assignee: null,
        assignee_pid: null,
        worktree: "/tmp/test-worktree",
        branch: "feature/test",
        base_commit: null,
        created_at: now,
        updated_at: now,
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "failed",
          attempt: 3,
          last_activity: now,
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }

      await Store.createTask(projectId, task)

      await Store.updateTask(projectId, "test-task", {
        status: "closed",
        close_reason: "skipped by PM",
        worktree: null,
        branch: null,
        assignee: null,
        assignee_pid: null,
        pipeline: { ...task.pipeline, stage: "done" },
      }, true)

      const retrieved = await Store.getTask(projectId, "test-task")
      expect(retrieved).not.toBeNull()
      expect(retrieved?.status).toBe("closed")
      expect(retrieved?.close_reason).toBe("skipped by PM")
      expect(retrieved?.worktree).toBeNull()
      expect(retrieved?.branch).toBeNull()
      expect(retrieved?.assignee).toBeNull()
      expect(retrieved?.pipeline.stage).toBe("done")
    })
  })
})

describe("taskctl retry", () => {
  test("resets task to open with cleared pipeline state", async () => {
    await withTestProject(async (projectId) => {
      const now = new Date().toISOString()
      const task: Task = {
        id: "test-task",
        title: "Test Task",
        description: "Test description",
        acceptance_criteria: "Test criteria",
        parent_issue: 1,
        job_id: "job-test",
        status: "failed",
        priority: 2,
        task_type: "implementation",
        labels: [],
        depends_on: [],
        assignee: "session-test",
        assignee_pid: 12345,
        worktree: "/tmp/test-worktree",
        branch: "feature/test",
        base_commit: null,
        created_at: now,
        updated_at: now,
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "failed",
          attempt: 3,
          last_activity: now,
          last_steering: now,
          history: [
            { from: "idle", to: "developing", attempt: 1, timestamp: now, message: "Started" },
          ],
          adversarial_verdict: {
            verdict: "CRITICAL_ISSUES_FOUND",
            issues: [],
            summary: "Critical issues",
            created_at: new Date().toISOString(),
          },
        },
      }

      await Store.createTask(projectId, task)

      await Store.updateTask(projectId, "test-task", {
         status: "open",
         assignee: null,
         assignee_pid: null,
         worktree: null,
         branch: null,
         pipeline: {
           ...task.pipeline,
           stage: "idle",
           attempt: 1,
           adversarial_verdict: null,
           last_activity: null,
         },
       }, true)

      const retrieved = await Store.getTask(projectId, "test-task")
      expect(retrieved).not.toBeNull()
      expect(retrieved?.status).toBe("open")
      expect(retrieved?.assignee).toBeNull()
      expect(retrieved?.worktree).toBeNull()
      expect(retrieved?.pipeline.stage).toBe("idle")
      expect(retrieved?.pipeline.attempt).toBe(1)
      expect(retrieved?.pipeline.adversarial_verdict).toBeNull()
      expect(retrieved?.pipeline.last_activity).toBeNull()
    })
  })
})

describe("taskctl status - elapsed time", () => {
  let testDataDir: string

  beforeEach(async () => {
    testDataDir = path.join("/tmp", "opencode-status-test-" + Math.random().toString(36).slice(2))
    await fs.mkdir(testDataDir, { recursive: true })
    process.env.OPENCODE_TEST_HOME = testDataDir
    await Global.init()
  })

  afterEach(async () => {
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {})
    delete process.env.OPENCODE_TEST_HOME
  })

  test("includes elapsed time for in-progress pipeline stage", async () => {
    const projectId = `test-status-elapsed-${Date.now()}`
    const jobId = `job-status-elapsed-${Date.now()}`
    const issueNumber = 999
    const lastActivity = new Date(Date.now() - 272000).toISOString() // 4m 32s ago

    await Store.createJob(projectId, {
      id: jobId,
      parent_issue: issueNumber,
      status: "running",
      created_at: new Date().toISOString(),
      stopping: false,
      pulse_pid: null,
      max_workers: 3,
      pm_session_id: "pm-test",
      feature_branch: null,
    })

    const task: Task = {
      id: "task-elapsed-1",
      title: "Test task",
      description: "Test",
      acceptance_criteria: "Test",
      parent_issue: issueNumber,
      job_id: jobId,
      status: "in_progress",
      priority: 1,
      task_type: "implementation",
      labels: [],
      depends_on: [],
      assignee: null,
      assignee_pid: null,
      worktree: null,
      branch: null,
      base_commit: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      close_reason: null,
      comments: [],
      pipeline: {
        stage: "adversarial-running",
        attempt: 1,
        last_activity: lastActivity,
        last_steering: null,
        history: [],
        adversarial_verdict: null,
      },
    }

    await Store.createTask(projectId, task)

    const result = await executeStatus(projectId, { issueNumber })

    expect(result.output).toContain("adversarial-running")
    expect(result.output).toContain("attempt 1")
    expect(result.output).toMatch(/Pipeline: adversarial-running \(attempt 1, \d+m \d+s\)/)
  })

  test("omits elapsed suffix when last_activity is null", async () => {
    const projectId = `test-status-no-elapsed-${Date.now()}`
    const jobId = `job-status-no-elapsed-${Date.now()}`
    const issueNumber = 998

    await Store.createJob(projectId, {
      id: jobId,
      parent_issue: issueNumber,
      status: "running",
      created_at: new Date().toISOString(),
      stopping: false,
      pulse_pid: null,
      max_workers: 3,
      pm_session_id: "pm-test",
      feature_branch: null,
    })

    const task: Task = {
      id: "task-no-elapsed-1",
      title: "Test task",
      description: "Test",
      acceptance_criteria: "Test",
      parent_issue: issueNumber,
      job_id: jobId,
      status: "in_progress",
      priority: 1,
      task_type: "implementation",
      labels: [],
      depends_on: [],
      assignee: null,
      assignee_pid: null,
      worktree: null,
      branch: null,
      base_commit: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      close_reason: null,
      comments: [],
      pipeline: {
        stage: "developing",
        attempt: 1,
        last_activity: null,
        last_steering: null,
        history: [],
        adversarial_verdict: null,
      },
    }

    await Store.createTask(projectId, task)

    const result = await executeStatus(projectId, { issueNumber })

    expect(result.output).toContain("Pipeline: developing (attempt 1)")
    expect(result.output).not.toMatch(/Pipeline: developing \(attempt 1, /)
  })
})