import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { Store } from "../../src/tasks/store"
import { Global } from "../../src/global"
import { BackgroundTaskEvent } from "../../src/session/async-tasks"
import { Bus } from "../../src/bus"
import path from "path"
import fs from "fs/promises"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { Identifier } from "../../src/id/id"

const TEST_PROJECT_ID = "test-notifications-project"
const TEST_JOB_ID = "job-notifications-test"

describe("PM notifications", () => {
  let originalDataPath: string
  let testDataDir: string
  let pmSessionId: string

  beforeEach(async () => {
    originalDataPath = Global.Path.data
    testDataDir = path.join("/tmp", "opencode-notifications-test-" + Math.random().toString(36).slice(2))
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

  test("BackgroundTaskEvent.Completed fired when task escalated (after 3 failures)", async () => {
    const { escalateToPM } = await import("../../src/tasks/pulse")

    await Instance.provide({
      directory: testDataDir,
      fn: async () => {
        const pmSession = await Session.createNext({
          directory: testDataDir,
        })
        pmSessionId = pmSession.id

        const mockTask: any = {
          id: "task-escalated-test",
          job_id: TEST_JOB_ID,
          status: "review",
          priority: 2,
          task_type: "implementation",
          parent_issue: 273,
          labels: [],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: testDataDir,
          branch: "feature/test",
          title: "Task failed adversarial",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          close_reason: null,
          comments: [],
          pipeline: {
            stage: "adversarial-running",
            attempt: 3,
            last_activity: new Date().toISOString(),
            last_steering: null,
            history: [],
            adversarial_verdict: {
              verdict: "CRITICAL_ISSUES_FOUND",
              issues: [
                {
                  location: "src/index.ts:42",
                  severity: "CRITICAL",
                  fix: "Fix security vulnerability",
                },
              ],
              summary: "Critical security issue found",
              created_at: new Date().toISOString(),
            },
          },
        }

        await Store.createJob(TEST_PROJECT_ID, {
          id: TEST_JOB_ID,
          parent_issue: 273,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 1,
          pm_session_id: pmSessionId,
        })

        await Store.createTask(TEST_PROJECT_ID, mockTask)

        let eventFired = false
        const unsub = Bus.subscribe(BackgroundTaskEvent.Completed, (evt) => {
          if (evt.properties.taskID.startsWith("escalation-") && evt.properties.sessionID === pmSessionId) {
            eventFired = true
            unsub()
          }
        })

        await escalateToPM(mockTask, TEST_JOB_ID, TEST_PROJECT_ID, pmSessionId)

        await new Promise((r) => setTimeout(r, 200))
        expect(eventFired).toBe(true)

        const updated = await Store.getTask(TEST_PROJECT_ID, "task-escalated-test")
        expect(updated?.status).toBe("failed")
        expect(updated?.pipeline.stage).toBe("failed")
      },
    })
  })

  test("BackgroundTaskEvent.Completed fired when job completes (all tasks done)", async () => {
    const { checkCompletion } = await import("../../src/tasks/pulse")

    await Instance.provide({
      directory: testDataDir,
      fn: async () => {
        const pmSession = await Session.createNext({
          directory: testDataDir,
        })
        pmSessionId = pmSession.id

        const jobId = "job-completion-test-" + Date.now()

        await Store.createJob(TEST_PROJECT_ID, {
          id: jobId,
          parent_issue: 273,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 1,
          pm_session_id: pmSessionId,
        })

        // Create two completed tasks
        for (let i = 1; i <= 2; i++) {
          await Store.createTask(TEST_PROJECT_ID, {
            id: `task-completion-${jobId}-${i}`,
            job_id: jobId,
            status: "closed",
            priority: 2,
            task_type: "implementation",
            parent_issue: 273,
            labels: [],
            depends_on: [],
            assignee: null,
            assignee_pid: null,
            worktree: null,
            branch: null,
            title: `Completed task ${i}`,
            description: "Test description",
            acceptance_criteria: "Test criteria",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            close_reason: "approved and committed",
            comments: [],
            pipeline: {
              stage: "done",
              attempt: 0,
              last_activity: null,
              last_steering: null,
              history: [],
              adversarial_verdict: null,
            },
          })
        }

        let jobCompletionEventFired = false
        const unsub = Bus.subscribe(BackgroundTaskEvent.Completed, (evt) => {
          if (evt.properties.taskID === jobId && evt.properties.sessionID === pmSessionId) {
            jobCompletionEventFired = true
            unsub()
          }
        })

        const testInterval = setInterval(() => {}, 5000)
        try {
          await checkCompletion(jobId, TEST_PROJECT_ID, pmSessionId, testInterval)
        } finally {
          clearInterval(testInterval)
        }

        await new Promise((r) => setTimeout(r, 200))
        expect(jobCompletionEventFired).toBe(true)

        const job = await Store.getJob(TEST_PROJECT_ID, jobId)
        expect(job?.status).toBe("complete")
      },
    })
  })

  test("System notification message added to PM session when task done", async () => {
    const { notifyPM } = await import("../../src/tasks/pulse")

    await Instance.provide({
      directory: testDataDir,
      fn: async () => {
        const pmSession = await Session.createNext({
          directory: testDataDir,
        })
        pmSessionId = pmSession.id

        const message = "✅ Task complete: Test Task (task-123)"

        const result = await notifyPM(pmSessionId, message)
        expect(result.ok).toBe(true)

        await new Promise((r) => setTimeout(r, 100))

        // Verify message was added to session
        const msgs: MessageV2.WithParts[] = []
        for await (const msg of MessageV2.stream(pmSessionId)) {
          msgs.push(msg)
        }

        const notificationMsg = msgs.find((m) => m.info.role === "assistant" && m.info.agent === "system")
        expect(notificationMsg).toBeDefined()

        const textPart = notificationMsg?.parts.find((p): p is MessageV2.TextPart => p.type === "text" && (p.synthetic ?? false))
        expect(textPart?.text).toContain("Task complete")
      },
    })
  })

  test("notifyPM returns error for invalid session ID", async () => {
    const { notifyPM } = await import("../../src/tasks/pulse")

    const result = await notifyPM("invalid-session", "test message")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBeTruthy()
      expect(typeof result.error).toBe("string")
    }
  })

  test("notifyPM returns error for empty text", async () => {
    const { notifyPM } = await import("../../src/tasks/pulse")

    await Instance.provide({
      directory: testDataDir,
      fn: async () => {
        const pmSession = await Session.createNext({
          directory: testDataDir,
        })
        pmSessionId = pmSession.id

        const result = await notifyPM(pmSessionId, "")
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain("empty")
        }
      },
    })
  })

  test("notifyPM returns error for text exceeding length limit", async () => {
    const { notifyPM } = await import("../../src/tasks/pulse")

    await Instance.provide({
      directory: testDataDir,
      fn: async () => {
        const pmSession = await Session.createNext({
          directory: testDataDir,
        })
        pmSessionId = pmSession.id

        const longText = "x".repeat(10001)
        const result = await notifyPM(pmSessionId, longText)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain("exceeds")
        }
      },
    })
  })
})
