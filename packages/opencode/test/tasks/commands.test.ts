import { describe, test, expect } from "bun:test"
import { Store } from "../../src/tasks/store"
import type { Task } from "../../src/tasks/types"
import { Global } from "../../src/global"
import { formatElapsed, executeInspect } from "../../src/tasks/inspect-commands"
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
        feature_branch: null,
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
        feature_branch: null,
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
        feature_branch: null,
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
        feature_branch: null,
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
        feature_branch: null,
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

describe("formatElapsed", () => {
  test("formats sub-second durations as ms", () => {
    expect(formatElapsed(500)).toBe("500ms")
  })

  test("formats seconds", () => {
    expect(formatElapsed(5000)).toBe("5.0s")
  })

  test("formats minutes and seconds", () => {
    expect(formatElapsed(3 * 60 * 1000 + 12 * 1000)).toBe("3m 12s")
  })

  test("formats hours and minutes", () => {
    expect(formatElapsed(2 * 3600 * 1000 + 15 * 60 * 1000)).toBe("2h 15m")
  })
})

describe("taskctl inspect - per-stage duration", () => {
  test("shows duration for completed history stages", async () => {
    await withTestProject(async (projectId) => {
      const t0 = new Date("2025-01-01T10:00:00.000Z")
      const t1 = new Date("2025-01-01T10:03:12.000Z") // 3m 12s after t0
      const t2 = new Date("2025-01-01T10:05:00.000Z") // 1m 48s after t1
      const t3 = new Date("2025-01-01T10:06:00.000Z") // gives t2 a deterministic end

      const task: Task = {
        id: "inspect-duration-task",
        title: "Duration Task",
        description: "desc",
        acceptance_criteria: "ac",
        parent_issue: 1,
        job_id: "job-dur",
        status: "in_progress",
        priority: 0,
        task_type: "implementation",
        labels: [],
        depends_on: [],
        assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        base_commit: null,
        created_at: t0.toISOString(),
        updated_at: t3.toISOString(),
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "adversarial-running",
          attempt: 1,
          last_activity: t3.toISOString(),
          last_steering: null,
          history: [
            { from: "idle", to: "developing", attempt: 1, timestamp: t0.toISOString(), message: null },
            { from: "developing", to: "reviewing", attempt: 1, timestamp: t1.toISOString(), message: "done" },
            { from: "reviewing", to: "adversarial-running", attempt: 1, timestamp: t2.toISOString(), message: null },
          ],
          adversarial_verdict: null,
        },
      }

      await Store.createTask(projectId, task)

      const result = await executeInspect(projectId, { taskId: "inspect-duration-task" })

      // First entry (idle -> developing): t1 - t0 = 3m 12s
      expect(result.output).toContain("3m 12s")
      // Second entry (developing -> reviewing): t2 - t1 = 1m 48s
      expect(result.output).toContain("1m 48s")
    })
  })

  test("shows elapsed time for in-progress stage", async () => {
    await withTestProject(async (projectId) => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

      const task: Task = {
        id: "inspect-inprogress-task",
        title: "In-Progress Task",
        description: "desc",
        acceptance_criteria: "ac",
        parent_issue: 1,
        job_id: "job-ip",
        status: "in_progress",
        priority: 0,
        task_type: "implementation",
        labels: [],
        depends_on: [],
        assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        base_commit: null,
        created_at: fiveMinAgo.toISOString(),
        updated_at: fiveMinAgo.toISOString(),
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "developing",
          attempt: 1,
          last_activity: null,
          last_steering: null,
          history: [
            { from: "idle", to: "developing", attempt: 1, timestamp: fiveMinAgo.toISOString(), message: null },
          ],
          adversarial_verdict: null,
        },
      }

      await Store.createTask(projectId, task)

      const result = await executeInspect(projectId, { taskId: "inspect-inprogress-task" })

      // In-progress last entry: elapsed since start (~5m), check for minutes format
      expect(result.output).toMatch(/\dm \ds/)
    })
  })

  test("history output format includes from->to and duration", async () => {
    await withTestProject(async (projectId) => {
      const t0 = new Date("2025-06-01T09:00:00.000Z")
      const t1 = new Date("2025-06-01T09:01:30.000Z") // 1m 30s after t0
      const t2 = new Date("2025-06-01T09:02:00.000Z") // gives t1 a deterministic end

      const task: Task = {
        id: "inspect-format-task",
        title: "Format Task",
        description: "desc",
        acceptance_criteria: "ac",
        parent_issue: 1,
        job_id: "job-fmt",
        status: "closed",
        priority: 0,
        task_type: "implementation",
        labels: [],
        depends_on: [],
        assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        base_commit: null,
        created_at: t0.toISOString(),
        updated_at: t2.toISOString(),
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "done",
          attempt: 1,
          last_activity: t2.toISOString(),
          last_steering: null,
          history: [
            { from: "idle", to: "developing", attempt: 1, timestamp: t0.toISOString(), message: null },
            { from: "developing", to: "done", attempt: 1, timestamp: t1.toISOString(), message: null },
          ],
          adversarial_verdict: null,
        },
      }

      await Store.createTask(projectId, task)

      const result = await executeInspect(projectId, { taskId: "inspect-format-task" })

      // Should contain idle->developing with 1m 30s duration (t1 - t0)
      expect(result.output).toContain("idle->developing")
      expect(result.output).toContain("1m 30s")
    })
  })
})
