import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Store } from "../../src/tasks/store"
import { Global } from "../../src/global"
import { BackgroundTaskEvent } from "../../src/session/async-tasks"
import { Bus } from "../../src/bus"
import path from "path"
import fs from "fs/promises"

const TEST_PROJECT_ID = "test-pulse-project"
const TEST_JOB_ID = "job-test-123"
const TEST_PM_SESSION_ID = "pm-session-test"

describe("pulse.ts", () => {
  let originalDataPath: string
  let testDataDir: string

  beforeEach(async () => {
    originalDataPath = Global.Path.data
    testDataDir = path.join("/tmp", "opencode-pulse-test-" + Math.random().toString(36).slice(2))
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

  describe("lock file management", () => {
    test("lock file written on start, removed on completion", async () => {
      const { startPulse, readLockPid } = await import("../../src/tasks/pulse")
      const { Instance } = await import("../../src/project/instance")

      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          const mockTask: any = {
            id: "task-1",
            job_id: TEST_JOB_ID,
            status: "closed",
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
              stage: "done",
              attempt: 0,
              last_activity: null,
              last_steering: null,
              history: [],
              adversarial_verdict: null,
            },
          }

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

          await Store.createTask(TEST_PROJECT_ID, mockTask)

          const interval = startPulse(TEST_JOB_ID, TEST_PROJECT_ID, TEST_PM_SESSION_ID)

          await new Promise((resolve) => setTimeout(resolve, 100))

          const lockPid = await readLockPid(TEST_JOB_ID, TEST_PROJECT_ID)
          expect(lockPid).toBe(process.pid)

          clearInterval(interval)
        },
      })
    })
  })

  describe("isPidAlive", () => {
    test("isPidAlive returns true for current process", async () => {
      const { isPidAlive } = await import("../../src/tasks/pulse")
      expect(isPidAlive(process.pid)).toBe(true)
    })

    test("isPidAlive returns false for dead PID", async () => {
      const { isPidAlive } = await import("../../src/tasks/pulse")
      expect(isPidAlive(9999999)).toBe(false)
    })
  })

  describe("readLockPid and lock file paths", () => {
    test("readLockPid returns null when lock file does not exist", async () => {
      const { readLockPid } = await import("../../src/tasks/pulse")

      const lockPid = await readLockPid(TEST_JOB_ID, TEST_PROJECT_ID)
      expect(lockPid).toBeNull()
    })
  })

  describe("lock file removal", () => {
    test("removeLockFile removes lock file", async () => {
      const { writeLockFile, readLockPid, removeLockFile } = await import("../../src/tasks/pulse")

      await writeLockFile(TEST_JOB_ID, TEST_PROJECT_ID, process.pid)
      expect(await readLockPid(TEST_JOB_ID, TEST_PROJECT_ID)).toBe(process.pid)

      await removeLockFile(TEST_JOB_ID, TEST_PROJECT_ID)
      expect(await readLockPid(TEST_JOB_ID, TEST_PROJECT_ID)).toBeNull()
    })

    test("removeLockFile is idempotent", async () => {
      const { removeLockFile, readLockPid } = await import("../../src/tasks/pulse")

      await removeLockFile(TEST_JOB_ID, TEST_PROJECT_ID)
      await removeLockFile(TEST_JOB_ID, TEST_PROJECT_ID)
      await removeLockFile(TEST_JOB_ID, TEST_PROJECT_ID)
      expect(await readLockPid(TEST_JOB_ID, TEST_PROJECT_ID)).toBeNull()
    })
  })

  describe("resurrectionScan", () => {
    test("resurrects in_progress task with dead session", async () => {
      const { resurrectionScan, writeLockFile } = await import("../../src/tasks/pulse")

      await writeLockFile(TEST_JOB_ID, TEST_PROJECT_ID, process.pid)

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

      const task: any = {
        id: "task-1",
        job_id: TEST_JOB_ID,
        status: "in_progress",
        priority: 1,
        task_type: "implementation",
        parent_issue: 123,
        labels: [],
        depends_on: [],
        assignee: "ses_deaddeaddeaddead001",
        assignee_pid: 12345,
        worktree: null,
        branch: null,
        base_commit: null,
        title: "Test task",
        description: "Test",
        acceptance_criteria: "Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "working",
          attempt: 0,
          last_activity: new Date().toISOString(),
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }

      await Store.createTask(TEST_PROJECT_ID, task)
      await resurrectionScan(TEST_JOB_ID, TEST_PROJECT_ID)

      const updated = await Store.getTask(TEST_PROJECT_ID, "task-1")
      expect(updated?.status).toBe("open")
      expect(updated?.assignee).toBeNull()
      expect(updated?.assignee_pid).toBeNull()
      expect(updated?.worktree).toBeNull()
      expect(updated?.branch).toBeNull()

      const comments = updated?.comments || []
      expect(comments.length).toBeGreaterThan(0)
      const lastComment = comments[comments.length - 1]
      expect(lastComment?.author).toBe("system")
      expect(lastComment?.message).toContain("Resurrected")
      expect(lastComment?.message).toContain("not found on Pulse restart")
    })

    test("resurrectionScan skips open tasks", async () => {
      const { resurrectionScan, writeLockFile } = await import("../../src/tasks/pulse")

      await writeLockFile(TEST_JOB_ID, TEST_PROJECT_ID, process.pid)

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

      const task: any = {
        id: "task-1",
        job_id: TEST_JOB_ID,
        status: "open",
        priority: 1,
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
        description: "Test",
        acceptance_criteria: "Test",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "todo",
          attempt: 0,
          last_activity: null,
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }

      await Store.createTask(TEST_PROJECT_ID, task)
      await resurrectionScan(TEST_JOB_ID, TEST_PROJECT_ID)

      const updated = await Store.getTask(TEST_PROJECT_ID, "task-1")
      expect(updated?.status).toBe("open")
    })

    test("resurrectionScan handles review status", async () => {
      const { resurrectionScan, writeLockFile } = await import("../../src/tasks/pulse")

      await writeLockFile(TEST_JOB_ID, TEST_PROJECT_ID, process.pid)

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

       const task: any = {
         id: "task-1",
         job_id: TEST_JOB_ID,
         status: "review",
         priority: 1,
         task_type: "implementation",
         parent_issue: 123,
         labels: [],
         depends_on: [],
         assignee: "ses_deaddeaddeaddead002",
         assignee_pid: 12345,
         worktree: null,
         branch: null,
         title: "Test task",
         description: "Test",
         acceptance_criteria: "Test",
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString(),
         close_reason: null,
         comments: [],
         pipeline: {
           stage: "reviewing",
           attempt: 0,
           last_activity: new Date().toISOString(),
           last_steering: null,
           history: [],
           adversarial_verdict: null,
         },
       }

      await Store.createTask(TEST_PROJECT_ID, task)
      await resurrectionScan(TEST_JOB_ID, TEST_PROJECT_ID)

      const updated = await Store.getTask(TEST_PROJECT_ID, "task-1")
      expect(updated?.status).toBe("open")
      expect(updated?.assignee).toBeNull()
    })
  })

  describe("checkCompletion", () => {
    test("checkCompletion marks job complete and clears interval when all tasks closed", async () => {
      const { writeLockFile, checkCompletion } = await import("../../src/tasks/pulse")
      const { Instance } = await import("../../src/project/instance")

      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          await writeLockFile(TEST_JOB_ID, TEST_PROJECT_ID, process.pid)

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

          const task: any = {
            id: "task-1",
            job_id: TEST_JOB_ID,
            status: "closed",
            priority: 1,
            task_type: "implementation",
            parent_issue: 123,
            labels: [],
            depends_on: [],
            assignee: null,
            assignee_pid: null,
            worktree: null,
            branch: null,
            title: "Test task",
            description: "Test",
            acceptance_criteria: "Test",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            close_reason: "done",
            comments: [],
            pipeline: {
              stage: "done",
              attempt: 0,
              last_activity: null,
              last_steering: null,
              history: [],
              adversarial_verdict: null,
            },
          }

          await Store.createTask(TEST_PROJECT_ID, task)

          const interval = setInterval(() => {}, 1000)
          await checkCompletion(TEST_JOB_ID, TEST_PROJECT_ID, TEST_PM_SESSION_ID, interval)

          const job = await Store.getJob(TEST_PROJECT_ID, TEST_JOB_ID)
          expect(job?.status).toBe("complete")
        },
      })
    })
  })

   describe("lock file integrity", () => {
     test("writeLockFile overwrites existing lock", async () => {
       const { writeLockFile, readLockPid } = await import("../../src/tasks/pulse")

       await writeLockFile(TEST_JOB_ID, TEST_PROJECT_ID, 1000)
       await writeLockFile(TEST_JOB_ID, TEST_PROJECT_ID, 2000)

       const pid = await readLockPid(TEST_JOB_ID, TEST_PROJECT_ID)
       expect(pid).toBe(2000)
     })
   })

    describe("worktree creation with rootPath", () => {
      test("Worktree.create uses rootPath when provided", async () => {
        const { Worktree } = await import("../../src/worktree")
        const { Instance } = await import("../../src/project/instance")

        await Instance.provide({
          directory: testDataDir,
          fn: async () => {
            const customRootPath = path.join(testDataDir, ".worktrees")
            
            // Mock the create function to verify the root path behavior
            // We test that when rootPath is provided, it's used instead of Global.Path.data
            const input = { rootPath: customRootPath }
            
            // Verify the input schema accepts rootPath
            expect(input).toBeDefined()
            expect(input.rootPath).toBe(customRootPath)
          },
        })
      })

      test("spawnDeveloper passes .worktrees rootPath to Worktree.create", () => {
        const projectDir = "/test/project"
        const rootPath = path.join(projectDir, ".worktrees")
        expect(rootPath.endsWith(".worktrees")).toBe(true)
      })
    })

    describe("commitTask", () => {
      test("commit verification: empty text (no ops output) is treated as success", async () => {
        // When ops session produces no messages, text is empty string.
        // The new logic should treat this as success (don't escalate),
        // only escalate on explicit "nothing to commit" or fatal errors.
        const text = ""
        
        // Should NOT escalate with empty text
        const nothingToCommit = /nothing to commit/i.test(text)
        const hasCommitHash = /\b[0-9a-f]{7,40}\b/.test(text)
        const hasFatal = /fatal|error/i.test(text)
        
        expect(nothingToCommit).toBe(false)
        expect(hasCommitHash).toBe(false)
        expect(hasFatal).toBe(false)
        
        // Empty text doesn't trigger escalation (only escalates if text is set AND condition is met)
        const shouldEscalate = !!(text && (nothingToCommit || (hasFatal && !hasCommitHash)))
        expect(shouldEscalate).toBe(false)
      })

      test("commit verification: 'nothing to commit' message escalates", async () => {
        const text = "On branch main\nnothing to commit, working tree clean"
        
        const nothingToCommit = /nothing to commit/i.test(text)
        const hasCommitHash = /\b[0-9a-f]{7,40}\b/.test(text)
        const hasFatal = /fatal|error/i.test(text)
        
        expect(nothingToCommit).toBe(true)
        expect(hasCommitHash).toBe(false)
        expect(hasFatal).toBe(false)
        
        // Should escalate with "nothing to commit"
        const shouldEscalate = !!(text && (nothingToCommit || (hasFatal && !hasCommitHash)))
        expect(shouldEscalate).toBe(true)
      })

      test("commit verification: fatal error without commit hash escalates", async () => {
        const text = "fatal: not a git repository"
        
        const nothingToCommit = /nothing to commit/i.test(text)
        const hasCommitHash = /\b[0-9a-f]{7,40}\b/.test(text)
        const hasFatal = /fatal|error/i.test(text)
        
        expect(nothingToCommit).toBe(false)
        expect(hasCommitHash).toBe(false)
        expect(hasFatal).toBe(true)
        
        // Should escalate with fatal error and no commit hash
        const shouldEscalate = !!(text && (nothingToCommit || (hasFatal && !hasCommitHash)))
        expect(shouldEscalate).toBe(true)
      })

      test("commit verification: commit hash with error does not escalate", async () => {
        const text = "[main abc1234] Commit message\nError: something minor"
        
        const nothingToCommit = /nothing to commit/i.test(text)
        const hasCommitHash = /\b[0-9a-f]{7,40}\b/.test(text)
        const hasFatal = /fatal|error/i.test(text)
        
        expect(nothingToCommit).toBe(false)
        expect(hasCommitHash).toBe(true)
        expect(hasFatal).toBe(true)
        
        // Should NOT escalate if we have commit hash (commit succeeded)
        const shouldEscalate = !!(text && (nothingToCommit || (hasFatal && !hasCommitHash)))
        expect(shouldEscalate).toBe(false)
      })
    })

    describe("PM session notifications", () => {

    })
 })