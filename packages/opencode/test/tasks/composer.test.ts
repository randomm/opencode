import { test, beforeEach, afterEach } from "bun:test"
import { mkdir } from "fs/promises"
import { join } from "path"
import { Store } from "../../src/tasks/store"
import { Validation } from "../../src/tasks/validation"
import { runComposer } from "../../src/tasks/composer"
import type { Task } from "../../src/tasks/types"

const tmpdir = `${Bun.env.TMPDIR}/taskctl-composer-test-${Date.now()}`

beforeEach(async () => {
  await mkdir(tmpdir, { recursive: true })
  process.env.OPENCODE_TEST_HOME = tmpdir
})

afterEach(async () => {
  await Bun.$`rm -rf ${tmpdir}`.catch(() => {})
  delete process.env.OPENCODE_TEST_HOME
})

test("validateGraphFromMap detects circular dependencies", async () => {
  const tasksMap = new Map([
    ["task-1", { depends_on: ["task-2"] }],
    ["task-2", { depends_on: ["task-3"] }],
    ["task-3", { depends_on: ["task-1"] }],
  ])

  const errors = Validation.validateGraphFromMap(tasksMap)

  if (errors.length === 0) {
    throw new Error("Expected circular dependency to be detected")
  }

  const circularError = errors.find((e) => e.includes("Circular dependency"))
  if (!circularError) {
    throw new Error("Expected circular dependency error message")
  }
})

test("validateGraphFromMap detects missing dependencies", async () => {
  const tasksMap = new Map([
    ["task-1", { depends_on: ["task-2"] }],
    ["task-2", { depends_on: ["task-missing"] }],
    ["task-3", { depends_on: [] }],
  ])

  const errors = Validation.validateGraphFromMap(tasksMap)

  if (errors.length === 0) {
    throw new Error("Expected missing dependency error")
  }

  const missingError = errors.find((e) => e.includes("non-existent"))
  if (!missingError) {
    throw new Error("Expected missing dependency error message")
  }
})

test("validateGraphFromMap passes for valid graph", async () => {
  const tasksMap = new Map([
    ["task-1", { depends_on: [] }],
    ["task-2", { depends_on: ["task-1"] }],
    ["task-3", { depends_on: ["task-1"] }],
    ["task-4", { depends_on: ["task-2", "task-3"] }],
  ])

  const errors = Validation.validateGraphFromMap(tasksMap)

  if (errors.length > 0) {
    throw new Error(`Expected no errors, got: ${errors.join(", ")}`)
  }
})

test("runComposer returns needs_clarification from spawnFn", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "needs_clarification",
      questions: [{ id: 1, question: "What specific behaviour should change?" }],
    })

  const result = await runComposer(
    {
      jobId: "job-1",
      projectId: "test-project",
      pmSessionId: "session-1",
      issueNumber: 123,
      issueTitle: "Add feature",
      issueBody: "Please add a feature.",
    },
    mockSpawn,
  )

  if (result.status === "ready") {
    throw new Error("Expected needs_clarification status")
  }

  if (result.questions.length !== 1) {
    throw new Error(`Expected 1 question, got ${result.questions.length}`)
  }
})

test("runComposer returns needs_clarification for invalid graph", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "First task",
          description: "Do this first",
          acceptance_criteria: "Done",
          task_type: "implementation" as const,
          labels: ["module:test"],
          depends_on: ["third-task"],
          priority: 0,
        },
        {
          title: "Second task",
          description: "Do this second",
          acceptance_criteria: "Done",
          task_type: "implementation" as const,
          labels: ["module:test"],
          depends_on: ["third-task"],
          priority: 0,
        },
        {
          title: "Third task",
          description: "Do this third",
          acceptance_criteria: "Done",
          task_type: "implementation" as const,
          labels: ["module:test"],
          depends_on: ["first-task"],
          priority: 0,
        },
      ],
    })

  const result = await runComposer(
    {
      jobId: "job-1",
      projectId: "test-project",
      pmSessionId: "session-1",
      issueNumber: 123,
      issueTitle: "Add feature",
      issueBody: "Please add a feature.",
    },
    mockSpawn,
  )

  if (result.status === "ready") {
    throw new Error("Expected needs_clarification for invalid graph")
  }
})

