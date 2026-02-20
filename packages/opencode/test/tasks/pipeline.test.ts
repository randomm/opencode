import { describe, expect, test, mock } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Store } from "../../src/tasks/store"
import type { Task, Job } from "../../src/tasks/types"
import { tmpdir } from "../fixture/fixture"
import { processAdversarialVerdicts } from "../../src/tasks/pulse"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { Worktree } from "../../src/worktree"
import { Bus } from "../../src/bus"
import { BackgroundTaskEvent } from "../../src/session/async-tasks"

// Mock Session, SessionPrompt, Worktree at module level
mock.module("../../src/session/prompt", () => ({
  SessionPrompt: {
    prompt: mock(async (opts: any) => Promise.resolve()),
    cancel: mock(async (sessionId: string) => {}),
  },
}))

mock.module("../../src/worktree", () => ({
  Worktree: {
    create: mock(async (opts: any) => ({ directory: "/mock-worktree", branch: "mock-branch" })),
    remove: mock(async (opts: any) => {}),
  },
}))

describe("taskctl pipeline: processAdversarialVerdicts state machine", () => {
  test("APPROVED verdict stores correctly", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 205,
          job_id: testJob.id,
          status: "open",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: tmp.path,
          branch: "test-branch",
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

        await Store.createJob(projectId, testJob)
        await Store.createTask(projectId, testTask)

        const verdictData = {
          verdict: "APPROVED" as const,
          summary: "Code looks good",
          issues: [],
          created_at: new Date().toISOString(),
        }

        await Store.updateTask(projectId, testTask.id, {
          status: "review",
          pipeline: {
            ...testTask.pipeline,
            adversarial_verdict: verdictData,
          },
        }, true)

        const updated = await Store.getTask(projectId, testTask.id)
        expect(updated?.pipeline.adversarial_verdict).toEqual(verdictData)
        expect(updated?.status).toBe("review")
      },
    })
  })

  test("ISSUES_FOUND verdict stores structured feedback", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 205,
          job_id: testJob.id,
          status: "open",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: tmp.path,
          branch: "test-branch",
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

        await Store.createJob(projectId, testJob)
        await Store.createTask(projectId, testTask)

        const verdictData = {
          verdict: "ISSUES_FOUND" as const,
          summary: "Null check needed",
          issues: [
            {
              location: "src/foo.ts:42",
              severity: "HIGH" as const,
              fix: "Add null check before calling user.profile",
            },
          ],
          created_at: new Date().toISOString(),
        }

        await Store.updateTask(projectId, testTask.id, {
          status: "review",
          pipeline: {
            ...testTask.pipeline,
            attempt: 1,
            adversarial_verdict: verdictData,
          },
        }, true)

        const updated = await Store.getTask(projectId, testTask.id)
        expect(updated?.pipeline.adversarial_verdict?.verdict).toBe("ISSUES_FOUND")
        expect(updated?.pipeline.adversarial_verdict?.issues).toHaveLength(1)
        expect(updated?.pipeline.adversarial_verdict?.issues[0]?.location).toBe("src/foo.ts:42")
        expect(updated?.pipeline.adversarial_verdict?.issues[0]?.severity).toBe("HIGH")
        expect(updated?.pipeline.attempt).toBe(1)
      },
    })
  })

  test("CRITICAL_ISSUES_FOUND verdict stores severity correctly", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 205,
          job_id: testJob.id,
          status: "open",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: tmp.path,
          branch: "test-branch",
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

        await Store.createJob(projectId, testJob)
        await Store.createTask(projectId, testTask)

        const verdictData = {
          verdict: "CRITICAL_ISSUES_FOUND" as const,
          summary: "Security vulnerability",
          issues: [
            {
              location: "src/auth.ts:12",
              severity: "CRITICAL" as const,
              fix: "Add input validation on password field",
            },
          ],
          created_at: new Date().toISOString(),
        }

        await Store.updateTask(projectId, testTask.id, {
          status: "review",
          pipeline: {
            ...testTask.pipeline,
            attempt: 2,
            adversarial_verdict: verdictData,
          },
        }, true)

        const updated = await Store.getTask(projectId, testTask.id)
        expect(updated?.pipeline.adversarial_verdict?.verdict).toBe("CRITICAL_ISSUES_FOUND")
        expect(updated?.pipeline.adversarial_verdict?.issues[0]?.severity).toBe("CRITICAL")
        expect(updated?.pipeline.attempt).toBe(2)
      },
    })
  })

  test("multiple issues stored in single verdict", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 205,
          job_id: testJob.id,
          status: "open",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: tmp.path,
          branch: "test-branch",
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

        await Store.createJob(projectId, testJob)
        await Store.createTask(projectId, testTask)

        const verdictData = {
          verdict: "ISSUES_FOUND" as const,
          summary: "Multiple issues found",
          issues: [
            {
              location: "src/foo.ts:42",
              severity: "HIGH" as const,
              fix: "Add null check",
            },
            {
              location: "src/bar.ts:15",
              severity: "MEDIUM" as const,
              fix: "Add error handling",
            },
            {
              location: "src/baz.ts:8",
              severity: "LOW" as const,
              fix: "Add JSDoc comment",
            },
          ],
          created_at: new Date().toISOString(),
        }

        await Store.updateTask(projectId, testTask.id, {
          status: "review",
          pipeline: {
            ...testTask.pipeline,
            adversarial_verdict: verdictData,
          },
        }, true)

        const updated = await Store.getTask(projectId, testTask.id)
        expect(updated?.pipeline.adversarial_verdict?.issues).toHaveLength(3)
        expect(updated?.pipeline.adversarial_verdict?.issues[0]?.location).toBe("src/foo.ts:42")
        expect(updated?.pipeline.adversarial_verdict?.issues[1]?.location).toBe("src/bar.ts:15")
        expect(updated?.pipeline.adversarial_verdict?.issues[2]?.location).toBe("src/baz.ts:8")
      },
    })
  })

  test("all severity levels stored correctly", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 205,
          job_id: testJob.id,
          status: "open",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: tmp.path,
          branch: "test-branch",
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

        await Store.createJob(projectId, testJob)
        await Store.createTask(projectId, testTask)

        const verdictData = {
          verdict: "ISSUES_FOUND" as const,
          summary: "All severity levels",
          issues: [
            { location: "a.ts:1", severity: "CRITICAL" as const, fix: "fix critical" },
            { location: "b.ts:2", severity: "HIGH" as const, fix: "fix high" },
            { location: "c.ts:3", severity: "MEDIUM" as const, fix: "fix medium" },
            { location: "d.ts:4", severity: "LOW" as const, fix: "fix low" },
          ],
          created_at: new Date().toISOString(),
        }

        await Store.updateTask(projectId, testTask.id, {
          status: "review",
          pipeline: {
            ...testTask.pipeline,
            adversarial_verdict: verdictData,
          },
        }, true)

        const updated = await Store.getTask(projectId, testTask.id)
        const severities = updated?.pipeline.adversarial_verdict?.issues.map(i => i.severity)
        expect(severities).toEqual(["CRITICAL", "HIGH", "MEDIUM", "LOW"])
      },
    })
  })
})

