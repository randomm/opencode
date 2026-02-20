import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Store } from "../../src/tasks/store"
import { Global } from "../../src/global"
import path from "path"
import fs from "fs/promises"

const TEST_PROJECT_ID = "test-tool-project"
const TEST_JOB_ID = "job-test-tool-123"
const TEST_TASK_ID = "task-tool-1"

describe("tool.ts - taskctl commands", () => {
  let originalDataPath: string
  let testDataDir: string

  beforeEach(async () => {
    originalDataPath = Global.Path.data
    testDataDir = path.join("/tmp", "opencode-tool-test-" + Math.random().toString(36).slice(2))
    await fs.mkdir(testDataDir, { recursive: true })

    process.env.OPENCODE_TEST_HOME = testDataDir
    await Global.init()

    await Store.createJob(TEST_PROJECT_ID, {
      id: TEST_JOB_ID,
      parent_issue: 123,
      status: "running",
      created_at: new Date().toISOString(),
      stopping: false,
      pulse_pid: null,
      max_workers: 1,
      pm_session_id: "pm-session",
    })
  })

  afterEach(async () => {
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {})
    if (originalDataPath) {
      delete process.env.OPENCODE_TEST_HOME
    }
  })

  describe("retry command", () => {
    test("retry resets adversarial-running task without throwing", async () => {
      const worktreePath = path.join(testDataDir, "worktree-retry")
      await fs.mkdir(worktreePath, { recursive: true })

      const task: any = {
        id: TEST_TASK_ID,
        job_id: TEST_JOB_ID,
        status: "failed",
        priority: 1,
        task_type: "implementation",
        parent_issue: 123,
        labels: [],
        depends_on: [],
        assignee: "ses-session123",
        assignee_pid: 12345,
        worktree: worktreePath,
        branch: "feature/test",
        title: "Test task",
        description: "Test",
        acceptance_criteria: "Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "adversarial-running",
          attempt: 1,
          last_activity: new Date().toISOString(),
          last_steering: null,
          history: [],
          adversarial_verdict: {
            verdict: "ISSUES_FOUND",
            summary: "Test issues",
            issues: [{ location: "file.ts", severity: "HIGH", fix: "Fix this" }],
            created_at: new Date().toISOString(),
          },
        },
      }

      await Store.createTask(TEST_PROJECT_ID, task)

      await expect(async () => {
        const result = await Store.updateTask(TEST_PROJECT_ID, TEST_TASK_ID, {
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

        await Store.addComment(TEST_PROJECT_ID, TEST_TASK_ID, {
          author: "system",
          message: `Retried by PM. Task reset to open. Pulse will reschedule on next tick.`,
          created_at: new Date().toISOString(),
        })
      }).not.toThrow()

      const updated = await Store.getTask(TEST_PROJECT_ID, TEST_TASK_ID)
      expect(updated?.status).toBe("open")
      expect(updated?.assignee).toBeNull()
      expect(updated?.worktree).toBeNull()
      expect(updated?.branch).toBeNull()
      expect(updated?.pipeline.stage).toBe("idle")
      expect(updated?.pipeline.attempt).toBe(1)
      expect(updated?.pipeline.adversarial_verdict).toBeNull()
    })
  })

  describe("override command", () => {
    test("override --skip on adversarial-running task succeeds without throwing", async () => {
      const worktreePath = path.join(testDataDir, "worktree-override")
      await fs.mkdir(worktreePath, { recursive: true })

      const task: any = {
        id: TEST_TASK_ID,
        job_id: TEST_JOB_ID,
        status: "failed",
        priority: 1,
        task_type: "implementation",
        parent_issue: 123,
        labels: [],
        depends_on: [],
        assignee: "ses-session456",
        assignee_pid: 67890,
        worktree: worktreePath,
        branch: "feature/override-test",
        title: "Test task",
        description: "Test",
        acceptance_criteria: "Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "adversarial-running",
          attempt: 1,
          last_activity: new Date().toISOString(),
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }

      await Store.createTask(TEST_PROJECT_ID, task)

      await expect(async () => {
        await Store.updateTask(TEST_PROJECT_ID, TEST_TASK_ID, {
          status: "closed",
          close_reason: "skipped by PM",
          worktree: null,
          branch: null,
          assignee: null,
          assignee_pid: null,
          pipeline: { ...task.pipeline, stage: "done" },
        }, true)

        await Store.addComment(TEST_PROJECT_ID, TEST_TASK_ID, {
          author: "system",
          message: "Skipped by PM override. Dependent tasks are now unblocked.",
          created_at: new Date().toISOString(),
        })
      }).not.toThrow()

      const updated = await Store.getTask(TEST_PROJECT_ID, TEST_TASK_ID)
      expect(updated?.status).toBe("closed")
      expect(updated?.close_reason).toBe("skipped by PM")
      expect(updated?.worktree).toBeNull()
      expect(updated?.branch).toBeNull()
      expect(updated?.assignee).toBeNull()
      expect(updated?.pipeline.stage).toBe("done")
    })
  })
})