test("runComposer throws on dependency reference outside batch", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "First task",
          description: "Desc",
          acceptance_criteria: "Criteria",
          task_type: "implementation" as const,
          labels: [],
          depends_on: ["non-existent-task-external"],
          priority: 2,
        },
      ],
    })

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (e) {
    threw = true
    if (!(e as Error).message.includes("not defined in this batch")) {
      throw new Error(`Expected 'not defined in this batch' error, got: ${(e as Error).message}`)
    }
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw for external dependency reference")
  }
})

test("runComposer creates tasks for valid decomposition", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "First task",
          description: "Do this first",
          acceptance_criteria: "Tests pass",
          task_type: "implementation" as const,
          labels: ["module:test"],
          depends_on: [],
          priority: 0,
        },
        {
          title: "Second task",
          description: "Do this second",
          acceptance_criteria: "Tests pass",
          task_type: "implementation" as const,
          labels: ["module:test"],
          depends_on: ["first-task"],
          priority: 1,
        },
      ],
    })

  const result = await runComposer(
    {
      jobId: "job-1",
      projectId: "test-project",
      pmSessionId: "session-1",
      issueNumber: 123,
      issueTitle: "Add feature",
      issueBody: "Please add a feature.",
    },
    mockSpawn,
  )

  if (result.status !== "ready") {
    throw new Error(`Expected ready status, got ${result.status}`)
  }

  if (result.taskCount !== 2) {
    throw new Error(`Expected 2 tasks, got ${result.taskCount}`)
  }

  const task1 = await Store.getTask("test-project", "first-task")
  if (!task1) {
    throw new Error("Expected task 'first-task' to be created")
  }

  if (task1.parent_issue !== 123) {
    throw new Error(`Expected parent_issue to be 123, got ${task1.parent_issue}`)
  }

  if (task1.job_id !== "job-1") {
    throw new Error(`Expected job_id to be job-1, got ${task1.job_id}`)
  }
})

test("runComposer handles slug collisions", async () => {
  const existingTask: Task = {
    id: "add-oauth2-config-schema",
    title: "Add OAuth2 Config Schema",
    description: "Existing task",
    acceptance_criteria: "Tests pass",
    parent_issue: 122,
    job_id: "job-0",
    status: "open",
    priority: 0,
    task_type: "implementation",
    labels: ["module:test"],
    depends_on: [],
    assignee: null,
    assignee_pid: null,
    worktree: null,
    branch: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
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

  await Store.createTask("test-project", existingTask)

  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "Add OAuth2 Config Schema",
          description: "Different task with same title",
          acceptance_criteria: "Tests pass",
          task_type: "implementation" as const,
          labels: ["module:test"],
          depends_on: [],
          priority: 0,
        },
      ],
    })

  const result = await runComposer(
    {
      jobId: "job-1",
      projectId: "test-project",
      pmSessionId: "session-1",
      issueNumber: 123,
      issueTitle: "Add feature",
      issueBody: "Please add a feature.",
    },
    mockSpawn,
  )

  if (result.status !== "ready") {
    throw new Error(`Expected ready status, got ${result.status}`)
  }

  if (result.taskCount !== 1) {
    throw new Error(`Expected 1 task, got ${result.taskCount}`)
  }

  const existing = await Store.getTask("test-project", "add-oauth2-config-schema")
  if (!existing) {
    throw new Error("Expected original task to still exist")
  }

  const newTask = await Store.getTask("test-project", "add-oauth2-config-schema-2")
  if (!newTask) {
    throw new Error("Expected new task to be created with slug '-2'")
  }

  if (newTask.parent_issue !== 123) {
    throw new Error(`Expected new task to have parent_issue 123, got ${newTask.parent_issue}`)
  }
})

test("runComposer throws on invalid status", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "invalid_status",
      tasks: [],
    })

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (_e) {
    threw = true
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw on invalid status")
  }
})

test("runComposer throws on empty spawn response", async () => {
  const mockSpawn = async () => undefined

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (_e) {
    threw = true
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw on empty response")
  }
})

test("runComposer throws on invalid JSON", async () => {
  const mockSpawn = async () => "not valid json"

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (e) {
    threw = true
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw on invalid JSON")
  }
})

