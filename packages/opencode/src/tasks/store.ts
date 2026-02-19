import fs from "fs/promises"
import path from "path"
import { Global } from "../global/index"
import type { Task, Job, TaskIndex, Comment, PipelineEvent } from "./types"

const TASKS_DIR = "tasks"

function sanitizeProjectId(projectId: string): string {
  if (!projectId || typeof projectId !== "string") {
    throw new Error("Invalid projectId: must be a non-empty string")
  }

  if (projectId.includes("/") || projectId.includes("\\") || projectId.includes("\0")) {
    throw new Error(`Invalid projectId: contains path separators or null bytes`)
  }

  if (projectId === "." || projectId === ".." || projectId.startsWith("..") || projectId.endsWith("..")) {
    throw new Error(`Invalid projectId: cannot be "." or ".." or contain ".."`)
  }

  return projectId
}

function sanitizeTaskId(taskId: string): string {
  if (!taskId || typeof taskId !== "string") {
    throw new Error("Invalid taskId: must be a non-empty string")
  }

  if (taskId.includes("/") || taskId.includes("\\") || taskId.includes("\0")) {
    throw new Error(`Invalid taskId: contains path separators or null bytes`)
  }

  if (taskId.startsWith(".")) {
    throw new Error(`Invalid taskId: cannot start with "."`)
  }

  return taskId
}

function getTasksDir(projectId: string): string {
  const sanitized = sanitizeProjectId(projectId)
  return path.join(Global.Path.data, TASKS_DIR, sanitized)
}

function getSafeTaskPath(projectId: string, taskId: string): string {
  const tasksDir = getTasksDir(projectId)
  const sanitizedTaskId = sanitizeTaskId(taskId)
  return path.join(tasksDir, `${sanitizedTaskId}.json`)
}

async function ensureTasksDir(projectId: string): Promise<string> {
  const tasksDir = getTasksDir(projectId)
  await fs.mkdir(tasksDir, { recursive: true })
  return tasksDir
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmp = `${filePath}.tmp`
  try {
    await Bun.write(tmp, content)
    await fs.rename(tmp, filePath)
  } catch (error) {
    try {
      await fs.unlink(tmp)
    } catch {}
    throw error
  }
}

const IMMUTABLE_FIELDS: readonly (keyof Task)[] = [
  "id",
  "created_at",
  "job_id",
  "parent_issue",
  "task_type",
  "comments",
  "pipeline",
] as const

function validateTaskUpdates(updates: Partial<Task>, allowImmutable: boolean = false): void {
  if (allowImmutable) return
  const invalidFields = IMMUTABLE_FIELDS.filter((field) => field in updates)
  if (invalidFields.length > 0) {
    throw new Error(
      `Cannot update immutable fields: ${invalidFields.join(", ")}. Use specialized methods for comments and pipeline events.`,
    )
  }
}

