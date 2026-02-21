import z from "zod"
import { Tool } from "../tool/tool"
import { Instance } from "../project/instance"
import { Store } from "./store"
import { Log } from "../util/log"
import type { Task } from "./types"
import * as TaskCommands from "./tool-commands"
import * as JobCommands from "./job-commands"
import * as InspectCommands from "./inspect-commands"

const log = Log.create({ service: "taskctl.tool" })

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
- verdict: Record adversarial pipeline verdict for a task

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
        "verdict",
      ])
      .describe("Command to execute"),
    taskId: z.string().optional().describe("Task ID (for get, update, close, comment, depends, split, inspect, override, retry, verdict)"),
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
    overrideMode: z.enum(["skip", "commit-as-is"]).optional().describe("Override mode: skip task or commit-as-is (for override command)"),
    verdict: z.enum(["APPROVED", "ISSUES_FOUND", "CRITICAL_ISSUES_FOUND"]).optional().describe("Verdict for adversarial review (for verdict)"),
    verdictIssues: z.array(z.object({
      location: z.string(),
      severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
      fix: z.string(),
    })).optional().describe("Issues found in review (for verdict)"),
    verdictSummary: z.string().optional().describe("Summary of verdict (for verdict)"),
  }),
  async execute(params, ctx) {
    const projectId = Instance.project.id

    switch (params.command) {
      case "create":
        return await TaskCommands.executeCreate(projectId, params)

      case "list": {
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

      case "get":
        return await TaskCommands.executeGet(projectId, params)

      case "update":
        if (!params.taskId) throw new Error("update requires taskId")
        await Store.updateTask(projectId, params.taskId, params.updates ?? {})
        return {
          title: "Task updated",
          output: `Updated task ${params.taskId}`,
          metadata: {},
        }

      case "close":
        return await TaskCommands.executeDelete(projectId, params)

      case "comment":
        return await TaskCommands.executeComment(projectId, params, ctx)

      case "depends":
        return await TaskCommands.executeDepends(projectId, params)

      case "split":
        return await TaskCommands.executeSplit(projectId, params)

      case "next":
        return await TaskCommands.executeNext(projectId, params)

      case "validate":
        return await TaskCommands.executeValidate(projectId)

      case "start":
        return await JobCommands.executeStart(projectId, params, ctx)

      case "status":
        return await JobCommands.executeStatus(projectId, params)

      case "start-skip": {
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

      case "stop":
        return await JobCommands.executeStop(projectId, params)

      case "resume":
        return await JobCommands.executeResume(projectId, params, ctx)

      case "inspect":
        return await InspectCommands.executeInspect(projectId, params)

      case "override":
        return await InspectCommands.executeOverride(projectId, params)

      case "retry":
        return await InspectCommands.executeRetry(projectId, params)

      case "verdict":
        return await InspectCommands.executeVerdict(projectId, params, ctx)

      default:
        throw new Error(`Unknown command: ${params.command}`)
    }
  },
})