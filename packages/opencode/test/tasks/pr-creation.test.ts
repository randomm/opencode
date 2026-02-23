import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Store } from "../../src/tasks/store"
import { createPRForJob, mergeTaskBranchesToFeatureBranch } from "../../src/tasks/pulse-verdicts"
import type { Task, Job } from "../../src/tasks/types"

const TEST_PROJECT_ID = "test-pr-creation"
let testDataDir: string

describe("PR Creation on Job Completion", () => {
  beforeEach(async () => {
    testDataDir = path.join("/tmp", "opencode-pr-test-" + Math.random().toString(36).slice(2))
    await fs.mkdir(testDataDir, { recursive: true })
    process.env.OPENCODE_TEST_HOME = testDataDir

    try {
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          // Ensure project context is initialized
          const project = Instance.project.id
        },
      })
    } catch {}
  })

  afterEach(async () => {
    try {
      await fs.rm(testDataDir, { recursive: true, force: true })
    } catch {}
    process.env.OPENCODE_TEST_HOME = ""
  })

  describe("createPRForJob", () => {
    test("returns error when job has no feature branch", async () => {
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          const projectId = Instance.project.id
          const testJob: Job = {
            id: "job-no-branch",
            parent_issue: 123,
            status: "running",
            created_at: new Date().toISOString(),
            stopping: false,
            pulse_pid: null,
            max_workers: 3,
            pm_session_id: "ses_0000001234567890abctest",
            feature_branch: null,
          }

          const testTasks: Task[] = [
            {
              id: "task-1",
              title: "Test Task 1",
              description: "Description 1",
              acceptance_criteria: "Criteria 1",
              parent_issue: 123,
              job_id: testJob.id,
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: null,
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
          ]

          await Store.createJob(projectId, testJob)
          for (const task of testTasks) {
            await Store.createTask(projectId, task)
          }

          const result = await createPRForJob(projectId, testTasks, "ses_" + "test".repeat(8), 123)
          expect(result.ok).toBe(false)
          if (!result.ok!) {
            expect(result.error).toContain("No feature branch found")
          }
        },
      })
    })

    test("uses job.feature_branch when available", async () => {
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          const projectId = Instance.project.id
          const testJob: Job = {
            id: "job-with-branch",
            parent_issue: 123,
            status: "running",
            created_at: new Date().toISOString(),
            stopping: false,
            pulse_pid: null,
            max_workers: 3,
            pm_session_id: "ses_0000001234567890abctest",
            feature_branch: "feature/issue-123-test",
          }

          const testTasks: Task[] = [
            {
              id: "task-1",
              title: "Test Task 1",
              description: "Description 1",
              acceptance_criteria: "Criteria 1",
              parent_issue: 123,
              job_id: testJob.id,
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: "random-task-branch",
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
          ]

          await Store.createJob(projectId, testJob)
          for (const task of testTasks) {
            await Store.createTask(projectId, task)
          }

          const result = await createPRForJob(projectId, testTasks, "ses_" + "test".repeat(8), 123)
          expect(result.ok).toBe(false)
          if (!result.ok!) {
            expect(result.error).toContain("feature/issue-123-test")
          }
        },
      })
    })

    test("falls back to first task branch when job.feature_branch is null", async () => {
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          const projectId = Instance.project.id
          const testJob: Job = {
            id: "job-fallback",
            parent_issue: 123,
            status: "running",
            created_at: new Date().toISOString(),
            stopping: false,
            pulse_pid: null,
            max_workers: 3,
            pm_session_id: "ses_0000001234567890abctest",
            feature_branch: null,
          }

          const testTasks: Task[] = [
            {
              id: "task-1",
              title: "Test Task 1",
              description: "Description 1",
              acceptance_criteria: "Criteria 1",
              parent_issue: 123,
              job_id: testJob.id,
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: "fallback-branch-123",
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
          ]

          await Store.createJob(projectId, testJob)
          for (const task of testTasks) {
            await Store.createTask(projectId, task)
          }

          const result = await createPRForJob(projectId, testTasks, "ses_" + "test".repeat(8), 123)
          expect(result.ok).toBe(false)
          if (!result.ok!) {
            expect(result.error).toContain("fallback-branch-123")
          }
        },
      })
    })

    test("returns early when 0 commits ahead of dev", async () => {
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          const projectId = Instance.project.id
          const pmSessionId = "ses_0000001234567890abctest"

          // Initialize a real git repo
          const { $ } = await import("bun")
          await $`git init`.cwd(testDataDir).quiet()
          await $`git config user.email "test@example.com"`.cwd(testDataDir).quiet()
          await $`git config user.name "Test User"`.cwd(testDataDir).quiet()
          await $`git checkout -b dev`.cwd(testDataDir).quiet()
          await $`git checkout -b feature/issue-123`.cwd(testDataDir).quiet()

          // Create the PM session
          await Session.createNext({
            id: pmSessionId,
            directory: testDataDir,
            title: "Test PM Session",
          })

          const testJob: Job = {
            id: "job-test",
            parent_issue: 123,
            status: "running",
            created_at: new Date().toISOString(),
            stopping: false,
            pulse_pid: null,
            max_workers: 3,
            pm_session_id: pmSessionId,
            feature_branch: "feature/issue-123",
          }

          const testTasks: Task[] = [
            {
              id: "task-1",
              title: "Test Task",
              description: "Description",
              acceptance_criteria: "Criteria",
              parent_issue: 123,
              job_id: testJob.id,
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: null,
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
          ]

          await Store.createJob(projectId, testJob)
          for (const task of testTasks) {
            await Store.createTask(projectId, task)
          }

          const result = await createPRForJob(projectId, testTasks, pmSessionId, 123)
          expect(result.ok).toBe(false)
          if (!result.ok!) {
            expect(result.error).toContain("no commits ahead of dev")
          }
        },
      })
    })

