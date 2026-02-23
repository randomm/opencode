import { describe, expect, test, spyOn } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Store } from "../../src/tasks/store"
import type { Task, Job, AdversarialVerdict } from "../../src/tasks/types"
import { tmpdir } from "../fixture/fixture"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { Worktree } from "../../src/worktree"
import { MessageV2 } from "../../src/session/message-v2"

import { spawnDeveloper, spawnAdversarial, respawnDeveloper } from "../../src/tasks/pulse-scheduler"

const PM_MODEL = { modelID: "claude-opus-4-5", providerID: "anthropic" }

function mockPmStream() {
  ;(MessageV2 as any).stream = async function* (_sessionId: string) {
    yield {
      info: { role: "assistant", modelID: PM_MODEL.modelID, providerID: PM_MODEL.providerID, id: "msg_pm_001" },
      parts: [],
    }
  }
}

function makeTask(override: Partial<Task> = {}): Task {
  const now = new Date().toISOString()
  return {
    id: `tsk_${Math.random().toString(36).slice(2)}`,
    title: "Test task",
    description: "Test description",
    acceptance_criteria: "Test criteria",
    parent_issue: 1,
    job_id: "job-model-test",
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
    ...override,
  }
}

function makeJob(pmSessionId: string, override: Partial<Job> = {}): Job {
  return {
    id: "job-model-test",
    parent_issue: 1,
    status: "running",
    created_at: new Date().toISOString(),
    stopping: false,
    pulse_pid: null,
    max_workers: 3,
    pm_session_id: pmSessionId,
    feature_branch: null,
    ...override,
  }
}

describe("model propagation in spawn functions", () => {
  test("spawnDeveloper passes PM session model to SessionPrompt.prompt", async () => {
    const origStream = MessageV2.stream
    mockPmStream()

    const promptCalls: SessionPrompt.PromptInput[] = []
    const promptSpy = spyOn(SessionPrompt, "prompt")
    promptSpy.mockImplementation(async (input: SessionPrompt.PromptInput) => {
      promptCalls.push(input)
      return undefined as any
    })
    const removeSpy: any = spyOn(Worktree, "remove")
    removeSpy.mockImplementation(async () => true)

    try {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const projectId = Instance.project.id
          const pmSession = await Session.create({ directory: tmp.path, title: "PM", permission: [] })
          const job = makeJob(pmSession.id)
          const task = makeTask({ job_id: job.id })

          await Store.createJob(projectId, job)
          await Store.createTask(projectId, task)

          await spawnDeveloper(task, job.id, projectId, pmSession.id)

          expect(promptCalls.length).toBeGreaterThan(0)
          const call = promptCalls[0]!
          expect(call.model).toBeDefined()
          expect(call.model!.modelID).toBe(PM_MODEL.modelID)
          expect(call.model!.providerID).toBe(PM_MODEL.providerID)
        },
      })
    } finally {
      ;(MessageV2 as any).stream = origStream
      promptSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })

  test("spawnAdversarial passes PM session model to SessionPrompt.prompt", async () => {
    const origStream = MessageV2.stream
    mockPmStream()

    const promptCalls: SessionPrompt.PromptInput[] = []
    const promptSpy = spyOn(SessionPrompt, "prompt")
    promptSpy.mockImplementation(async (input: SessionPrompt.PromptInput) => {
      promptCalls.push(input)
      return undefined as any
    })
    const removeSpy: any = spyOn(Worktree, "remove")
    removeSpy.mockImplementation(async () => true)

    try {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const projectId = Instance.project.id
          const pmSession = await Session.create({ directory: tmp.path, title: "PM", permission: [] })
          const job = makeJob(pmSession.id)
          const task = makeTask({
            job_id: job.id,
            status: "in_progress",
            worktree: tmp.path,
            pipeline: {
              stage: "reviewing",
              attempt: 0,
              last_activity: new Date().toISOString(),
              last_steering: null,
              history: [],
              adversarial_verdict: null,
            },
          })

          await Store.createJob(projectId, job)
          await Store.createTask(projectId, task)

          await spawnAdversarial(task, job.id, projectId, pmSession.id)

          expect(promptCalls.length).toBeGreaterThan(0)
          const call = promptCalls[0]!
          expect(call.model).toBeDefined()
          expect(call.model!.modelID).toBe(PM_MODEL.modelID)
          expect(call.model!.providerID).toBe(PM_MODEL.providerID)
        },
      })
    } finally {
      ;(MessageV2 as any).stream = origStream
      promptSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })

  test("respawnDeveloper passes PM session model to SessionPrompt.prompt", async () => {
    const origStream = MessageV2.stream
    mockPmStream()

    const promptCalls: SessionPrompt.PromptInput[] = []
    const promptSpy = spyOn(SessionPrompt, "prompt")
    promptSpy.mockImplementation(async (input: SessionPrompt.PromptInput) => {
      promptCalls.push(input)
      return undefined as any
    })
    const removeSpy: any = spyOn(Worktree, "remove")
    removeSpy.mockImplementation(async () => true)

    try {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const projectId = Instance.project.id
          const pmSession = await Session.create({ directory: tmp.path, title: "PM", permission: [] })
          const job = makeJob(pmSession.id)
          const task = makeTask({
            job_id: job.id,
            status: "in_progress",
            worktree: tmp.path,
            pipeline: {
              stage: "reviewing",
              attempt: 1,
              last_activity: new Date().toISOString(),
              last_steering: null,
              history: [],
              adversarial_verdict: null,
            },
          })

          await Store.createJob(projectId, job)
          await Store.createTask(projectId, task)

          const verdict: AdversarialVerdict = {
            verdict: "ISSUES_FOUND",
            summary: "Needs fixes",
            issues: [{ location: "src/foo.ts", severity: "HIGH", fix: "Add tests" }],
            created_at: new Date().toISOString(),
          }

          await respawnDeveloper(task, job.id, projectId, pmSession.id, 2, verdict)

          expect(promptCalls.length).toBeGreaterThan(0)
          const call = promptCalls[0]!
          expect(call.model).toBeDefined()
          expect(call.model!.modelID).toBe(PM_MODEL.modelID)
          expect(call.model!.providerID).toBe(PM_MODEL.providerID)
        },
      })
    } finally {
      ;(MessageV2 as any).stream = origStream
      promptSpy.mockRestore()
      removeSpy.mockRestore()
    }
  })
})