describe("taskctl pipeline: processAdversarialVerdicts state machine", () => {
  test("APPROVED verdict closes task and fires BackgroundTaskEvent", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 205,
          job_id: testJob.id,
          status: "review",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: tmp.path,
          branch: "test-branch",
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
            adversarial_verdict: {
              verdict: "APPROVED",
              summary: "Code looks good",
              issues: [],
              created_at: new Date().toISOString(),
            },
          },
        }

        await Store.createJob(projectId, testJob)
        await Store.createTask(projectId, testTask)

        // Track BackgroundTaskEvent
        const completedEvents: any[] = []
        const unsubscribe = Bus.subscribe(BackgroundTaskEvent.Completed, (event) => {
          completedEvents.push(event)
        })

        // Create a real PM session
        const pmSession = await Session.create({
          directory: tmp.path,
          title: "PM test session",
          permission: [],
        })

        // Process the verdict
        await processAdversarialVerdicts(testJob.id, projectId, pmSession.id)

        // Verify verdict was cleared and task closed
        const finalTask = await Store.getTask(projectId, testTask.id)
        expect(finalTask?.status).toBe("closed")
        expect(finalTask?.close_reason).toBe("approved and committed")
        expect(finalTask?.pipeline.adversarial_verdict).toBeNull()
        expect(finalTask?.pipeline.stage).toBe("done")

        // Verify BackgroundTaskEvent was fired
        expect(completedEvents).toHaveLength(1)
        expect(completedEvents[0].properties.taskID).toBe(testTask.id)
        expect(completedEvents[0].properties.sessionID).toBe(pmSession.id)

        unsubscribe()
      },
    })
  })

  test("ISSUES_FOUND verdict increments attempt and triggers respawn", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 205,
          job_id: testJob.id,
          status: "review",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: tmp.path,
          branch: "test-branch",
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
            adversarial_verdict: {
              verdict: "ISSUES_FOUND",
              summary: "Null check needed",
              issues: [
                {
                  location: "src/foo.ts:42",
                  severity: "HIGH" as const,
                  fix: "Add null check before calling user.profile",
                },
              ],
              created_at: new Date().toISOString(),
            },
          },
        }

        await Store.createJob(projectId, testJob)
        await Store.createTask(projectId, testTask)

        // Create a real PM session
        const pmSession = await Session.create({
          directory: tmp.path,
          title: "PM test session",
          permission: [],
        })

        // Process the verdict
        await processAdversarialVerdicts(testJob.id, projectId, pmSession.id)

        // Verify verdict was cleared and attempt incremented
        const finalTask = await Store.getTask(projectId, testTask.id)
        expect(finalTask?.pipeline.adversarial_verdict).toBeNull()
        expect(finalTask?.pipeline.attempt).toBe(1)
        expect(finalTask?.status).toBe("in_progress")
        expect(finalTask?.pipeline.stage).toBe("developing")
      },
    })
  })

  test("3rd ISSUES_FOUND verdict escalates to PM with failed status", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 205,
          job_id: testJob.id,
          status: "review",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: tmp.path,
          branch: "test-branch",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          close_reason: null,
          comments: [],
          pipeline: {
            stage: "reviewing",
            attempt: 2, // This is the 3rd attempt (0, 1, 2)
            last_activity: new Date().toISOString(),
            last_steering: null,
            history: [],
            adversarial_verdict: {
              verdict: "ISSUES_FOUND",
              summary: "Still has issues",
              issues: [
                {
                  location: "src/foo.ts:42",
                  severity: "HIGH" as const,
                  fix: "Fix the null check properly",
                },
              ],
              created_at: new Date().toISOString(),
            },
          },
        }

        await Store.createJob(projectId, testJob)
        await Store.createTask(projectId, testTask)

        // Track BackgroundTaskEvent for escalation
        const completedEvents: any[] = []
        const unsubscribe = Bus.subscribe(BackgroundTaskEvent.Completed, (event) => {
          completedEvents.push(event)
        })

        // Create a real PM session
        const pmSession = await Session.create({
          directory: tmp.path,
          title: "PM test session",
          permission: [],
        })

        // Process the verdict
        await processAdversarialVerdicts(testJob.id, projectId, pmSession.id)

        // Verify task escalated to PM
        const finalTask = await Store.getTask(projectId, testTask.id)
        expect(finalTask?.status).toBe("failed")
        expect(finalTask?.pipeline.adversarial_verdict).toBeNull()
        expect(finalTask?.pipeline.stage).toBe("failed")

        // Verify BackgroundTaskEvent was fired for escalation
        expect(completedEvents).toHaveLength(1)
        expect(completedEvents[0].properties.taskID).toBe(`escalation-${testTask.id}`)

        unsubscribe()
      },
    })
  })

  test("verdict cleared before action prevents double-processing", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 205,
          job_id: testJob.id,
          status: "review",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
          depends_on: [],
          assignee: null,
          assignee_pid: null,
          worktree: tmp.path,
          branch: "test-branch",
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
            adversarial_verdict: {
              verdict: "APPROVED",
              summary: "Code looks good",
              issues: [],
              created_at: new Date().toISOString(),
            },
          },
        }

        await Store.createJob(projectId, testJob)
        await Store.createTask(projectId, testTask)

        // Create a real PM session
        const pmSession = await Session.create({
          directory: tmp.path,
          title: "PM test session",
          permission: [],
        })

        // Process the verdict
        let processCount = 0
        processCount++
        await processAdversarialVerdicts(testJob.id, projectId, pmSession.id)

        // Verify verdict was cleared immediately
        const afterFirst = await Store.getTask(projectId, testTask.id)
        expect(afterFirst?.pipeline.adversarial_verdict).toBeNull()

        // Try to process again - should be a no-op since verdict is null
        processCount++
        await processAdversarialVerdicts(testJob.id, projectId, pmSession.id)

        // Verify task status hasn't changed (still closed or in same state)
        const finalTask = await Store.getTask(projectId, testTask.id)
        expect(finalTask?.pipeline.adversarial_verdict).toBeNull()
        // The important thing is that we didn't double-process - verdict was null
      },
    })
  })
})
