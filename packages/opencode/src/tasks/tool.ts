import z from "zod"
import { Tool } from "../tool/tool"
import { Instance } from "../project/instance"
import { Store } from "./store"
import { Scheduler } from "./scheduler"
import { Validation } from "./validation"
import { runComposer } from "./composer"
import { enableAutoWakeup } from "../session/async-tasks"
import { startPulse, resurrectionScan, readLockPid, isPidAlive, removeLockFile } from "./pulse"
import { SessionPrompt } from "../session/prompt"
import { Worktree } from "../worktree"
import { Log } from "../util/log"
import type { Task, Job } from "./types"

const log = Log.create({ service: "taskctl.tool" })
const MAX_COMMENT_LENGTH = 100 * 1024

function validateLabel(label: string): void {
  if (!label || typeof label !== "string") {
    throw new Error("Label must be a non-empty string")
  }
  if (label.includes("/") || label.includes("\\") || label.includes("\0")) {
    throw new Error(`Invalid label "${label}": contains path separators or null bytes`)
  }
}

export const slugify = (title: string): string => {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100)
  return slug || "entry"
}

export async function generateUniqueSlug(projectId: string, title: string): Promise<string> {
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

export const TaskctlTool = Tool.define("taskctl", {
  description: `Task control and management tool for autonomous development pipelines.

Commands:
- create: Create a new task with title, description, acceptance criteria
- list: List all tasks with optional filters
- get: Get a single task by ID
- update: Update task fields
- close: Close a task with a reason
- comment: Add a comment to a task
- depends: Add dependency to task (validates no cycle)
- split: Split task into two new tasks, close original
- next: Get next tasks ready for work (respecting dependencies and conflicts)
- validate: Validate task graph for cycles and other issues
- start: Start autonomous pipeline for a GitHub issue (decomposes issue into tasks via Composer agent)
- start-skip: Start pipeline skipping Composer (requires existing tasks for issue)
- status: Show job status for a GitHub issue
- stop: Stop a running job gracefully
- resume: Resume a stopped/crashed pipeline
- inspect: Show full task history and details
- override: Override a task (skip or commit as-is)
- retry: Reset and retry a failed task

Task labels:
- module:<name>: Prevent conflicts with tasks in same module
- file:<path>: Prevent conflicts with tasks touching same file`,

  parameters: z.object({
    command: z
      .enum([
        "create",
        "list",
        "get",
        "update",
        "close",
        "comment",
        "depends",
        "split",
        "next",
        "validate",
        "start",
        "start-skip",
        "status",
        "stop",
        "resume",
        "inspect",
        "override",
        "retry",
      ])
      .describe("Command to execute"),
    taskId: z.string().optional().describe("Task ID (for get, update, close, comment, depends, split, inspect, override, retry)"),
    title: z.string().optional().describe("Task title (for create)"),
    description: z.string().optional().describe("Task description (for create)"),
    acceptanceCriteria: z.string().optional().describe("Acceptance criteria (for create)"),
    parentIssue: z.number().optional().describe("GitHub issue number (for create, start)"),
    jobId: z.string().optional().describe("Job ID (for create, stop, resume)"),
    priority: z.number().min(0).max(4).optional().describe("Priority 0-4, 0 is highest (for create, update)"),
    taskType: z.enum(["implementation", "test", "research"]).optional().describe("Task type (for create)"),
    labels: z.array(z.string()).optional().describe("Task labels (for create)"),
    dependsOn: z.array(z.string()).optional().describe("Dependencies (for create)"),
    message: z.string().optional().describe("Comment message (for comment)"),
    reason: z.string().optional().describe("Close reason (for close)"),
    dependencyId: z.string().optional().describe("Dependency task ID to add (for depends)"),
    count: z.number().min(1).max(10).optional().describe("Number of tasks to return (for next)"),
    updates: z.object({}).passthrough().optional().describe("Field updates for task (for update, e.g. {status: 'in_progress'})"),
    issueNumber: z.number().optional().describe("GitHub issue number (for start, start-skip, status)"),
    overrideMode: z.enum(["skip", "commit-as-is"]).optional().describe("Override mode: skip task or commit as-is (for override command)"),
  }),

  async execute(params, ctx) {
    const projectId = Instance.project.id

    if (params.command === "create") {
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

      const labels = (params.labels ?? []).filter((l) => l.trim())
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

    if (params.command === "list") {
      const tasks = await Store.listTasks(projectId)
      const lines = [`Found ${tasks.length} tasks`, ""]

      for (const task of tasks.sort((a, b) => a.id.localeCompare(b.id))) {
        lines.push(`${task.id} [${task.status}] priority:${task.priority} - ${task.title}`)
      }

      return {
        title: "Task list",
        output: lines.join("\n"),
        metadata: {},
      }
    }

    if (params.command === "get") {
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

    if (params.command === "update") {
      if (!params.taskId) throw new Error("update requires taskId")
      await Store.updateTask(projectId, params.taskId, params.updates ?? {})
      return {
        title: "Task updated",
        output: `Updated task ${params.taskId}`,
        metadata: {},
      }
    }

if (params.command === "close") {
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

    if (params.command === "comment") {
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

    if (params.command === "depends") {
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

    if (params.command === "split") {
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

    if (params.command === "next") {
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

    if (params.command === "validate") {
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

if (params.command === "start") {
      const issueNumber = params.issueNumber
      if (!issueNumber) throw new Error("start requires issueNumber")

      const existingJob = await Store.findJobByIssue(projectId, issueNumber)
      if (existingJob) {
        const { removeLockFile } = await import("./pulse")
        const existingPid = await readLockPid(existingJob.id, projectId)

        if (existingJob.status === "complete" || existingJob.status === "failed" || existingJob.status === "stopped") {
          return {
            title: "Job already completed",
            output: `Job is ${existingJob.status}. Status: taskctl status ${issueNumber}`,
            metadata: {},
          }
        }

        if (existingJob.status === "running") {
          if (existingPid !== null && isPidAlive(existingPid)) {
            return {
              title: "Already running",
              output: `Job already running (PID ${existingPid}). Use taskctl status ${issueNumber} to monitor.`,
              metadata: {},
            }
          }
          if (existingPid !== null) {
            await removeLockFile(existingJob.id, projectId)
          }
        }
      }

      const jobId = `job-${Date.now()}`
      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: ctx.sessionID,
      })

      enableAutoWakeup(ctx.sessionID)

      const repo = "randomm/opencode"

      let issueOutput: { title: string; body: string } | null = null
      const proc = Bun.spawn(["gh", "issue", "view", issueNumber.toString(), "--repo", repo, "--json", "title,body"], {
        stdout: "pipe",
        stderr: "pipe",
      })

      const reader = proc.stdout.getReader()
      const decoder = new TextDecoder()
      let output = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        output += decoder.decode(value)
      }

      const exitCode = await proc.exited
      if (exitCode !== 0 || !output) {
        const errorReader = proc.stderr.getReader()
        let errorOutput = ""
        while (true) {
          const { done, value } = await errorReader.read()
          if (done) break
          errorOutput += decoder.decode(value)
        }
        await Store.updateJob(projectId, jobId, { status: "failed" })
        throw new Error(`Failed to fetch GitHub issue #${issueNumber}: ${errorOutput || "Unknown error"}`)
      }

      try {
        issueOutput = JSON.parse(output) as { title: string; body: string }
        if (!issueOutput || typeof issueOutput !== "object") {
          throw new Error("Invalid response format")
        }
      } catch {
        await Store.updateJob(projectId, jobId, { status: "failed" })
        throw new Error(`Failed to parse GitHub issue #${issueNumber} output`)
      }

      const issueTitle = issueOutput.title || ""
      const issueBody = issueOutput.body || ""

      const composerResult = await runComposer({
        jobId,
        projectId,
        pmSessionId: ctx.sessionID,
        issueNumber,
        issueTitle,
        issueBody,
      })

      if (composerResult.status === "needs_clarification") {
        await Store.updateJob(projectId, jobId, { status: "failed" })
        const questionLines = ["Composer needs clarification:", ...composerResult.questions.map((q) => `${q.id}. ${q.question}`)]
        return {
          title: "Composer needs clarification",
          output: questionLines.join("\n"),
          metadata: {},
        }
      }

      await resurrectionScan(jobId, projectId)
      startPulse(jobId, projectId, ctx.sessionID)

      return {
        title: "Pipeline started",
        output: `Job ${jobId} started: ${composerResult.taskCount} tasks queued. Pulse is running every 5 seconds. Use taskctl status ${issueNumber} to monitor.`,
        metadata: {},
      }
    }

    if (params.command === "status") {
      const issueNumber = params.issueNumber
      if (!issueNumber) throw new Error("status requires issueNumber")

      const job = await Store.findJobByIssue(projectId, issueNumber)
      if (!job) {
        const tasks = await Store.listTasks(projectId)
        const historicalTasks = tasks.filter((t) => t.parent_issue === issueNumber)
        if (historicalTasks.length > 0) {
          return {
            title: "Job completed",
            output: `Job completed. Historical tasks: ${historicalTasks.length} tasks found.`,
            metadata: {},
          }
        }
        return {
          title: "Job not found",
          output: `No job found for issue #${issueNumber}. Use "taskctl start ${issueNumber}" to start the pipeline.`,
          metadata: {},
        }
      }

      const tasks = await Store.listTasks(projectId)
      const jobTasks = tasks.filter((t) => t.job_id === job.id)

      const lines = [
        `Job: ${job.id}`,
        `Status: ${job.status}`,
        `Max Workers: ${job.max_workers}`,
        `PM Session: ${job.pm_session_id}`,
        `Created: ${job.created_at}`,
        `Pulse PID: ${job.pulse_pid ?? "none"}`,
        ``,
        `Tasks (${jobTasks.length}):`,
      ]

      for (const task of jobTasks.sort((a, b) => a.id.localeCompare(b.id))) {
        lines.push(`  ${task.id} [${task.status}] - ${task.title}`)
        if (task.assignee) {
          lines.push(`    Assignee: ${task.assignee}`)
        }
        if (task.worktree) {
          lines.push(`    Worktree: ${task.worktree}`)
        }
        if (task.pipeline.stage !== "idle") {
          lines.push(`    Pipeline: ${task.pipeline.stage} (attempt ${task.pipeline.attempt})`)
        }
      }

      return {
        title: `Job Status: #${issueNumber}`,
        output: lines.join("\n"),
        metadata: {},
      }
    }

    if (params.command === "start-skip") {
      const issueNumber = params.issueNumber
      if (!issueNumber) throw new Error("start-skip requires issueNumber")

      const tasks = await Store.listTasks(projectId)
      const tasksWithIssue = tasks.filter((t) => t.parent_issue === issueNumber)
      if (tasksWithIssue.length === 0) {
        return {
          title: "No tasks found",
          output: `No tasks found for issue #${issueNumber}. Use taskctl start to create tasks first.`,
          metadata: {},
        }
      }

      return {
        title: "Tasks found",
        output: `Tasks found: ${tasksWithIssue.length}. Pulse integration comes in Phase 3.`,
        metadata: {},
      }
    }

    if (params.command === "stop") {
      const jobId = params.jobId
      if (!jobId) throw new Error("stop requires jobId")

      const job = await Store.getJob(projectId, jobId)
      if (!job) throw new Error(`Job not found: ${jobId}`)
      if (job.status !== "running") {
        return {
          title: "Job not running",
          output: `Job ${jobId} is not running (status: ${job.status}). Nothing to stop.`,
          metadata: {},
        }
      }
      if (job.stopping) {
        return {
          title: "Already stopping",
          output: `Job ${jobId} is already stopping. Use taskctl status to monitor.`,
          metadata: {},
        }
      }

      await Store.updateJob(projectId, jobId, { stopping: true })
      return {
        title: "Stop signal sent",
        output: `Stop signal sent to job ${jobId}. Pipeline will finish in-flight work and halt. Use taskctl status to monitor.`,
        metadata: {},
      }
    }

    if (params.command === "resume") {
      const jobId = params.jobId
      if (!jobId) throw new Error("resume requires jobId")

      const job = await Store.getJob(projectId, jobId)
      if (!job) throw new Error(`Job not found: ${jobId}`)

      const existingPid = await readLockPid(jobId, projectId)
      if (existingPid !== null) {
        if (isPidAlive(existingPid)) {
          return {
            title: "Already running",
            output: `Pipeline is already running (PID ${existingPid}). Use taskctl status to monitor.`,
            metadata: {},
          }
        }
        await removeLockFile(jobId, projectId)
      }

      await resurrectionScan(jobId, projectId)

      const revalidated = await Store.getJob(projectId, jobId)
      if (!revalidated) throw new Error(`Job vanished after resurrection: ${jobId}`)
      if (revalidated.stopping === true || revalidated.status === "complete" || revalidated.status === "failed" || revalidated.status === "stopped") {
        return {
          title: "Cannot resume",
          output: `Job is ${revalidated.status}${revalidated.stopping ? " and has stop flag set" : ""}. Status: taskctl status`,
          metadata: {},
        }
      }

      // NOTE: Update is not atomic with prior read. Race window exists where pulse tick could set stopping=true concurrently.
      // Related design gap: pulse.ts line 58 doesn't check job.stopping before spawning tasks (pulse-zombie race).
      // To handle this gracefully: if stop is set during this window, pulse tick will gracefully stop the job.

      await Store.updateJob(projectId, jobId, { status: "running", stopping: false })
      enableAutoWakeup(ctx.sessionID)

      const tasks = await Store.listTasks(projectId)
      const remaining = tasks.filter((t) => t.job_id === jobId && t.status !== "closed").length
      await resurrectionScan(jobId, projectId)
      startPulse(jobId, projectId, ctx.sessionID)

      return {
        title: "Pipeline resumed",
        output: `Pipeline resumed for job ${jobId}. ${remaining} tasks remaining. Pulse is running.`,
        metadata: {},
      }
    }

    if (params.command === "inspect") {
      if (!params.taskId) throw new Error("inspect requires taskId")

      const task = await Store.getTask(projectId, params.taskId)
      if (!task) throw new Error(`Task not found: ${params.taskId}`)

      const lines: string[] = [
        `Task: ${task.id}`,
        `Status: ${task.status}${task.close_reason ? ` (${task.close_reason})` : ""}`,
        `Branch: ${task.branch ?? "none"}`,
        `Worktree: ${task.worktree ?? "none"}`,
        ``,
        `Pipeline:`,
        `  Stage: ${task.pipeline.stage}`,
        `  Attempt: ${task.pipeline.attempt}`,
        `  Last activity: ${task.pipeline.last_activity ?? "never"}`,
        `  Last steering: ${task.pipeline.last_steering ?? "never"}`,
      ]

      if (task.pipeline.history && task.pipeline.history.length > 0) {
        lines.push(``, `Pipeline history:`)
        for (const entry of task.pipeline.history) {
          lines.push(`  ${entry}`)
        }
      }

      if (task.pipeline.adversarial_verdict) {
        const v = task.pipeline.adversarial_verdict
        lines.push(``, `Last adversarial verdict:`, `  ${v.verdict}`)
        if (v.summary) lines.push(`  Summary: ${v.summary}`)
        if (v.issues.length > 0) {
          lines.push(`  Issues:`)
          for (const issue of v.issues) {
            lines.push(`    - ${issue.location} [${issue.severity}]: ${issue.fix}`)
          }
        }
      }

      if (task.comments.length > 0) {
        lines.push(``, `Comments (${task.comments.length} total):`)
        for (const comment of task.comments) {
          lines.push(`  [${comment.author}] ${comment.message}`)
        }
      }

      return {
        title: `Task inspect: ${task.id}`,
        output: lines.join("\n"),
        metadata: {},
      }
    }

    if (params.command === "override") {
      if (!params.taskId) throw new Error("override requires taskId")
      if (!params.overrideMode) throw new Error("override requires --skip or --commit-as-is")

      const task = await Store.getTask(projectId, params.taskId)
      if (!task) throw new Error(`Task not found: ${params.taskId}`)

      const validStates = ["failed", "in_progress", "review", "blocked_on_conflict"]
      if (!validStates.includes(task.status)) {
        throw new Error(`override requires task in state: ${validStates.join(", ")}. Current: ${task.status}`)
      }

      if (params.overrideMode === "skip") {
        if (task.assignee) {
          try {
            SessionPrompt.cancel(task.assignee)
          } catch {}
        }

        if (task.worktree) {
          await Worktree.remove({ directory: task.worktree }).catch((e) =>
            log.error("failed to remove worktree in override --skip", { taskId: task.id, error: String(e) })
          )
        }

        await Store.updateTask(projectId, params.taskId, {
          status: "closed",
          close_reason: "skipped by PM",
          worktree: null,
          branch: null,
          assignee: null,
          assignee_pid: null,
          pipeline: { ...task.pipeline, stage: "done" },
        })

        await Store.addComment(projectId, params.taskId, {
          author: "system",
          message: "Skipped by PM override. Dependent tasks are now unblocked.",
          created_at: new Date().toISOString(),
        })

        return {
          title: "Task skipped",
          output: `Task ${params.taskId} skipped. Dependent tasks are now unblocked. Pulse will schedule them on next tick.`,
          metadata: {},
        }
      }

      if (!task.worktree) {
        throw new Error(`Task ${params.taskId} has no worktree to commit`)
      }

      return {
        title: "Commit as-is",
        output: `To commit worktree for task ${params.taskId}:\n1. @ops: cd ${task.worktree} && git add -A && git commit -m "feat(taskctl): ${task.title} (#${task.parent_issue}) — committed as-is by PM"\n2. Then: taskctl override ${params.taskId} --skip (to close the task)`,
        metadata: {},
      }
    }

    if (params.command === "retry") {
      if (!params.taskId) throw new Error("retry requires taskId")

      const task = await Store.getTask(projectId, params.taskId)
      if (!task) throw new Error(`Task not found: ${params.taskId}`)

      if (task.assignee) {
        try {
          SessionPrompt.cancel(task.assignee)
        } catch {}
      }

      if (task.worktree) {
        await Worktree.remove({ directory: task.worktree }).catch((e) =>
          log.error("failed to remove worktree in retry", { taskId: task.id, error: String(e) })
        )
      }

      await Store.updateTask(projectId, params.taskId, {
        status: "open",
        assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        pipeline: {
          ...task.pipeline,
          stage: "idle",
          attempt: 1,
          adversarial_verdict: null,
          last_activity: null,
        },
      })

      await Store.addComment(projectId, params.taskId, {
        author: "system",
        message: `Retried by PM. Task reset to open. Pulse will reschedule on next tick.`,
        created_at: new Date().toISOString(),
      })

      return {
        title: "Task retried",
        output: `Task ${params.taskId} reset to open with fresh state. Pulse will reschedule it on next tick.`,
        metadata: {},
      }
    }

    throw new Error(`Unknown command: ${params.command}`)
  },
})