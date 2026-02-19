import { describe, expect, test } from "bun:test"
import { Store } from "../../src/tasks/store"
import type { Task } from "../../src/tasks/types"
import { tmpdir } from "../fixture/fixture"
import path from "path"
import { randomUUID } from "crypto"

function getProjectId(): string {
  return `test-store-${randomUUID()}`
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