import { beforeEach, describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Store } from "../../src/tasks/store"
import type { Task, Job } from "../../src/tasks/types"

describe("taskctl pipeline: verdict data validation", () => {
  let projectId: string
  let testJob: Job
  let testTask: Task

  beforeEach(async () => {
    const testDir = `/tmp/taskctl-pipeline-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await Instance.provide({
      directory: testDir,
      fn: async () => {
        projectId = Instance.project.id
        testJob = {
          id: `job-${Date.now()}`,
          parent_issue: 205,
          status: "running",
          created_at: new Date().toISOString(),
          stopping: false,
          pulse_pid: null,
          max_workers: 3,
          pm_session_id: "ses_0000001234567890abctest",
        }

        testTask = {
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
          worktree: "/tmp/test-worktree",
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
      },
    })
  })

  test("APPROVED verdict stores correctly", async () => {
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
  })

  test("ISSUES_FOUND verdict stores structured feedback", async () => {
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
  })

  test("CRITICAL_ISSUES_FOUND verdict stores severity correctly", async () => {
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
  })

  test("multiple issues stored in single verdict", async () => {
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
  })

  test("all severity levels stored correctly", async () => {
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
  })
})
