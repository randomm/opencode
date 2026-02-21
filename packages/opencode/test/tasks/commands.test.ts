import { describe, test, expect } from "bun:test"
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

describe("taskctl start - restart capability", () => {
  test("cleans up old complete job before creating new one", async () => {
    await withTestProject(async (projectId) => {
      const oldJobId = "job-old"
      const issueNumber = 123

      await Store.createJob(projectId, {
        id: oldJobId,
        parent_issue: issueNumber,
        status: "complete",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const oldJob = await Store.findJobByIssue(projectId, issueNumber)
      expect(oldJob).not.toBeNull()
      expect(oldJob?.id).toBe(oldJobId)

      await Store.deleteJob(projectId, oldJobId)

      const deletedJob = await Store.getJob(projectId, oldJobId)
      expect(deletedJob).toBeNull()

      await new Promise(resolve => setTimeout(resolve, 10))

      const newJobId = `job-new-${Date.now()}`
      await Store.createJob(projectId, {
        id: newJobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const allJobs = await Store.findJobByIssue(projectId, issueNumber)
      expect(allJobs).not.toBeNull()
      expect(allJobs?.id).toBe(newJobId)
      expect(allJobs?.status).toBe("running")
    })
  })

  test("cleans up old failed job before creating new one", async () => {
    await withTestProject(async (projectId) => {
      const oldJobId = "job-old"
      const issueNumber = 124

      await Store.createJob(projectId, {
        id: oldJobId,
        parent_issue: issueNumber,
        status: "failed",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      await Store.deleteJob(projectId, oldJobId)

      const newJobId = `job-new-${Date.now()}`
      await Store.createJob(projectId, {
        id: newJobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const allJobs = await Store.findJobByIssue(projectId, issueNumber)
      expect(allJobs).not.toBeNull()
      expect(allJobs?.id).toBe(newJobId)
      expect(allJobs?.status).toBe("running")
    })
  })

  test("cleans up tasks when deleting job", async () => {
    await withTestProject(async (projectId) => {
      const jobId = "job-deletethis"
      const issueNumber = 125

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

      const now = new Date().toISOString()
      const task: Task = {
        id: "task-1",
        title: "Test Task",
        description: "Test",
        acceptance_criteria: "Test",
        parent_issue: issueNumber,
        job_id: jobId,
        status: "closed",
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
          stage: "done",
          attempt: 1,
          last_activity: now,
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }

      await Store.createTask(projectId, task)

      const taskBefore = await Store.getTask(projectId, "task-1")
      expect(taskBefore).not.toBeNull()

      await Store.deleteTasksByJobId(projectId, jobId)

      const taskAfter = await Store.getTask(projectId, "task-1")
      expect(taskAfter).toBeNull()
    })
  })

test("removes deleted tasks from index", async () => {
    await withTestProject(async (projectId) => {
      const jobId = "job-test"
      const issueNumber = 127

      const now = new Date().toISOString()
      const task: Task = {
        id: "task-1",
        title: "Test Task",
        description: "Test",
        acceptance_criteria: "Test",
        parent_issue: issueNumber,
        job_id: jobId,
        status: "closed",
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
          stage: "done",
          attempt: 1,
          last_activity: now,
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }

      await Store.createTask(projectId, task)

      const indexBefore = await Store.getIndex(projectId)
      expect(indexBefore["task-1"]).toBeDefined()

      await Store.deleteTasksByJobId(projectId, jobId)

      const indexAfter = await Store.getIndex(projectId)
      expect(indexAfter["task-1"]).toBeUndefined()
    })
  })

  test("deleteJob is idempotent - succeeds if job already deleted", async () => {
    await withTestProject(async (projectId) => {
      const jobId = "job-does-not-exist"

      // Should not throw error
      await Store.deleteJob(projectId, jobId)

      // Verify no job created
      const job = await Store.getJob(projectId, jobId)
      expect(job).toBeNull()
    })
  })

  test("cleans up old stopped job before creating new one", async () => {
    await withTestProject(async (projectId) => {
      const oldJobId = "job-old"
      const issueNumber = 126

      await Store.createJob(projectId, {
        id: oldJobId,
        parent_issue: issueNumber,
        status: "stopped",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      await Store.deleteJob(projectId, oldJobId)

      const newJobId = `job-new-${Date.now()}`
      await Store.createJob(projectId, {
        id: newJobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const allJobs = await Store.findJobByIssue(projectId, issueNumber)
      expect(allJobs).not.toBeNull()
      expect(allJobs?.id).toBe(newJobId)
      expect(allJobs?.status).toBe("running")
    })
  })
})

describe("taskctl resume - stop flag clearing", () => {
  test("resumes job with stopping flag set", async () => {
    await withTestProject(async (projectId) => {
      const jobId = "job-test"

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: 1,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: true,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "pm-test",
      })

      const before = await Store.getJob(projectId, jobId)
      expect(before?.stopping).toBe(true)

      await Store.updateJob(projectId, jobId, { stopping: false, status: "running" })

      const after = await Store.getJob(projectId, jobId)
      expect(after?.stopping).toBe(false)
      expect(after?.status).toBe("running")
    })
  })
})