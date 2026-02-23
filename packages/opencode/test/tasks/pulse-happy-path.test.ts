import { describe, expect, test, spyOn } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Store } from "../../src/tasks/store"
import type { Task, Job } from "../../src/tasks/types"
import { tmpdir } from "../fixture/fixture"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { Worktree } from "../../src/worktree"
import { SessionStatus } from "../../src/session/status"
import * as Scheduler from "../../src/tasks/pulse-scheduler"

// Import the tick functions - these need to be exported from pulse.ts
import {
  scheduleReadyTasks,
  heartbeatActiveAgents,
  processAdversarialVerdicts,
} from "../../src/tasks/pulse"

describe("taskctl pulse: full happy path integration test", () => {
  test("complete happy path: open → developing → reviewing → adversarial-running → done", async () => {
    // Mock SessionPrompt.prompt to return immediately (simulating developer/adversarial completing)
    const promptSpy = spyOn(SessionPrompt, "prompt").mockImplementation(() => Promise.resolve())

    // Mock Worktree.remove to avoid cleanup noise
    const removeSpy = spyOn(Worktree, "remove")
    removeSpy.mockImplementation(async () => true)

    // Mock hasCommittedChanges to return true (simulating developer made commits)
    const hasChangesSpy = spyOn(Scheduler, "hasCommittedChanges").mockImplementation(async () => true)

    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const projectId = Instance.project.id

        // Create a PM session
        const pmSession = await Session.create({
          directory: tmp.path,
          title: "PM session",
          permission: [],
        })

        // Create a job
        const testJob: Job = {
          id: `job-${Date.now()}`,
          parent_issue: 257,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: pmSession.id,
          feature_branch: `feature/issue-257-test`,
        }

        // Create a task in open state
        const testTask: Task = {
          id: `tsk_${Date.now()}${Math.random().toString(36).slice(2, 10)}`,
          title: "Implement feature X",
          description: "Implement feature X with TDD",
          acceptance_criteria: "Tests pass and feature works",
          parent_issue: 257,
          job_id: testJob.id,
          status: "open",
          priority: 2,
          task_type: "implementation",
          labels: ["module:taskctl"],
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

        // Step 1: Schedule ready tasks - should spawn developer
        await scheduleReadyTasks(testJob.id, projectId, pmSession.id)

        let task = await Store.getTask(projectId, testTask.id)
        expect(task?.status).toBe("in_progress")
        expect(task?.pipeline.stage).toBe("developing")
        expect(task?.assignee).toBeTruthy()
        expect(task?.assignee_pid).toBe(process.pid)
        expect(task?.worktree).toBeTruthy()

        const devSessionId = task?.assignee!

        // Step 2: Simulate developer session completing
        // In real flow, SessionPrompt sets session to idle via defer(() => cancel())
        // Here we manually set it to idle to simulate completion
        SessionStatus.set(devSessionId, { type: "idle" })

        // Step 3: Heartbeat active agents - should detect idle session and transition to reviewing
        await heartbeatActiveAgents(testJob.id, projectId)

        task = await Store.getTask(projectId, testTask.id)
        expect(task?.status).toBe("in_progress")
        expect(task?.pipeline.stage).toBe("reviewing")

        // Step 4: Schedule tasks again - should spawn adversarial
        await scheduleReadyTasks(testJob.id, projectId, pmSession.id)

        task = await Store.getTask(projectId, testTask.id)
        expect(task?.pipeline.stage).toBe("adversarial-running")

        // Step 5: Simulate adversarial completing and setting APPROVED verdict
        const verdict = {
          verdict: "APPROVED" as const,
          summary: "Code looks good",
          issues: [],
          created_at: new Date().toISOString(),
        }

        await Store.updateTask(
          projectId,
          testTask.id,
          {
            status: "review",
            pipeline: {
              ...task!.pipeline,
              adversarial_verdict: verdict,
            },
          },
          true,
        )

        // Step 6: Process adversarial verdicts - should commit and close task
        await processAdversarialVerdicts(testJob.id, projectId, pmSession.id)

        task = await Store.getTask(projectId, testTask.id)
        expect(task?.status).toBe("closed")
        expect(task?.close_reason).toBe("approved and committed")
        expect(task?.pipeline.stage).toBe("done")
        expect(task?.pipeline.adversarial_verdict).toBeNull()
      },
    })

    // Clean up mocks
    promptSpy.mockRestore()
    removeSpy.mockRestore()
    hasChangesSpy.mockRestore()
  })
})