test("rejects branch names with invalid characters", async () => {
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          const projectId = Instance.project.id
          const testJob: Job = {
            id: "job-invalid-branch",
            parent_issue: 123,
            status: "running",
            created_at: new Date().toISOString(),
            stopping: false,
            pulse_pid: null,
            max_workers: 3,
            pm_session_id: "ses_0000001234567890abctest",
            feature_branch: "feature/issue-123;rm -rf /", // Contains invalid semicolon and space
          }

          const pmSessionId = "ses_" + "test".repeat(8)

          const testTasks: Task[] = [
            {
              id: "task-1",
              title: "Test Task",
              description: "Description",
              acceptance_criteria: "Criteria",
              parent_issue: 123,
              job_id: testJob.id,
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: null,
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
          ]

          await Store.createJob(projectId, testJob)
          for (const task of testTasks) {
            await Store.createTask(projectId, task)
          }

          const result = await createPRForJob(projectId, testTasks, pmSessionId, 123)
          expect(result.ok).toBe(false)
          if (!result.ok!) {
            expect(result.error).toContain("Invalid feature branch name")
          }
        },
      })
    })

    test("rejects branch names with embedded newlines", async () => {
      // This tests that the regex anchors (^ and $) prevent embedded newline injection
      // Without end anchor, test('feature/issue-123\necho hacked') would return true
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          const projectId = Instance.project.id
          const testJob: Job = {
            id: "job-newline-branch",
            parent_issue: 123,
            status: "running",
            created_at: new Date().toISOString(),
            stopping: false,
            pulse_pid: null,
            max_workers: 3,
            pm_session_id: "ses_0000001234567890abctest",
            feature_branch: "feature/issue-123\necho hacked", // Contains embedded newline
          }

          const pmSessionId = "ses_" + "test".repeat(8)

          const testTasks: Task[] = [
            {
              id: "task-1",
              title: "Test Task",
              description: "Description",
              acceptance_criteria: "Criteria",
              parent_issue: 123,
              job_id: testJob.id,
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: null,
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
          ]

          await Store.createJob(projectId, testJob)
          for (const task of testTasks) {
            await Store.createTask(projectId, task)
          }

          const result = await createPRForJob(projectId, testTasks, pmSessionId, 123)
          expect(result.ok).toBe(false)
          if (!result.ok!) {
            expect(result.error).toContain("Invalid feature branch name")
          }
        },
      })
    })
  })

  describe("mergeTaskBranchesToFeatureBranch", () => {
    test("skips tasks with null branches", async () => {
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          // Initialize a real git repo
          const { $ } = await import("bun")
          await $`git init`.cwd(testDataDir).quiet()
          await $`git config user.email "test@example.com"`.cwd(testDataDir).quiet()
          await $`git config user.name "Test User"`.cwd(testDataDir).quiet()
          await $`git checkout -b feature/issue-123`.cwd(testDataDir).quiet()

          const testTasks: Task[] = [
            {
              id: "task-1",
              title: "Test Task with null branch",
              description: "Description",
              acceptance_criteria: "Criteria",
              parent_issue: 123,
              job_id: "job-1",
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: null,
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
            {
              id: "task-2",
              title: "Test Task with empty string branch",
              description: "Description",
              acceptance_criteria: "Criteria",
              parent_issue: 123,
              job_id: "job-1",
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: "",
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
          ]

          const result = await mergeTaskBranchesToFeatureBranch(testDataDir, "feature/issue-123", testTasks)
          expect(result.ok).toBe(true)
        },
      })
    })

    test("skips tasks with invalid branch names", async () => {
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          // Initialize a real git repo
          const { $ } = await import("bun")
          await $`git init`.cwd(testDataDir).quiet()
          await $`git config user.email "test@example.com"`.cwd(testDataDir).quiet()
          await $`git config user.name "Test User"`.cwd(testDataDir).quiet()
          await $`git checkout -b feature/issue-123`.cwd(testDataDir).quiet()

          const testTasks: Task[] = [
            {
              id: "task-1",
              title: "Test Task with invalid branch",
              description: "Description",
              acceptance_criteria: "Criteria",
              parent_issue: 123,
              job_id: "job-1",
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: "branch;rm -rf /", // Invalid: contains semicolon and space
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
          ]

          const result = await mergeTaskBranchesToFeatureBranch(testDataDir, "feature/issue-123", testTasks)
          expect(result.ok).toBe(true)
        },
      })
    })

    test("rejects invalid feature branch name", async () => {
      await Instance.provide({
        directory: testDataDir,
        fn: async () => {
          const testTasks: Task[] = [
            {
              id: "task-1",
              title: "Test Task",
              description: "Description",
              acceptance_criteria: "Criteria",
              parent_issue: 123,
              job_id: "job-1",
              status: "closed",
              priority: 0,
              task_type: "implementation",
              labels: [],
              depends_on: [],
              assignee: null,
              assignee_pid: null,
              worktree: null,
              branch: null,
              base_commit: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              close_reason: "approved and committed",
              comments: [],
              pipeline: {
                stage: "done",
                attempt: 0,
                last_activity: null,
                last_steering: null,
                history: [],
                adversarial_verdict: null,
              },
            },
          ]

          const result = await mergeTaskBranchesToFeatureBranch(testDataDir, "feature/issue-123;rm", testTasks)
          expect(result.ok).toBe(false)
          if (!result.ok) {
            expect(result.error).toContain("Invalid feature branch name")
          }
        },
      })
    })
  })
})