export const Store = {
  async createTask(projectId: string, task: Task): Promise<void> {
    sanitizeTaskId(task.id)
    const tasksDir = await ensureTasksDir(projectId)
    const taskPath = getSafeTaskPath(projectId, task.id)
    await atomicWrite(taskPath, JSON.stringify(task, null, 2))
    await this.updateIndex(projectId, task.id, {
      status: task.status,
      priority: task.priority,
      labels: task.labels,
      depends_on: task.depends_on,
      updated_at: task.updated_at,
    })
    await this.logActivity(projectId, {
      type: "task_created",
      task_id: task.id,
      timestamp: new Date().toISOString(),
    })
  },

  async getTask(projectId: string, taskId: string): Promise<Task | null> {
    const taskPath = getSafeTaskPath(projectId, taskId)
    const content = await Bun.file(taskPath).text().catch(() => null)
    if (!content) return null
    try {
      return JSON.parse(content) as Task
    } catch {
      return null
    }
  },

  async updateTask(projectId: string, taskId: string, updates: Partial<Task>, allowImmutable: boolean = false): Promise<void> {
    validateTaskUpdates(updates, allowImmutable)
    sanitizeTaskId(taskId)
    const task = await this.getTask(projectId, taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    const updated = { ...task, ...updates, updated_at: new Date().toISOString() }
    const taskPath = getSafeTaskPath(projectId, taskId)
    await atomicWrite(taskPath, JSON.stringify(updated, null, 2))
    await this.updateIndex(projectId, taskId, {
      status: updated.status,
      priority: updated.priority,
      labels: updated.labels,
      depends_on: updated.depends_on,
      updated_at: updated.updated_at,
    })
    await this.logActivity(projectId, {
      type: "task_updated",
      task_id: taskId,
      timestamp: new Date().toISOString(),
    })
  },

  async listTasks(projectId: string): Promise<Task[]> {
    const tasksDir = getTasksDir(projectId)
    const content = await Bun.file(path.join(tasksDir, "index.json")).text().catch(() => "{}")
    try {
      const index = JSON.parse(content) as TaskIndex
      const tasks: Task[] = []

      for (const taskId in index) {
        const task = await this.getTask(projectId, taskId)
        if (task) tasks.push(task)
      }

      return tasks
    } catch {
      return []
    }
  },

  async updateIndex(projectId: string, taskId: string, entry: TaskIndex[string]): Promise<void> {
    const tasksDir = await ensureTasksDir(projectId)
    const indexPath = path.join(tasksDir, "index.json")

    let index = {} as TaskIndex
    const content = await Bun.file(indexPath).text().catch(() => "{}")
    try {
      if (content) index = JSON.parse(content) as TaskIndex
    } catch {
      index = {}
    }

    index[taskId] = entry
    await atomicWrite(indexPath, JSON.stringify(index, null, 2))
  },

  async getIndex(projectId: string): Promise<TaskIndex> {
    const tasksDir = getTasksDir(projectId)
    const content = await Bun.file(path.join(tasksDir, "index.json")).text().catch(() => "{}")
    if (!content) return {}
    try {
      return JSON.parse(content) as TaskIndex
    } catch {
      return {}
    }
  },

  async logActivity(projectId: string, event: Record<string, any>): Promise<void> {
    const tasksDir = await ensureTasksDir(projectId)
    const activityPath = path.join(tasksDir, "activity.ndjson")
    const line = JSON.stringify(event) + "\n"
    const file = Bun.file(activityPath)
    try {
      const existing = file.size > 0 ? await file.text() : ""
      await Bun.write(activityPath, existing + line)
    } catch {}
  },

  async createJob(projectId: string, job: Job): Promise<void> {
    const tasksDir = await ensureTasksDir(projectId)
    const jobPath = path.join(tasksDir, `job-${job.id}.json`)
    await atomicWrite(jobPath, JSON.stringify(job, null, 2))
    await this.logActivity(projectId, {
      type: "job_created",
      job_id: job.id,
      timestamp: new Date().toISOString(),
    })
  },

  async getJob(projectId: string, jobId: string): Promise<Job | null> {
    const tasksDir = getTasksDir(projectId)
    const jobPath = path.join(tasksDir, `job-${jobId}.json`)
    const content = await Bun.file(jobPath).text().catch(() => null)
    if (!content) return null
    try {
      return JSON.parse(content) as Job
    } catch {
      return null
    }
  },

  async updateJob(projectId: string, jobId: string, updates: Partial<Job>): Promise<void> {
    const job = await this.getJob(projectId, jobId)
    if (!job) throw new Error(`Job not found: ${jobId}`)

    const updated = { ...job, ...updates }
    const tasksDir = getTasksDir(projectId)
    const jobPath = path.join(tasksDir, `job-${jobId}.json`)
    await atomicWrite(jobPath, JSON.stringify(updated, null, 2))
    await this.logActivity(projectId, {
      type: "job_updated",
      job_id: jobId,
      timestamp: new Date().toISOString(),
    })
  },

  async addComment(projectId: string, taskId: string, comment: Comment): Promise<void> {
    const task = await this.getTask(projectId, taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    const updated = { ...task, comments: [...task.comments, comment] }
    await this.updateTask(projectId, taskId, updated, true)
    await this.logActivity(projectId, {
      type: "comment_added",
      task_id: taskId,
      comment,
      timestamp: new Date().toISOString(),
    })
  },

  async addPipelineEvent(projectId: string, taskId: string, event: PipelineEvent): Promise<void> {
    const task = await this.getTask(projectId, taskId)
    if (!task) throw new Error(`Task not found: ${taskId}`)

    const updated = {
      ...task,
      pipeline: {
        ...task.pipeline,
        history: [...task.pipeline.history, event],
      },
    }
    await this.updateTask(projectId, taskId, updated, true)
  },
}