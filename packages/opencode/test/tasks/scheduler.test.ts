import { describe, expect, test } from "bun:test"
import { Store } from "../../src/tasks/store"
import { Scheduler } from "../../src/tasks/scheduler"
import type { Task } from "../../src/tasks/types"
import { tmpdir } from "../fixture/fixture"
import { randomUUID } from "crypto"

function getProjectId(): string {
  return `test-scheduler-${randomUUID()}`
}

describe("scheduler: getNextTasks", () => {
  function createTask(
    id: string,
    overrides: Partial<Task> = {},
  ): Task {
    const now = new Date().toISOString()
    return {
      id,
      title: `Task ${id}`,
      description: `Description for ${id}`,
      acceptance_criteria: `Criteria for ${id}`,
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
      ...overrides,
    }
  }

  test("returns tasks in priority order", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("high-priority", { priority: 0 }))
    await Store.createTask(projectId, createTask("medium-priority", { priority: 2 }))
    await Store.createTask(projectId, createTask("low-priority", { priority: 4 }))

    const tasks = await Scheduler.getNextTasks(projectId, 10)
    expect(tasks).toHaveLength(3)
    if (!tasks[0] || !tasks[1] || !tasks[2]) throw new Error("Missing tasks")
    expect(tasks[0].id).toBe("high-priority")
    expect(tasks[1].id).toBe("medium-priority")
    expect(tasks[2].id).toBe("low-priority")
  })

  test("excludes tasks with unmet depends_on", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("base-task"))
    await Store.createTask(projectId, createTask("dependent-task", { depends_on: ["base-task"] }))
    await Store.createTask(projectId, createTask("ready-task"))

    const tasks = await Scheduler.getNextTasks(projectId, 10)
    const taskIds = tasks.map((t) => t.id)
    expect(taskIds).toContain("base-task")
    expect(taskIds).toContain("ready-task")
    expect(taskIds).not.toContain("dependent-task")
  })

  test("includes dependent task when its dependency is closed", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("base-task"))
    await Store.createTask(projectId, createTask("dependent-task", { depends_on: ["base-task"] }))

    await Store.updateTask(projectId, "base-task", { status: "closed" })

    const tasks = await Scheduler.getNextTasks(projectId, 10)
    const taskIds = tasks.map((t) => t.id)
    expect(taskIds).toContain("dependent-task")
  })

  test("excludes tasks with conflicting module labels", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(
      projectId,
      createTask("task-a", { status: "open", labels: ["module:auth"] }),
    )
    await Store.createTask(
      projectId,
      createTask("task-b", { status: "in_progress", labels: ["module:auth"] }),
    )
    await Store.createTask(
      projectId,
      createTask("task-c", { status: "open", labels: ["module:db"] }),
    )

    const tasks = await Scheduler.getNextTasks(projectId, 10)
    const taskIds = tasks.map((t) => t.id)
    expect(taskIds).toContain("task-a")
    expect(taskIds).not.toContain("task-b")
    expect(taskIds).toContain("task-c")
  })

  test("excludes tasks with conflicting file labels", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(
      projectId,
      createTask("task-a", { status: "open", labels: ["file:src/auth.ts"] }),
    )
    await Store.createTask(
      projectId,
      createTask("task-b", { status: "in_progress", labels: ["file:src/auth.ts"] }),
    )
    await Store.createTask(
      projectId,
      createTask("task-c", { status: "open", labels: ["file:src/db.ts"] }),
    )

    const tasks = await Scheduler.getNextTasks(projectId, 10)
    const taskIds = tasks.map((t) => t.id)
    expect(taskIds).toContain("task-a")
    expect(taskIds).not.toContain("task-b")
    expect(taskIds).toContain("task-c")
  })

  test("sorts alphabetically within same priority", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("zebra", { priority: 1 }))
    await Store.createTask(projectId, createTask("apple", { priority: 1 }))
    await Store.createTask(projectId, createTask("banana", { priority: 1 }))

    const tasks = await Scheduler.getNextTasks(projectId, 10)
    expect(tasks).toHaveLength(3)
    if (!tasks[0] || !tasks[1] || !tasks[2]) throw new Error("Missing tasks")
    expect(tasks[0].id).toBe("apple")
    expect(tasks[1].id).toBe("banana")
    expect(tasks[2].id).toBe("zebra")
  })

  test("returns empty array when all tasks are in_progress", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("task-1", { status: "in_progress" }))
    await Store.createTask(projectId, createTask("task-2", { status: "in_progress" }))

    const tasks = await Scheduler.getNextTasks(projectId, 10)
    expect(tasks.length).toBe(0)
  })

  test("respects count parameter", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("task-1"))
    await Store.createTask(projectId, createTask("task-2"))
    await Store.createTask(projectId, createTask("task-3"))

    const tasks = await Scheduler.getNextTasks(projectId, 2)
    expect(tasks.length).toBe(2)
  })
})