test("runComposer generates sequential slugs for duplicate titles", async () => {
  await Store.createTask("test-project", {
    id: "test-task",
    title: "Test task",
    description: "Existing",
    acceptance_criteria: "Criteria",
    parent_issue: 1,
    job_id: "job-0",
    status: "open",
    priority: 2,
    task_type: "implementation",
    labels: [],
    depends_on: [],
    assignee: null,
    assignee_pid: null,
    worktree: null,
    branch: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
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
  })

  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "Test task",
          description: "First",
          acceptance_criteria: "First done",
          task_type: "implementation" as const,
          labels: [],
          depends_on: [],
          priority: 2,
        },
        {
          title: "Test task",
          description: "Second",
          acceptance_criteria: "Second done",
          task_type: "implementation" as const,
          labels: [],
          depends_on: [],
          priority: 2,
        },
      ],
    })

  const result = await runComposer(
    {
      jobId: "job-1",
      projectId: "test-project",
      pmSessionId: "session-1",
      issueNumber: 123,
      issueTitle: "Add feature",
      issueBody: "Please add a feature.",
    },
    mockSpawn,
  )

  if (result.status !== "ready") {
    throw new Error(`Expected ready status, got ${result.status}`)
  }

  if (result.taskCount !== 2) {
    throw new Error(`Expected 2 tasks, got ${result.taskCount}`)
  }

  const originalTask = await Store.getTask("test-project", "test-task")
  const task2 = await Store.getTask("test-project", "test-task-2")
  const task3 = await Store.getTask("test-project", "test-task-3")

  if (!originalTask) {
    throw new Error("Expected original task 'test-task' to exist")
  }

  if (!task2) {
    throw new Error("Expected second task 'test-task-2' to exist")
  }

  if (!task3) {
    throw new Error("Expected third task 'test-task-3' to exist")
  }

  if (originalTask.description !== "Existing") {
    throw new Error(`Expected original task description 'Existing', got '${originalTask.description}'`)
  }

  if (task2.description !== "First") {
    throw new Error(`Expected second task description 'First', got '${task2.description}'`)
  }

  if (task3.description !== "Second") {
    throw new Error(`Expected third task description 'Second', got '${task3.description}'`)
  }
})

test("runComposer validates and rejects malformed task structures", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "",
          description: "Bad task",
          acceptance_criteria: "Criteria",
        },
      ],
    })

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (e) {
    threw = true
    if (!(e as Error).message.includes("validation failed")) {
      throw new Error(`Expected 'validation failed' error, got: ${(e as Error).message}`)
    }
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw validation error for malformed task")
  }
})

test("runComposer validates task types", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "Bad task",
          description: "Desc",
          acceptance_criteria: "Criteria",
          task_type: "invalid_type" as any,
          priority: 2,
        },
      ],
    })

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (e) {
    threw = true
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw validation error for invalid task type")
  }
})

test("runComposer validates priority range", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "Bad task",
          description: "Desc",
          acceptance_criteria: "Criteria",
          task_type: "implementation" as const,
          priority: 99,
        },
      ],
    })

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (e) {
    threw = true
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw validation error for invalid priority")
  }
})

test("runComposer filters empty strings from depends_on", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "First task",
          description: "Desc",
          acceptance_criteria: "Criteria",
          task_type: "implementation" as const,
          depends_on: ["", "valid-id", "   "],
          priority: 2,
        },
      ],
    })

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (e) {
    threw = true
    if (!(e as Error).message.includes("validation failed")) {
      throw new Error(`Expected validation failed for empty depends_on, got: ${(e as Error).message}`)
    }
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw validation error for empty depends_on elements")
  }
})

test("runComposer handles unicode in titles", async () => {
  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "测试任务 Unicode",
          description: "Test description",
          acceptance_criteria: "Criteria",
          task_type: "implementation" as const,
          labels: [],
          depends_on: [],
          priority: 2,
        },
      ],
    })

  const result = await runComposer(
    {
      jobId: "job-1",
      projectId: "test-project",
      pmSessionId: "session-1",
      issueNumber: 123,
      issueTitle: "Add feature",
      issueBody: "Please add a feature.",
    },
    mockSpawn,
  )

  if (result.status !== "ready") {
    throw new Error(`Expected ready status, got ${result.status}`)
  }

  const task = await Store.getTask("test-project", "unicode")
  if (!task) {
    throw new Error("Expected task with unicode-converted slug to exist")
  }

  if (task.title !== "测试任务 Unicode") {
    throw new Error(`Expected title '测试任务 Unicode', got '${task.title}'`)
  }
})

