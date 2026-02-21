import { Store } from "./store"
import { Log } from "../util/log"
import type { Task } from "./types"

const log = Log.create({ service: "taskctl.tool.commands" })
const MAX_COMMENT_LENGTH = 100 * 1024

function validateLabel(label: string): void {
  if (!label || typeof label !== "string") {
    throw new Error("Label must be a non-empty string")
  }
  if (label.includes("/") || label.includes("\\") || label.includes("\0")) {
    throw new Error(`Invalid label "${label}": contains path separators or null bytes`)
  }
}

export async function generateUniqueSlug(projectId: string, title: string): Promise<string> {
  const slugify = (title: string): string => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100)
    return slug || "entry"
  }

  const baseSlug = slugify(title)
  let slug = baseSlug
  let counter = 2
  const maxAttempts = 1000

  while (counter <= maxAttempts) {
    const existing = await Store.getTask(projectId, slug)
    if (!existing) return slug
    slug = `${baseSlug}-${counter}`
    counter++
  }

  throw new Error(`Failed to generate unique slug after ${maxAttempts} attempts for title: ${title}`)
}

export async function executeCreate(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (!params.title?.trim()) {
    throw new Error("create requires title")
  }
  if (!params.description?.trim()) {
    throw new Error("create requires description")
  }
  if (!params.acceptanceCriteria?.trim()) {
    throw new Error("create requires acceptanceCriteria")
  }
  if (!params.parentIssue || !params.jobId) {
    throw new Error("create requires parentIssue and jobId")
  }

  const labels = (params.labels ?? []).filter((l: string) => l.trim())
  labels.forEach(validateLabel)

  if (params.dependsOn) {
    for (const depId of params.dependsOn) {
      if (!depId || typeof depId !== "string") {
        throw new Error(`Invalid dependency ID: ${depId}`)
      }
      const depExists = await Store.getTask(projectId, depId)
      if (!depExists) {
        throw new Error(`Dependency task not found: ${depId}`)
      }
    }
  }

  const taskId = await generateUniqueSlug(projectId, params.title)
  const now = new Date().toISOString()

  const task: Task = {
    id: taskId,
    title: params.title.trim(),
    description: params.description.trim(),
    acceptance_criteria: params.acceptanceCriteria.trim(),
    parent_issue: params.parentIssue,
    job_id: params.jobId,
    status: "open",
    priority: (params.priority ?? 2) as Task["priority"],
    task_type: params.taskType ?? "implementation",
    labels,
    depends_on: params.dependsOn ?? [],
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
  return {
    title: "Task created",
    output: `Created task ${taskId}\n${params.title.trim()}`,
    metadata: {},
  }
}

export async function executeGet(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (!params.taskId) throw new Error("get requires taskId")
  const task = await Store.getTask(projectId, params.taskId)
  if (!task) throw new Error(`Task not found: ${params.taskId}`)

  const lines = [
    `Task: ${task.id}`,
    `Title: ${task.title}`,
    `Status: ${task.status}`,
    `Priority: ${task.priority}`,
    `Type: ${task.task_type}`,
    `Parent Issue: #${task.parent_issue}`,
    `Job: ${task.job_id}`,
    `Assignee: ${task.assignee ?? "none"}`,
    `Labels: ${task.labels.join(", ") || "none"}`,
    `Depends on: ${task.depends_on.join(", ") || "none"}`,
    `Created: ${task.created_at}`,
    `Updated: ${task.updated_at}`,
    ``,
    `Description:`,
    task.description,
    ``,
    `Acceptance Criteria:`,
    task.acceptance_criteria,
    ``,
    `Pipeline Stage: ${task.pipeline.stage}`,
    `Pipeline Attempt: ${task.pipeline.attempt}`,
  ]

  if (task.close_reason) {
    lines.push(`Close Reason: ${task.close_reason}`)
  }

  if (task.comments.length > 0) {
    lines.push("", "Comments:")
    for (const comment of task.comments) {
      lines.push(`  [${comment.created_at}] ${comment.author}: ${comment.message}`)
    }
  }

  if (task.branch) lines.push(`Branch: ${task.branch}`)
  if (task.worktree) lines.push(`Worktree: ${task.worktree}`)

  return {
    title: `Task: ${task.id}`,
    output: lines.join("\n"),
    metadata: {},
  }
}

export async function executeDelete(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (!params.taskId) throw new Error("close requires taskId")
  const task = await Store.getTask(projectId, params.taskId)
  if (!task) throw new Error(`Task not found: ${params.taskId}`)

  if (task.status === "closed") {
    throw new Error(`Task ${params.taskId} is already closed`)
  }

  await Store.updateTask(projectId, params.taskId, {
    status: "closed",
    close_reason: (params.reason?.trim()) ?? "completed",
  })
  return {
    title: "Task closed",
    output: `Closed task ${task.id}: ${params.reason?.trim() ?? "completed"}`,
    metadata: {},
  }
}

export async function executeComment(projectId: string, params: any, ctx: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (!params.taskId) throw new Error("comment requires taskId")
  if (!params.message?.trim()) throw new Error("comment requires message")

  const message = params.message.trim()
  if (message.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment message too long: ${message.length} bytes (max ${MAX_COMMENT_LENGTH})`)
  }

  const task = await Store.getTask(projectId, params.taskId)
  if (!task) throw new Error(`Task not found: ${params.taskId}`)

  const comment = {
    author: ctx.agent,
    message,
    created_at: new Date().toISOString(),
  }
  await Store.addComment(projectId, params.taskId, comment)
  return {
    title: "Comment added",
    output: `Added comment to task ${params.taskId}`,
    metadata: {},
  }
}

export async function executeDepends(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (!params.taskId || !params.dependencyId) throw new Error("depends requires taskId and dependencyId")
  const task = await Store.getTask(projectId, params.taskId)
  if (!task) throw new Error(`Task not found: ${params.taskId}`)

  const depTask = await Store.getTask(projectId, params.dependencyId)
  if (!depTask) throw new Error(`Dependency task not found: ${params.dependencyId}`)

  if (params.taskId === params.dependencyId) {
    throw new Error(`Task cannot depend on itself`)
  }

  if (task.depends_on.includes(params.dependencyId)) {
    throw new Error(`Task ${params.taskId} already depends on ${params.dependencyId}`)
  }

  const newDeps = [...task.depends_on, params.dependencyId]

  async function hasCycle(currentId: string, visited = new Set<string>()): Promise<boolean> {
    if (visited.has(currentId)) return true
    visited.add(currentId)

    const currentTask = await Store.getTask(projectId, currentId)
    if (!currentTask) return false

    const depsToCheck = currentId === params.taskId ? newDeps : currentTask.depends_on

    for (const depId of depsToCheck) {
      if (await hasCycle(depId, visited)) return true
    }

    visited.delete(currentId)
    return false
  }

  if (await hasCycle(params.taskId)) {
    throw new Error(`Adding ${params.dependencyId} as dependency would create a cycle`)
  }

  await Store.updateTask(projectId, params.taskId, {
    depends_on: newDeps,
  })
  return {
    title: "Dependency added",
    output: `Added ${params.dependencyId} as dependency to ${params.taskId}`,
    metadata: {},
  }
}

export async function executeSplit(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  if (!params.taskId) throw new Error("split requires taskId")
  const task = await Store.getTask(projectId, params.taskId)
  if (!task) throw new Error(`Task not found: ${params.taskId}`)

  if (task.status !== "open") {
    throw new Error(`Can only split open tasks, current status: ${task.status}`)
  }

  const slug1 = await generateUniqueSlug(projectId, `${task.title}-part-1`)
  const slug2 = await generateUniqueSlug(projectId, `${task.title}-part-2`)
  const now = new Date().toISOString()

  const task1: Task = {
    ...task,
    worktree: null,
    branch: null,
    base_commit: null,
    id: slug1,
    title: `${task.title} (Part 1)`,
    depends_on: [task.id, ...task.depends_on],
    description: `${task.description} - Part 1`,
    status: "open",
    assignee: null,
    assignee_pid: null,
    comments: [],
    created_at: now,
    updated_at: now,
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
    ...task,
    worktree: null,
    branch: null,
    base_commit: null,
    id: slug2,
    title: `${task.title} (Part 2)`,
    depends_on: [task.id, ...task.depends_on],
    description: `${task.description} - Part 2`,
    status: "open",
    assignee: null,
    assignee_pid: null,
    comments: [],
    created_at: now,
    updated_at: now,
    pipeline: {
      stage: "idle",
      attempt: 0,
      last_activity: null,
      last_steering: null,
      history: [],
      adversarial_verdict: null,
    },
  }

  let task1Created = false
  let task2Created = false

  try {
    await Store.createTask(projectId, task1)
    task1Created = true

    await Store.createTask(projectId, task2)
    task2Created = true

    await Store.updateTask(projectId, params.taskId, {
      status: "closed",
      close_reason: `split into: ${slug1}, ${slug2}`,
    })

    return {
      title: "Task split",
      output: `Split ${task.id} into ${slug1} and ${slug2}`,
      metadata: {},
    }
  } catch (error) {
    if (task2Created) {
      await Store.updateTask(projectId, slug2, { status: "closed", close_reason: "rollback: split failed" }).catch(() => {})
    }
    if (task1Created) {
      await Store.updateTask(projectId, slug1, { status: "closed", close_reason: "rollback: split failed" }).catch(() => {})
    }
    throw error
  }
}

export async function executeNext(projectId: string, params: any): Promise<{ title: string; output: string; metadata: {} }> {
  const { Scheduler } = await import("./scheduler")
  const count = params.count ?? 1
  const tasks = await Scheduler.getNextTasks(projectId, count)

  if (tasks.length === 0) {
    return {
      title: "No tasks available",
      output: "No tasks are currently available for work",
      metadata: {},
    }
  }

  const lines = [`Available tasks: ${tasks.length}`, ""]

  for (const task of tasks) {
    lines.push(`${task.id} [${task.status}] priority:${task.priority} - ${task.title}`)
    if (task.depends_on.length > 0) {
      lines.push(`  Depends on: ${task.depends_on.join(", ")}`)
    }
  }

  return {
    title: "Available tasks",
    output: lines.join("\n"),
    metadata: {},
  }
}

export async function executeValidate(projectId: string): Promise<{ title: string; output: string; metadata: {} }> {
  const { Validation } = await import("./validation")
  const result = await Validation.validateGraph(projectId)
  const lines = [`Valid: ${result.valid}`, `Errors: ${result.errors.length}`, `Warnings: ${result.warnings.length}`, ""]

  if (result.errors.length > 0) {
    lines.push("Errors:")
    for (const error of result.errors) {
      lines.push(`  - ${error}`)
    }
  }

  if (result.warnings.length > 0) {
    lines.push("Warnings:")
    for (const warning of result.warnings) {
      lines.push(`  - ${warning}`)
    }
  }

  if (result.valid && result.warnings.length === 0) {
    lines.push("Task graph is valid.")
  }

  return {
    title: "Validation result",
    output: lines.join("\n"),
    metadata: {},
  }
}