import { describe, test, expect } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Store } from "../../src/tasks/store"
import { Global } from "../../src/global"
import path from "path"

describe("base_commit integration with spawnDeveloper", () => {
  test("base_commit field exists in Task type and can be stored", async () => {
    await using tmp = await tmpdir({ git: true })

    const originalDataPath = Global.Path.data
    process.env.OPENCODE_TEST_HOME = tmp.path
    await Global.init()

    try {
      const projectId = "test-integration-project"
      const taskId = "task-with-base-commit"

      const task: any = {
        id: taskId,
        job_id: "job-123",
        status: "in_progress",
        priority: 1,
        task_type: "implementation",
        parent_issue: 100,
        labels: ["bug-fix"],
        depends_on: [],
        assignee: "dev-session-1",
        assignee_pid: 12345,
        worktree: "/tmp/worktree/path",
        branch: "opencode/task-with-base-commit",
        base_commit: "abc1234567890def",
        title: "Implement base_commit support",
        description: "Add base_commit to Task type",
        acceptance_criteria: "base_commit is stored and retrieved correctly",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "developing",
          attempt: 1,
          last_activity: new Date().toISOString(),
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      }

      // Create and verify task
      await Store.createTask(projectId, task)
      const retrieved = await Store.getTask(projectId, taskId)

      expect(retrieved).toBeDefined()
      expect(retrieved?.base_commit).toBe("abc1234567890def")
      expect(retrieved?.worktree).toBe("/tmp/worktree/path")
      expect(retrieved?.branch).toBe("opencode/task-with-base-commit")
      expect(retrieved?.status).toBe("in_progress")

      // Update base_commit
      await Store.updateTask(
        projectId,
        taskId,
        {
          base_commit: "new1234567890base",
        },
        true,
      )

      const updated = await Store.getTask(projectId, taskId)
      expect(updated?.base_commit).toBe("new1234567890base")

      // Clear base_commit
      await Store.updateTask(
        projectId,
        taskId,
        {
          base_commit: null,
        },
        true,
      )

      const cleared = await Store.getTask(projectId, taskId)
      expect(cleared?.base_commit).toBe(null)
    } finally {
      if (originalDataPath) {
        delete process.env.OPENCODE_TEST_HOME
      }
    }
  })

  test("base_commit field persists after multiple updates", async () => {
    await using tmp = await tmpdir({ git: true })

    const originalDataPath = Global.Path.data
    process.env.OPENCODE_TEST_HOME = tmp.path
    await Global.init()

    try {
      const projectId = "test-multi-update-project"
      const taskId = "task-multi-update"

      const task: any = {
        id: taskId,
        job_id: "job-456",
        status: "open",
        priority: 2,
        task_type: "implementation",
        parent_issue: 200,
        labels: [],
        depends_on: [],
        assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        base_commit: null,
        title: "Test multi-update",
        description: "Test base_commit persists",
        acceptance_criteria: "Works across updates",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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

      // First update: add worktree and base_commit
      await Store.updateTask(
        projectId,
        taskId,
        {
          status: "in_progress",
          worktree: "/test/worktree",
          branch: "feature/branch",
          base_commit: "commit1",
        },
        true,
      )

      let t = await Store.getTask(projectId, taskId)
      expect(t?.base_commit).toBe("commit1")
      expect(t?.worktree).toBe("/test/worktree")

      // Second update: change status, base_commit should persist
      await Store.updateTask(
        projectId,
        taskId,
        {
          status: "review",
        },
        true,
      )

      t = await Store.getTask(projectId, taskId)
      expect(t?.base_commit).toBe("commit1")
      expect(t?.status).toBe("review")

      // Third update: update base_commit
      await Store.updateTask(
        projectId,
        taskId,
        {
          base_commit: "commit2",
        },
        true,
      )

      t = await Store.getTask(projectId, taskId)
      expect(t?.base_commit).toBe("commit2")
      expect(t?.status).toBe("review")
    } finally {
      if (originalDataPath) {
        delete process.env.OPENCODE_TEST_HOME
      }
    }
  })
})
