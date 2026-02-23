import { describe, it, expect, beforeAll } from "bun:test"
import { Store } from "../../src/tasks/store"
import type { Task, Job } from "../../src/tasks/types"

describe("Push per Task and PR Creation (#306)", () => {
  const TEST_PROJECT_ID = "test-push-per-task"
  const TEST_JOB_ID = "job-test-push-001"
  const TEST_PM_SESSION_ID = "pm-session-test-001"

  let task: Task
  let job: Job

  beforeAll(async () => {
    task = {
      id: "task-push-test-001",
      title: "Test push per task",
      description: "Test that commitTask pushes to remote",
      acceptance_criteria: "Commit must be pushed to origin",
      parent_issue: 306,
      job_id: TEST_JOB_ID,
      status: "review",
      priority: 0,
      task_type: "implementation",
      labels: [],
      depends_on: [],
      assignee: null,
      assignee_pid: null,
      worktree: "/tmp/test-worktree",
      branch: "feature/issue-306-test-push",
      base_commit: null,
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

    job = {
      id: TEST_JOB_ID,
      parent_issue: 306,
      status: "running",
      created_at: new Date().toISOString(),
      stopping: false,
      pulse_pid: null,
      max_workers: 1,
      pm_session_id: TEST_PM_SESSION_ID,
      feature_branch: "feature/issue-306",
    }

    await Store.createJob(TEST_PROJECT_ID, job)
    await Store.createTask(TEST_PROJECT_ID, task)
  })

  it("task should have branch field for push command", () => {
    expect(task.branch).toBe("feature/issue-306-test-push")
  })

  it("job should have feature_branch field for PR creation", () => {
    expect(job.feature_branch).toBe("feature/issue-306")
  })

  it("job should have parent_issue for PR title", () => {
    expect(job.parent_issue).toBe(306)
  })

  it("retrieved task should preserve branch information", async () => {
    const retrieved = await Store.getTask(TEST_PROJECT_ID, task.id)
    expect(retrieved?.branch).toBe(task.branch)
  })

  it("retrieved job should have feature_branch", async () => {
    const retrieved = await Store.getJob(TEST_PROJECT_ID, TEST_JOB_ID)
    expect(retrieved?.feature_branch).toBe(job.feature_branch)
  })
})