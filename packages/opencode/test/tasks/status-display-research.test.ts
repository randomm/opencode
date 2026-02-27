/**
 * Research tests: taskctl status display code
 *
 * Documents the current rendering logic in executeStatus (job-commands.ts:193-249),
 * what data fields are available per task (types.ts), and where to inject new
 * display fields (assignee, session ID, pipeline activity).
 *
 * Key findings:
 * - Status rendering: job-commands.ts executeStatus (line 193)
 * - Per-task rendering loop: lines 229-242
 * - Assignee field: task.assignee (string | null) — session ID stored here
 * - Worktree field: task.worktree (string | null)
 * - Pipeline info: task.pipeline.stage, attempt, last_activity
 * - Elapsed formatting: formatElapsed(task.pipeline.last_activity) from util/format.ts
 * - Injection point for session ID: inside the per-task loop at line ~231-232,
 *   parallel to the existing `if (task.assignee)` block
 * - Injection point for pipeline activity: inside `if (task.pipeline.stage !== "idle")`
 *   at line ~237, the elapsedSuffix is already computed there
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { executeStatus } from "../../src/tasks/job-commands"
import { Store } from "../../src/tasks/store"
import type { Task } from "../../src/tasks/types"
import { Global } from "../../src/global"
import path from "path"
import fs from "fs/promises"

function makeTask(overrides: Partial<Task> & { id: string; job_id: string; parent_issue: number }): Task {
  const now = new Date().toISOString()
  return {
    title: "Test task",
    description: "desc",
    acceptance_criteria: "ac",
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

describe("taskctl status rendering — current behavior (job-commands.ts:193)", () => {
  let testDataDir: string

  beforeEach(async () => {
    testDataDir = path.join("/tmp", `opencode-status-research-${Math.random().toString(36).slice(2)}`)
    await fs.mkdir(testDataDir, { recursive: true })
    process.env.OPENCODE_TEST_HOME = testDataDir
    await Global.init()
  })

  afterEach(async () => {
    await fs.rm(testDataDir, { recursive: true, force: true }).catch(() => {})
    delete process.env.OPENCODE_TEST_HOME
  })

  /**
   * Documents the job-level fields in executeStatus output (lines 218-227).
   * These always appear regardless of task state.
   */
  describe("job-level header fields", () => {
    test("renders job id, status, max workers, pm session, created, pulse pid", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 42

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: "2025-01-01T10:00:00.000Z",
        stopping: false,
        pulse_pid: 12345,
        max_workers: 3,
        pm_session_id: "ses-pm-abc123",
        feature_branch: null,
      })

      const result = await executeStatus(projectId, { issueNumber })

      // job-commands.ts lines 219-225
      expect(result.output).toContain(`Job: ${jobId}`)
      expect(result.output).toContain("Status: running")
      expect(result.output).toContain("Max Workers: 3")
      // PM session ID is shown at job level (line 222) — NOT at task level
      expect(result.output).toContain("PM Session: ses-pm-abc123")
      expect(result.output).toContain("Created: 2025-01-01T10:00:00.000Z")
      expect(result.output).toContain("Pulse PID: 12345")
    })

    test("renders 'Pulse PID: none' when pulse_pid is null", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 43

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 1,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      const result = await executeStatus(projectId, { issueNumber })
      expect(result.output).toContain("Pulse PID: none")
    })
  })

  /**
   * Documents per-task rendering (job-commands.ts lines 229-242).
   * Each task renders: id, status, title. Optional: assignee, worktree, pipeline.
   */
  describe("per-task rendering", () => {
    test("renders task id, status, title on a single line (line 230)", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 100

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      await Store.createTask(projectId, makeTask({
        id: "research-task-1",
        job_id: jobId,
        parent_issue: issueNumber,
        title: "Implement feature X",
        status: "in_progress",
      }))

      const result = await executeStatus(projectId, { issueNumber })

      // Exact format from job-commands.ts line 230:
      //   `  ${task.id} [${task.status}] - ${task.title}`
      expect(result.output).toContain("  research-task-1 [in_progress] - Implement feature X")
    })

    /**
     * Assignee field (types.ts line 13): `assignee: string | null`
     * This stores the session ID of the assigned developer agent.
     * Rendered at job-commands.ts lines 231-233:
     *   if (task.assignee) { lines.push(`    Assignee: ${task.assignee}`) }
     *
     * Injection point: to add more agent activity info, add a new
     * `if (task.assignee_pid)` block immediately after line 233, OR
     * extend the existing `Assignee:` line to include `assignee_pid`.
     */
    test("renders Assignee line with session ID when task.assignee is set (line 231)", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 101

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      await Store.createTask(projectId, makeTask({
        id: "research-task-2",
        job_id: jobId,
        parent_issue: issueNumber,
        status: "in_progress",
        // assignee stores the session ID of the developer agent
        assignee: "ses-developer-xyz789",
        assignee_pid: 54321,
      }))

      const result = await executeStatus(projectId, { issueNumber })

      // Session ID is surfaced via task.assignee (a session ID string)
      expect(result.output).toContain("    Assignee: ses-developer-xyz789")
    })

    test("omits Assignee line when task.assignee is null (no assigned developer)", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 102

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      await Store.createTask(projectId, makeTask({
        id: "research-task-3",
        job_id: jobId,
        parent_issue: issueNumber,
        status: "open",
        assignee: null,
      }))

      const result = await executeStatus(projectId, { issueNumber })
      expect(result.output).not.toContain("Assignee:")
    })

    /**
     * Worktree field (types.ts line 15): `worktree: string | null`
     * Rendered at job-commands.ts lines 234-236:
     *   if (task.worktree) { lines.push(`    Worktree: ${task.worktree}`) }
     */
    test("renders Worktree line when task.worktree is set (line 234)", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 103

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      await Store.createTask(projectId, makeTask({
        id: "research-task-4",
        job_id: jobId,
        parent_issue: issueNumber,
        status: "in_progress",
        worktree: "/projects/opencode/.worktrees/task-research-task-4",
      }))

      const result = await executeStatus(projectId, { issueNumber })
      expect(result.output).toContain("    Worktree: /projects/opencode/.worktrees/task-research-task-4")
    })

    /**
     * Pipeline display (job-commands.ts lines 237-241):
     *   if (task.pipeline.stage !== "idle") {
     *     const elapsed = formatElapsed(task.pipeline.last_activity)
     *     const elapsedSuffix = elapsed ? `, ${elapsed}` : ""
     *     lines.push(`    Pipeline: ${stage} (attempt ${attempt}${elapsedSuffix})`)
     *   }
     *
     * Injection point for new agent activity info: inside this block,
     * after computing elapsedSuffix, before or after lines.push.
     * For example: lines.push(`    Session: ${task.assignee ?? "none"}`)
     *              lines.push(`    PID: ${task.assignee_pid ?? "none"}`)
     */
    test("renders Pipeline line with stage and attempt when stage is not idle (line 237)", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 104

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      await Store.createTask(projectId, makeTask({
        id: "research-task-5",
        job_id: jobId,
        parent_issue: issueNumber,
        status: "in_progress",
        pipeline: {
          stage: "developing",
          attempt: 2,
          last_activity: null,
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }))

      const result = await executeStatus(projectId, { issueNumber })
      // No elapsed suffix when last_activity is null
      expect(result.output).toContain("    Pipeline: developing (attempt 2)")
    })

    test("omits Pipeline line when stage is idle (line 237 condition)", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 105

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      await Store.createTask(projectId, makeTask({
        id: "research-task-6",
        job_id: jobId,
        parent_issue: issueNumber,
        status: "open",
        pipeline: {
          stage: "idle",
          attempt: 0,
          last_activity: null,
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }))

      const result = await executeStatus(projectId, { issueNumber })
      expect(result.output).not.toContain("Pipeline:")
    })

    /**
     * Elapsed time suffix in Pipeline line.
     * formatElapsed is imported from util/format.ts (not inspect-commands.ts).
     * It takes a string | null (ISO timestamp) and returns a formatted string.
     */
    test("Pipeline line includes elapsed suffix when last_activity is set (line 238-240)", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 106

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      // Set last_activity to 90 seconds ago
      const lastActivity = new Date(Date.now() - 90_000).toISOString()

      await Store.createTask(projectId, makeTask({
        id: "research-task-7",
        job_id: jobId,
        parent_issue: issueNumber,
        status: "in_progress",
        pipeline: {
          stage: "adversarial-running",
          attempt: 1,
          last_activity: lastActivity,
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }))

      const result = await executeStatus(projectId, { issueNumber })
      // Should be "adversarial-running (attempt 1, 1m 30s)" approximately
      expect(result.output).toContain("Pipeline: adversarial-running (attempt 1,")
      expect(result.output).toContain("1m")
    })
  })

  /**
   * Documents task sort order in status output (job-commands.ts line 229).
   * Tasks are sorted by id.localeCompare(b.id) — alphabetical by task ID.
   */
  describe("task sort order", () => {
    test("tasks are sorted alphabetically by id", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 200

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      await Store.createTask(projectId, makeTask({ id: "task-c", job_id: jobId, parent_issue: issueNumber, title: "C" }))
      await Store.createTask(projectId, makeTask({ id: "task-a", job_id: jobId, parent_issue: issueNumber, title: "A" }))
      await Store.createTask(projectId, makeTask({ id: "task-b", job_id: jobId, parent_issue: issueNumber, title: "B" }))

      const result = await executeStatus(projectId, { issueNumber })

      const posA = result.output.indexOf("task-a")
      const posB = result.output.indexOf("task-b")
      const posC = result.output.indexOf("task-c")

      expect(posA).toBeLessThan(posB)
      expect(posB).toBeLessThan(posC)
    })
  })

  /**
   * Documents data available per Task (types.ts) that is NOT yet surfaced in status.
   * These are the injection points for adding agent activity info:
   *
   * Available but not shown:
   * - task.assignee_pid (number | null): OS process ID of the developer agent
   * - task.branch (string | null): git branch the developer is working on
   * - task.base_commit (string | null): starting commit for diff computation
   * - task.pipeline.last_steering (string | null): last time PM sent steering guidance
   * - task.pipeline.adversarial_verdict: last adversarial review verdict
   *
   * To inject `assignee_pid` display: add after job-commands.ts line 233:
   *   if (task.assignee_pid) lines.push(`    Session PID: ${task.assignee_pid}`)
   *
   * To inject `branch` display: add after line 233:
   *   if (task.branch) lines.push(`    Branch: ${task.branch}`)
   */
  describe("data available per task not yet rendered in status", () => {
    test("assignee_pid is stored in task but not rendered in status output", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 300

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      await Store.createTask(projectId, makeTask({
        id: "research-task-pid",
        job_id: jobId,
        parent_issue: issueNumber,
        status: "in_progress",
        assignee: "ses-dev-abc",
        assignee_pid: 99001,
      }))

      const task = await Store.getTask(projectId, "research-task-pid")
      // Confirm the field is stored
      expect(task?.assignee_pid).toBe(99001)

      const result = await executeStatus(projectId, { issueNumber })
      // Currently NOT rendered in status output — this is the injection point
      expect(result.output).not.toContain("99001")
      expect(result.output).not.toContain("Session PID")
    })

    test("branch is stored in task but not rendered in status output", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 301

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      await Store.createTask(projectId, makeTask({
        id: "research-task-branch",
        job_id: jobId,
        parent_issue: issueNumber,
        status: "in_progress",
        branch: "opencode/task-research-task-branch",
      }))

      const task = await Store.getTask(projectId, "research-task-branch")
      expect(task?.branch).toBe("opencode/task-research-task-branch")

      const result = await executeStatus(projectId, { issueNumber })
      // Currently NOT rendered in status output — injection point available
      expect(result.output).not.toContain("opencode/task-research-task-branch")
    })

    test("last_steering timestamp is stored in pipeline but not rendered in status", async () => {
      const projectId = `proj-${Date.now()}`
      const jobId = `job-${Date.now()}`
      const issueNumber = 302

      await Store.createJob(projectId, {
        id: jobId,
        parent_issue: issueNumber,
        status: "running",
        created_at: new Date().toISOString(),
        stopping: false,
        pulse_pid: null,
        max_workers: 3,
        pm_session_id: "ses-pm",
        feature_branch: null,
      })

      const steeringTime = "2025-06-01T12:00:00.000Z"
      await Store.createTask(projectId, makeTask({
        id: "research-task-steering",
        job_id: jobId,
        parent_issue: issueNumber,
        status: "in_progress",
        pipeline: {
          stage: "developing",
          attempt: 1,
          last_activity: new Date().toISOString(),
          last_steering: steeringTime,
          history: [],
          adversarial_verdict: null,
        },
      }))

      const task = await Store.getTask(projectId, "research-task-steering")
      expect(task?.pipeline.last_steering).toBe(steeringTime)

      const result = await executeStatus(projectId, { issueNumber })
      // Not rendered in status — injection point available in Pipeline block
      expect(result.output).not.toContain("last_steering")
      expect(result.output).not.toContain(steeringTime)
    })
  })

  /**
   * Documents the "no job found" and "historical tasks" fallback paths
   * (job-commands.ts lines 198-213).
   */
  describe("fallback paths when no active job", () => {
    test("returns job-not-found message when no job exists for issue", async () => {
      const projectId = `proj-${Date.now()}`

      const result = await executeStatus(projectId, { issueNumber: 999 })
      expect(result.title).toBe("Job not found")
      expect(result.output).toContain("No job found for issue #999")
      expect(result.output).toContain('taskctl start 999')
    })

    test("returns job-completed message when historical tasks exist but no active job", async () => {
      const projectId = `proj-${Date.now()}`
      // Create a task linked to this issue (no active job)
      await Store.createTask(projectId, makeTask({
        id: "hist-task-1",
        job_id: "job-old",
        parent_issue: 500,
      }))

      const result = await executeStatus(projectId, { issueNumber: 500 })
      expect(result.title).toBe("Job completed")
      expect(result.output).toContain("1 tasks found")
    })
  })
})
