import { describe, expect, test } from "bun:test"
import { Store } from "../../src/tasks/store"
import type { Task, Job } from "../../src/tasks/types"
import { tmpdir } from "../fixture/fixture"
import path from "path"
import { randomUUID } from "crypto"
import fs from "fs/promises"

function getProjectId(): string {
  return `test-store-${randomUUID()}`
}

function createJob(override: Partial<Job>): Job {
  return {
    id: `job-${randomUUID()}`,
    parent_issue: 1,
    status: "running",
    created_at: new Date().toISOString(),
    stopping: false,
    pulse_pid: null,
    max_workers: 4,
    pm_session_id: randomUUID(),
    ...override,
  }
}

function isValidISODate(dateStr: string): boolean {
  return !isNaN(Date.parse(dateStr))
}

describe("store: task operations", () => {
  test("write task and verify file exists", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const now = new Date().toISOString()

    const task: Task = {
      id: "add-oauth2-schema",
      title: "Add OAuth2 schema",
      description: "Add OAuth2 schema to database",
      acceptance_criteria: "Schema must support access tokens and refresh tokens",
      parent_issue: 123,
      job_id: "job-1",
      status: "open",
      priority: 2,
      task_type: "implementation",
      labels: ["module:auth", "file:src/auth/oauth.ts"],
      depends_on: [],
assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        base_commit: null,
        created_at: now,
      updated_at: now,
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

    await Store.createTask(projectId, task)

    const retrieved = await Store.getTask(projectId, "add-oauth2-schema")
    expect(retrieved).not.toBeNull()
    expect(retrieved!.id).toBe("add-oauth2-schema")
    expect(retrieved!.title).toBe("Add OAuth2 schema")
    expect(retrieved!.status).toBe("open")
  })

  test("update task and verify updated", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const now = new Date().toISOString()

    const task: Task = {
      id: "update-test",
      title: "Test task",
      description: "Test description",
      acceptance_criteria: "Test criteria",
      parent_issue: 1,
      job_id: "job-1",
      status: "open",
      priority: 2,
      task_type: "implementation",
      labels: [],
      depends_on: [],
assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        base_commit: null,
        created_at: now,
      updated_at: now,
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

    await Store.createTask(projectId, task)
    await Store.updateTask(projectId, "update-test", {
      status: "in_progress",
      assignee: "agent-1",
      assignee_pid: 12345,
    })

    const updated = await Store.getTask(projectId, "update-test")
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe("in_progress")
    expect(updated!.assignee).toBe("agent-1")
    expect(updated!.assignee_pid).toBe(12345)
    expect(isValidISODate(updated!.updated_at)).toBe(true)
  })

  test("list all tasks", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const now = new Date().toISOString()

    const task1: Task = {
      id: "task-1",
      title: "Task 1",
      description: "Description 1",
      acceptance_criteria: "Criteria 1",
      parent_issue: 1,
      job_id: "job-1",
      status: "open",
      priority: 1,
      task_type: "implementation",
      labels: [],
      depends_on: [],
assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        base_commit: null,
        created_at: now,
      updated_at: now,
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

    const task2: Task = {
      id: "task-2",
      title: "Task 2",
      description: "Description 2",
      acceptance_criteria: "Criteria 2",
      parent_issue: 2,
      job_id: "job-1",
      status: "open",
      priority: 2,
      task_type: "test",
      labels: [],
      depends_on: [],
assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        base_commit: null,
        created_at: now,
      updated_at: now,
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

    await Store.createTask(projectId, task1)
    await Store.createTask(projectId, task2)

    const tasks = await Store.listTasks(projectId)
    expect(tasks.length).toBe(2)
    expect(tasks.map((t) => t.id).sort()).toEqual(["task-1", "task-2"])
  })

  test("add comment to task", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const now = new Date().toISOString()

    const task: Task = {
      id: "comment-test",
      title: "Comment test",
      description: "Test description",
      acceptance_criteria: "Test criteria",
      parent_issue: 1,
      job_id: "job-1",
      status: "open",
      priority: 2,
      task_type: "implementation",
      labels: [],
      depends_on: [],
assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        base_commit: null,
        created_at: now,
      updated_at: now,
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

    await Store.createTask(projectId, task)

    await Store.addComment(projectId, "comment-test", {
      author: "test-agent",
      message: "Test comment",
      created_at: now,
    })

    const updated = await Store.getTask(projectId, "comment-test")
    if (!updated) throw new Error("Task not found")
    expect(updated.comments.length).toBeGreaterThan(0)
    if (!updated.comments[0]) throw new Error("Comment not found")
    expect(updated.comments[0].author).toBe("test-agent")
    expect(updated.comments[0].message).toBe("Test comment")
  })
})

describe("store: findJobByIssue", () => {
  test("returns most recent running job when multiple jobs exist", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const olderDate = new Date(Date.now() - 60000).toISOString()
    const newerDate = new Date(Date.now() - 30000).toISOString()

    const olderJob = createJob({ parent_issue: 1, status: "running", created_at: olderDate })
    const newerJob = createJob({ parent_issue: 1, status: "running", created_at: newerDate })

    await Store.createJob(projectId, olderJob)
    await Store.createJob(projectId, newerJob)

    const found = await Store.findJobByIssue(projectId, 1)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(newerJob.id)
    expect(found!.created_at).toBe(newerDate)
  })

  test("returns most recently created stopped job if no running job", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const olderDate = new Date(Date.now() - 60000).toISOString()
    const newerDate = new Date(Date.now() - 30000).toISOString()

    const olderJob = createJob({ parent_issue: 1, status: "stopped", created_at: olderDate })
    const newerJob = createJob({ parent_issue: 1, status: "stopped", created_at: newerDate })

    await Store.createJob(projectId, olderJob)
    await Store.createJob(projectId, newerJob)

    const found = await Store.findJobByIssue(projectId, 1)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(newerJob.id)
    expect(found!.status).toBe("stopped")
  })

  test("prefers running job over newer stopped job", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const olderDate = new Date(Date.now() - 60000).toISOString()
    const newerDate = new Date(Date.now() - 30000).toISOString()

    const runningJob = createJob({ parent_issue: 1, status: "running", created_at: olderDate })
    const stoppedJob = createJob({ parent_issue: 1, status: "stopped", created_at: newerDate })

    await Store.createJob(projectId, runningJob)
    await Store.createJob(projectId, stoppedJob)

    const found = await Store.findJobByIssue(projectId, 1)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(runningJob.id)
    expect(found!.status).toBe("running")
  })

  test("returns null when no jobs exist for issue", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    const found = await Store.findJobByIssue(projectId, 999)
    expect(found).toBeNull()
  })

  test("ignores jobs for different issue numbers", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    const job1 = createJob({ parent_issue: 1, status: "running" })
    const job2 = createJob({ parent_issue: 2, status: "running" })

    await Store.createJob(projectId, job1)
    await Store.createJob(projectId, job2)

    const found = await Store.findJobByIssue(projectId, 1)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(job1.id)
    expect(found!.parent_issue).toBe(1)
  })

  test("handles malformed job file gracefully", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const validJob = createJob({ parent_issue: 1, status: "running" })

    await Store.createJob(projectId, validJob)
    const tasksDir = path.join(tmp.path, "tasks", projectId)
    await fs.mkdir(tasksDir, { recursive: true })
    await Bun.write(path.join(tasksDir, "job-invalid.json"), "{ broken json")

    const found = await Store.findJobByIssue(projectId, 1)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(validJob.id)
  })

  test("ignores job with missing required fields", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const validJob = createJob({ parent_issue: 1, status: "running" })
    const tasksDir = path.join(tmp.path, "tasks", projectId)

    await Store.createJob(projectId, validJob)
    await fs.mkdir(tasksDir, { recursive: true })
    await Bun.write(
      path.join(tasksDir, "job-incomplete.json"),
      JSON.stringify({ id: "incomplete", parent_issue: 1 }),
    )

    const found = await Store.findJobByIssue(projectId, 1)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(validJob.id)
  })

  test("ignores job with invalid created_at date", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const validJob = createJob({ parent_issue: 1, status: "running" })
    const invalidJob = {
      id: `job-${randomUUID()}`,
      parent_issue: 1,
      status: "running" as const,
      created_at: "not-a-date",
      stopping: false,
      pulse_pid: null,
      max_workers: 4,
      pm_session_id: randomUUID(),
    }

    await Store.createJob(projectId, validJob)
    await Store.createJob(projectId, invalidJob as Job)

    const found = await Store.findJobByIssue(projectId, 1)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(validJob.id)
  })

  test("ignores job with invalid status", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()
    const validJob = createJob({ parent_issue: 1, status: "running" })
    const tasksDir = path.join(tmp.path, "tasks", projectId)

    await Bun.write(
      path.join(tasksDir, "job-invalid-status.json"),
      JSON.stringify({
        id: `job-${randomUUID()}`,
        parent_issue: 1,
        status: "invalidStatus",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 4,
        pm_session_id: randomUUID(),
      }),
    )

    await Store.createJob(projectId, validJob)
    await fs.mkdir(tasksDir, { recursive: true })

    const found = await Store.findJobByIssue(projectId, 1)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(validJob.id)
  })
})