import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Store } from "../../src/tasks/store"
import { Global } from "../../src/global"
import path from "path"
import fs from "fs/promises"

const TEST_PROJECT_ID = "test-base-commit-project"
const TEST_JOB_ID = "job-base-commit-test"
const TEST_PM_SESSION_ID = "pm-session-base-commit"

describe("base_commit capture and storage", () => {
  let originalDataPath: string
  let testDataDir: string

  beforeEach(async () => {
    originalDataPath = Global.Path.data
    testDataDir = path.join("/tmp", "opencode-base-commit-test-" + Math.random().toString(36).slice(2))
    await fs.mkdir(testDataDir, { recursive: true })

    process.env.OPENCODE_TEST_HOME = testDataDir
    await Global.init()
  })

  afterEach(async () => {
    const tasksDir = path.join(Global.Path.data, "tasks", TEST_PROJECT_ID)
    const lockPath = path.join(tasksDir, `job-${TEST_JOB_ID}.lock`)
    await fs.unlink(lockPath).catch(() => {})

    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {})
    if (originalDataPath) {
      delete process.env.OPENCODE_TEST_HOME
    }
  })

  test("Task type includes base_commit field", async () => {
    const task: any = {
      id: "task-base-test",
      job_id: TEST_JOB_ID,
      status: "open",
      priority: 2,
      task_type: "implementation",
      parent_issue: 123,
      labels: [],
      depends_on: [],
      assignee: null,
      assignee_pid: null,
      worktree: null,
      branch: null,
      base_commit: null,
      title: "Test task",
      description: "Test description",
      acceptance_criteria: "Test criteria",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      close_reason: null,
      comments: [],
      pipeline: {
        stage: "idle",
        attempt: 0,
        last_activity: null,
        last_steering: null,
        history: [],
        adversarial_verdict: null,
      },
    }

    await Store.createTask(TEST_PROJECT_ID, task)
    const stored = await Store.getTask(TEST_PROJECT_ID, "task-base-test")

    expect(stored).toBeDefined()
    expect(stored?.base_commit).toBe(null)
  })

  test("base_commit can be updated on task", async () => {
    const task: any = {
      id: "task-update-base",
      job_id: TEST_JOB_ID,
      status: "in_progress",
      priority: 1,
      task_type: "implementation",
      parent_issue: 123,
      labels: [],
      depends_on: [],
      assignee: "test-session",
      assignee_pid: process.pid,
      worktree: "/test/worktree",
      branch: "feature/test-branch",
      base_commit: null,
      title: "Test task",
      description: "Test",
      acceptance_criteria: "Test",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      close_reason: null,
      comments: [],
      pipeline: {
        stage: "developing",
        attempt: 0,
        last_activity: new Date().toISOString(),
        last_steering: null,
        history: [],
        adversarial_verdict: null,
      },
    }

    await Store.createTask(TEST_PROJECT_ID, task)

    // Update base_commit after worktree creation
    const baseCommitHash = "abc123def456"
    await Store.updateTask(
      TEST_PROJECT_ID,
      "task-update-base",
      {
        base_commit: baseCommitHash,
      },
      true, // allowImmutable
    )

    const updated = await Store.getTask(TEST_PROJECT_ID, "task-update-base")
    expect(updated?.base_commit).toBe(baseCommitHash)
    expect(updated?.worktree).toBe("/test/worktree")
    expect(updated?.branch).toBe("feature/test-branch")
  })

  test("base_commit persists to disk", async () => {
    const task: any = {
      id: "task-persist-base",
      job_id: TEST_JOB_ID,
      status: "review",
      priority: 2,
      task_type: "implementation",
      parent_issue: 123,
      labels: [],
      depends_on: [],
      assignee: "adversarial-session",
      assignee_pid: process.pid,
      worktree: "/test/worktree/path",
      branch: "fix/issue-123",
      base_commit: "aabbccddee001122",
      title: "Test task",
      description: "Test",
      acceptance_criteria: "Test",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      close_reason: null,
      comments: [],
      pipeline: {
        stage: "reviewing",
        attempt: 1,
        last_activity: new Date().toISOString(),
        last_steering: null,
        history: [],
        adversarial_verdict: null,
      },
    }

    await Store.createTask(TEST_PROJECT_ID, task)

    // Verify task file contains base_commit
    const taskPath = path.join(
      Global.Path.data,
      "tasks",
      TEST_PROJECT_ID,
      "task-persist-base.json",
    )
    const content = await fs.readFile(taskPath, "utf-8")
    const parsed = JSON.parse(content)

    expect(parsed.base_commit).toBe("aabbccddee001122")
    expect(parsed.worktree).toBe("/test/worktree/path")
    expect(parsed.branch).toBe("fix/issue-123")
  })

  test("base_commit null is valid and stored", async () => {
    const task: any = {
      id: "task-null-base",
      job_id: TEST_JOB_ID,
      status: "open",
      priority: 3,
      task_type: "implementation",
      parent_issue: 456,
      labels: ["urgent"],
      depends_on: [],
      assignee: null,
      assignee_pid: null,
      worktree: null,
      branch: null,
      base_commit: null,
      title: "Task without base commit",
      description: "Test",
      acceptance_criteria: "Test",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      close_reason: null,
      comments: [],
      pipeline: {
        stage: "idle",
        attempt: 0,
        last_activity: null,
        last_steering: null,
        history: [],
        adversarial_verdict: null,
      },
    }

    await Store.createTask(TEST_PROJECT_ID, task)
    const retrieved = await Store.getTask(TEST_PROJECT_ID, "task-null-base")

    expect(retrieved?.base_commit).toBe(null)
  })
})
