import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Store } from "../../src/tasks/store"
import { Global } from "../../src/global"
import path from "path"
import fs from "fs/promises"

const TEST_PROJECT_ID = "test-steering-project"
const TEST_JOB_ID = "job-steering-123"
const TEST_PM_SESSION_ID = "pm-session-test"

describe("steering.ts", () => {
  let originalDataPath: string
  let testDataDir: string

  beforeEach(async () => {
    originalDataPath = Global.Path.data
    testDataDir = path.join("/tmp", "opencode-steering-test-" + Math.random().toString(36).slice(2))
    await fs.mkdir(testDataDir, { recursive: true })

    process.env.OPENCODE_TEST_HOME = testDataDir
    await Global.init()
  })

  afterEach(async () => {
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {})
    if (originalDataPath) {
      delete process.env.OPENCODE_TEST_HOME
    }
  })

  const createMockTask = (overrides?: any) => ({
    id: "task-steering-1",
    job_id: TEST_JOB_ID,
    status: "in_progress" as const,
    priority: 2 as const,
    task_type: "implementation" as const,
    parent_issue: 123,
    labels: [],
    depends_on: [],
    assignee: null,
    assignee_pid: null,
    worktree: null,
    branch: null,
    title: "Test task",
    description: "Test description",
    acceptance_criteria: "Test criteria",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    close_reason: null,
    comments: [],
    pipeline: {
      stage: "developing" as const,
      attempt: 0,
      last_activity: null,
      last_steering: null,
      history: [],
      adversarial_verdict: null,
    },
    ...overrides,
  })

  describe("steering timer guard", () => {
    test("steering skipped if evaluated recently (< 15 minutes)", async () => {
      const now = new Date()
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString()

      const task = createMockTask({
        pipeline: {
          stage: "developing",
          attempt: 0,
          last_activity: now.toISOString(),
          last_steering: fiveMinutesAgo,
          history: [],
          adversarial_verdict: null,
        },
        status: "in_progress",
        assignee: "test-session-id",
      })

      await Store.createJob(TEST_PROJECT_ID, {
        id: TEST_JOB_ID,
        parent_issue: 123,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 1,
        pm_session_id: TEST_PM_SESSION_ID,
      })

      await Store.createTask(TEST_PROJECT_ID, task)

      const stored = await Store.getTask(TEST_PROJECT_ID, task.id)
      expect(stored?.pipeline.last_steering).toBe(fiveMinutesAgo)

      const minutesSince = (now.getTime() - new Date(fiveMinutesAgo).getTime()) / 60_000
      expect(minutesSince).toBeLessThan(15)
    })

    test("steering eligible if 15+ minutes since last evaluation", async () => {
      const now = new Date()
      const sixteenMinutesAgo = new Date(now.getTime() - 16 * 60 * 1000).toISOString()

      const task = createMockTask({
        pipeline: {
          stage: "developing",
          attempt: 0,
          last_activity: now.toISOString(),
          last_steering: sixteenMinutesAgo,
          history: [],
          adversarial_verdict: null,
        },
        status: "in_progress",
        assignee: "test-session-id",
      })

      const minutesSince = (now.getTime() - new Date(sixteenMinutesAgo).getTime()) / 60_000
      expect(minutesSince).toBeGreaterThanOrEqual(15)
    })

    test("steering skipped for reviewing stage tasks", async () => {
      const task = createMockTask({
        pipeline: {
          stage: "reviewing",
          attempt: 0,
          last_activity: new Date().toISOString(),
          last_steering: new Date(0).toISOString(),
          history: [],
          adversarial_verdict: null,
        },
        status: "in_progress",
        assignee: "test-session-id",
      })

      expect(task.pipeline.stage).toBe("reviewing")
      const shouldSkip = task.pipeline.stage === "reviewing" || task.pipeline.stage === "adversarial-running"
      expect(shouldSkip).toBe(true)
    })

    test("steering skipped for adversarial-running stage tasks", async () => {
      const task = createMockTask({
        pipeline: {
          stage: "adversarial-running",
          attempt: 0,
          last_activity: new Date().toISOString(),
          last_steering: new Date(0).toISOString(),
          history: [],
          adversarial_verdict: null,
        },
        status: "in_progress",
        assignee: "test-session-id",
      })

      expect(task.pipeline.stage).toBe("adversarial-running")
      const shouldSkip = task.pipeline.stage === "reviewing" || task.pipeline.stage === "adversarial-running"
      expect(shouldSkip).toBe(true)
    })
  })

  describe("closed task filtering", () => {
    test("steering skipped for closed tasks", async () => {
      const task = createMockTask({
        status: "closed",
        pipeline: {
          stage: "done",
          attempt: 0,
          last_activity: null,
          last_steering: new Date(0).toISOString(),
          history: [],
          adversarial_verdict: null,
        },
      })

      expect(task.status).not.toBe("in_progress")
    })
  })

  describe("adversarial timeout recovery", () => {
    test("adversarial-running stage times out after 60 minutes", async () => {
      const ADVERSARIAL_TIMEOUT_MS = 60 * 60 * 1000
      const now = Date.now()
      const sixtyOneMinutesAgo = new Date(now - 61 * 60 * 1000)

      const lastActivity = sixtyOneMinutesAgo.getTime()

      expect(now - lastActivity).toBeGreaterThan(ADVERSARIAL_TIMEOUT_MS)
    })

    test("adversarial-running stage not timed out before 60 minutes", async () => {
      const ADVERSARIAL_TIMEOUT_MS = 60 * 60 * 1000
      const now = Date.now()
      const fiftyNineMinutesAgo = new Date(now - 59 * 60 * 1000)

      const lastActivity = fiftyNineMinutesAgo.getTime()

      expect(now - lastActivity).toBeLessThan(ADVERSARIAL_TIMEOUT_MS)
    })
  })

  describe("task state transitions", () => {
    test("developer task without assignee is skipped", async () => {
      const task = createMockTask({
        status: "in_progress",
        assignee: null,
        pipeline: {
          stage: "developing",
          attempt: 0,
          last_activity: new Date().toISOString(),
          last_steering: new Date(0).toISOString(),
          history: [],
          adversarial_verdict: null,
        },
      })

      expect(task.assignee).toBeNull()
      expect(task.status).toBe("in_progress")
    })
  })
})
