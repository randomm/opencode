import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Instance } from "../../src/project/instance"
import { Store } from "../../src/tasks/store"
import { createPRForJob } from "../../src/tasks/pulse-verdicts"
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

          const result = await createPRForJob(projectId, testTasks, "pm-session-id", 123)
          expect(result.ok).toBe(false)
          if (!result.ok) {
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

          const result = await createPRForJob(projectId, testTasks, "pm-session-id", 123)
          // We expect this to fail because we're not in a real git repo
          // but the important thing is it tried to use the feature_branch
          expect(result.ok).toBe(false)
          // The error should contain the PR command with the correct branch
          if (!result.ok) {
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

          const result = await createPRForJob(projectId, testTasks, "pm-session-id", 123)
          // Should try to use the fallback branch
          expect(result.ok).toBe(false)
          if (!result.ok) {
            expect(result.error).toContain("fallback-branch-123")
          }
        },
      })
    })
  })
})