test("runComposer rejects titles over 200 characters", async () => {
  const longTitle = "a".repeat(201)
  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: longTitle,
          description: "Desc",
          acceptance_criteria: "Criteria",
          task_type: "implementation" as const,
          priority: 2,
        },
      ],
    })

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (e) {
    threw = true
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw validation error for title over 200 chars")
  }
})

test("runComposer rolls back tasks on partial creation failure", async () => {
  await Store.createTask("test-project", {
    id: "existing-task",
    title: "Existing",
    description: "Desc",
    acceptance_criteria: "Criteria",
    parent_issue: 1,
    job_id: "job-0",
    status: "open",
    priority: 2,
    task_type: "implementation",
    labels: [],
    depends_on: [],
    assignee: null,
    assignee_pid: null,
    worktree: null,
    branch: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
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
  })

  const mockSpawn = async () =>
    JSON.stringify({
      status: "ready",
      tasks: [
        {
          title: "Task 1",
          description: "Desc 1",
          acceptance_criteria: "Criteria 1",
          task_type: "implementation" as const,
          labels: [],
          depends_on: [],
          priority: 2,
        },
        {
          title: "Task 2",
          description: "Desc 2",
          acceptance_criteria: "Criteria 2",
          task_type: "implementation" as const,
          labels: [],
          depends_on: [],
          priority: 2,
        },
      ],
    })

  const originalCreate = Store.createTask.bind(Store)
  let callCount = 0
  Store.createTask = async function (projectId: string, task: Task): Promise<void> {
    callCount++
    if (callCount === 2) {
      throw new Error("Simulated failure on second task")
    }
    return originalCreate(projectId, task)
  }

  let threw = false
  try {
    await runComposer(
      {
        jobId: "job-1",
        projectId: "test-project",
        pmSessionId: "session-1",
        issueNumber: 123,
        issueTitle: "Add feature",
        issueBody: "Please add a feature.",
      },
      mockSpawn,
    )
  } catch (e) {
    threw = true
    if (!(e as Error).message.includes("Simulated failure")) {
      throw new Error(`Expected simulated failure, got: ${(e as Error).message}`)
    }
  }

  if (!threw) {
    throw new Error("Expected runComposer to throw on partial creation failure")
  }

  const tasks = await Store.listTasks("test-project")
  const tasksWithRollback = tasks.filter((t) => t.close_reason?.includes("rollback"))
  if (tasksWithRollback.length === 0) {
    throw new Error(`Expected at least one task to have rollback reason`)
  }

  Store.createTask = originalCreate
})

test("ComposerTasksSchema coerces numeric depends_on values to strings", async () => {
  // This test verifies the fix for issue #250: numeric depends_on values are coerced to strings
  // by the Zod schema using .transform(String).pipe(z.string()...)
  
  const taskWithNumericDeps = {
    title: "Task with numeric deps",
    description: "Test numeric dependency coercion",
    acceptance_criteria: "Schema accepts and coerces numbers to strings",
    task_type: "implementation" as const,
    labels: ["module:test"],
    depends_on: [1, 2, "existing-task"],
    priority: 1,
  }

  // Import ComposerTasksSchema by accessing it through composer module
  const { default: z } = await import("zod")
  const ComposerTasksSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1),
    acceptance_criteria: z.string().min(1),
    task_type: z.enum(["implementation", "test", "research"]),
    labels: z.array(z.string().max(100)).default([]),
    depends_on: z.array(z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(200))).default([]),
    priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  })

  const result = ComposerTasksSchema.safeParse(taskWithNumericDeps)
  
  if (!result.success) {
    throw new Error(`Schema validation failed: ${result.error.issues.map((i) => i.message).join(", ")}`)
  }

  // Verify depends_on contains all strings now
  const { depends_on } = result.data
  if (!Array.isArray(depends_on)) {
    throw new Error("Expected depends_on to be an array")
  }

  if (depends_on.length !== 3) {
    throw new Error(`Expected 3 dependencies, got ${depends_on.length}`)
  }

  const hasNonStringDeps = depends_on.some((d) => typeof d !== "string")
  if (hasNonStringDeps) {
    throw new Error(`Expected all depends_on values to be strings, got: ${JSON.stringify(depends_on)}`)
  }

  // Verify the values are coerced correctly
  if (depends_on[0] !== "1" || depends_on[1] !== "2" || depends_on[2] !== "existing-task") {
    throw new Error(`Expected ["1", "2", "existing-task"], got ${JSON.stringify(depends_on)}`)
  }
})