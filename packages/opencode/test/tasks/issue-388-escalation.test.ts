import { describe, expect, test, beforeEach, afterEach, spyOn } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Store } from "../../src/tasks/store"
import type { Task, Job } from "../../src/tasks/types"
import { tmpdir } from "../fixture/fixture"
import { processAdversarialVerdicts } from "../../src/tasks/pulse"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { Bus } from "../../src/bus"
import { BackgroundTaskEvent } from "../../src/session/async-tasks"
import { Worktree } from "../../src/worktree"

describe("issue-388: PM escalation after 3 adversarial rejections", () => {
  test("escalates to PM on 3rd adversarial rejection (attempt = 2, zero-based)", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 388,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
          feature_branch: "feature/issue-388-escalation",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task for escalation",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 388,
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
          base_commit: null,
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
              summary: "Still has issues after 2 attempts",
              issues: [
                {
                  location: "src/foo.ts:42",
                  severity: "HIGH" as const,
                  fix: "Fix the null check properly",
                },
              ],
              tested_scenarios: [
                { scenario: "test scenario 1", result: "pass" },
              ],
              coverage_level: "high",
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

        // Process the verdict - should escalate to PM
        await processAdversarialVerdicts(testJob.id, projectId, pmSession.id)

        // Verify task escalated to PM
        const finalTask = await Store.getTask(projectId, testTask.id)
        expect(finalTask?.status).toBe("failed")
        expect(finalTask?.pipeline.adversarial_verdict).toBeNull()
        expect(finalTask?.pipeline.stage).toBe("failed")

        // Verify BackgroundTaskEvent was fired for escalation
        expect(completedEvents).toHaveLength(1)
        expect(completedEvents[0].properties.taskID).toBe(`escalation-${testTask.id}`)

        // Verify comment was added with escalation info
        const comments = finalTask?.comments || []
        const escalationComment = comments.find(c =>
          c.message.includes("Failed after 3 adversarial review cycles")
        )
        expect(escalationComment).toBeDefined()
        expect(escalationComment?.author).toBe("system")

        unsubscribe()
      },
    })
  })

  test("does NOT escalate on 2nd adversarial rejection (attempt = 1)", async () => {
    // Mock SessionPrompt for respawnDeveloper
    const promptSpy = spyOn(SessionPrompt, "prompt").mockImplementation(() => Promise.resolve())
    const cancelSpy = spyOn(SessionPrompt, "cancel").mockImplementation(() => {})
    const removeSpy = spyOn(Worktree, "remove")
    removeSpy.mockImplementation(async () => true)

    try {
      await using tmp = await tmpdir()
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
        const projectId = Instance.project.id
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 388,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
          feature_branch: "feature/issue-388-escalation",
        }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task for escalation",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 388,
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
          base_commit: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          close_reason: null,
          comments: [],
          pipeline: {
            stage: "reviewing",
            attempt: 1, // This is the 2nd attempt (0, 1)
            last_activity: new Date().toISOString(),
            last_steering: null,
            history: [],
            adversarial_verdict: {
              verdict: "ISSUES_FOUND",
              summary: "Has issues after 1 attempt",
              issues: [
                {
                  location: "src/foo.ts:42",
                  severity: "HIGH" as const,
                  fix: "Fix the null check",
                },
              ],
              tested_scenarios: [
                { scenario: "test scenario 1", result: "pass" },
              ],
              coverage_level: "high",
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

        // Process the verdict - should NOT escalate to PM (should be in_progress for respawn)
        await processAdversarialVerdicts(testJob.id, projectId, pmSession.id)

        // Verify task did NOT escalate to PM (should be in_progress for respawn)
        const finalTask = await Store.getTask(projectId, testTask.id)
        expect(finalTask?.status).toBe("in_progress")
        expect(finalTask?.pipeline.stage).toBe("developing")
        expect(finalTask?.pipeline.attempt).toBe(2) // Incremented from 1 to 2
        expect(finalTask?.pipeline.adversarial_verdict).toBeNull()
      },
    })
    } finally {
      promptSpy.mockRestore()
      cancelSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })

  test("APPROVED verdict on 1st attempt does not escalate", async () => {
    // Mock SessionPrompt for commitTask
    const promptSpy = spyOn(SessionPrompt, "prompt").mockImplementation(() => Promise.resolve())
    const cancelSpy = spyOn(SessionPrompt, "cancel").mockImplementation(() => {})
    const removeSpy = spyOn(Worktree, "remove")
    removeSpy.mockImplementation(async () => true)

    try {
      await using tmp = await tmpdir()
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const projectId = Instance.project.id
          const testJob: Job = {
            id: `job-${Date.now()}`,
            parent_issue: 388,
            status: "running",
            created_at: new Date().toISOString(),
            stopping: false,
            pulse_pid: null,
            max_workers: 3,
            pm_session_id: "ses_0000001234567890abctest",
            feature_branch: "feature/issue-388-escalation",
          }

        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Test task for APPROVED",
          description: "Test description",
          acceptance_criteria: "Test criteria",
          parent_issue: 388,
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
          base_commit: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          close_reason: null,
          comments: [],
          pipeline: {
            stage: "reviewing",
            attempt: 0, // 1st attempt
            last_activity: new Date().toISOString(),
            last_steering: null,
            history: [],
            adversarial_verdict: {
              verdict: "APPROVED",
              summary: "Code looks good",
              issues: [],
              tested_scenarios: [
                { scenario: "test scenario 1", result: "pass" },
              ],
              coverage_level: "high",
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

        // Track BackgroundTaskEvent for completion
        const completedEvents: any[] = []
        const unsubscribe = Bus.subscribe(BackgroundTaskEvent.Completed, (event) => {
          completedEvents.push(event)
        })

        // Process the verdict - should commit and close, NOT escalate
        await processAdversarialVerdicts(testJob.id, projectId, pmSession.id)

        // Verify task was NOT escalated (should be closed after commit)
        const finalTask = await Store.getTask(projectId, testTask.id)
        expect(finalTask?.status).toBe("closed")
        expect(finalTask?.close_reason).toBe("approved and committed")
        expect(finalTask?.pipeline.stage).toBe("done")
        expect(finalTask?.pipeline.adversarial_verdict).toBeNull()

        // Verify BackgroundTaskEvent was fired for task completion, not escalation
        expect(completedEvents).toHaveLength(1)
        expect(completedEvents[0].properties.taskID).toBe(testTask.id) // Not `escalation-${testTask.id}`

        unsubscribe()
      },
    })
    } finally {
      promptSpy.mockRestore()
      cancelSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })
})