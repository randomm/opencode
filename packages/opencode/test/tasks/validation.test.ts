import { describe, expect, test } from "bun:test"
import { Store } from "../../src/tasks/store"
import { Validation } from "../../src/tasks/validation"
import type { Task } from "../../src/tasks/types"
import { tmpdir } from "../fixture/fixture"
import { randomUUID } from "crypto"

function getProjectId(): string {
  return `test-validation-${randomUUID()}`
}

describe("validation: validateGraph", () => {
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
      labels: ["module:test", "file:test.ts"],
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
      ...overrides,
    }
  }

  test("returns valid:true for a clean graph", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("task-1"))
    await Store.createTask(projectId, createTask("task-2"))

    const result = await Validation.validateGraph(projectId)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
  })

  test("catches circular dependencies A -> B -> A", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("task-a", { depends_on: ["task-b"] }))
    await Store.createTask(projectId, createTask("task-b", { depends_on: ["task-a"] }))

    const result = await Validation.validateGraph(projectId)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    const hasCycleError = result.errors.some((err) => err.includes("Circular dependency"))
    expect(hasCycleError).toBe(true)
  })

  test("catches circular dependencies A -> B -> C -> A", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("task-a", { depends_on: ["task-b"] }))
    await Store.createTask(projectId, createTask("task-b", { depends_on: ["task-c"] }))
    await Store.createTask(projectId, createTask("task-c", { depends_on: ["task-a"] }))

    const result = await Validation.validateGraph(projectId)
    expect(result.valid).toBe(false)
    const hasCycleError = result.errors.some((err) => err.includes("Circular dependency"))
    expect(hasCycleError).toBe(true)
  })

  test("catches missing task IDs in depends_on", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("task-1", { depends_on: ["non-existent-task"] }))

    const result = await Validation.validateGraph(projectId)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    const hasMissingDepError = result.errors.some((err) =>
      err.includes("non-existent task") || err.includes("non-existent-task"),
    )
    expect(hasMissingDepError).toBe(true)
  })

  test("warns on missing acceptance_criteria", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(
      projectId,
      createTask("task-no-criteria", { acceptance_criteria: "" }),
    )

    const result = await Validation.validateGraph(projectId)
    expect(result.valid).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
    const hasCriteriaWarning = result.warnings.some((err) =>
      err.includes("missing acceptance criteria") || err.includes("missing-acceptance-criteria"),
    )
    expect(hasCriteriaWarning).toBe(true)
  })

  test("warns on missing conflict labels", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("task-no-labels", { labels: [] }))

    const result = await Validation.validateGraph(projectId)
    expect(result.valid).toBe(true)
    expect(result.warnings.length).toBeGreaterThan(0)
    const hasLabelWarning = result.warnings.some((err) =>
      err.includes("conflict labels") || err.includes("module:") || err.includes("file:"),
    )
    expect(hasLabelWarning).toBe(true)
  })

  test("allows module: labels (no warning)", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(
      projectId,
      createTask("task-module-label", { labels: ["module:auth"] }),
    )

    const result = await Validation.validateGraph(projectId)
    expect(result.valid).toBe(true)
    const hasLabelWarning = result.warnings.some((err) =>
      err.includes("task-module-label") && err.includes("conflict labels"),
    )
    expect(hasLabelWarning).toBe(false)
  })

  test("allows file: labels (no warning)", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(
      projectId,
      createTask("task-file-label", { labels: ["file:src/auth.ts"] }),
    )

    const result = await Validation.validateGraph(projectId)
    expect(result.valid).toBe(true)
    const hasLabelWarning = result.warnings.some((err) =>
      err.includes("task-file-label") && err.includes("conflict labels"),
    )
    expect(hasLabelWarning).toBe(false)
  })

  test("collects multiple errors and warnings", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(
      projectId,
      createTask("task-1", {
        depends_on: ["task-3"],
        acceptance_criteria: "",
        labels: [],
      }),
    )
    await Store.createTask(
      projectId,
      createTask("task-2", {
        depends_on: ["task-3"],
        acceptance_criteria: "",
      }),
    )

    const result = await Validation.validateGraph(projectId)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  test("valid graph with valid dependencies passes", async () => {
    await using tmp = await tmpdir()
    const projectId = getProjectId()

    await Store.createTask(projectId, createTask("base", {}))
    await Store.createTask(
      projectId,
      createTask("dependent", { depends_on: ["base"] }),
    )

    await Store.updateTask(projectId, "base", { status: "closed" })

    const result = await Validation.validateGraph(projectId)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})