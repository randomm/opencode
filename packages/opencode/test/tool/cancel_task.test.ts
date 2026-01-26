import { describe, expect, test } from "bun:test"
import { CancelTaskTool } from "../../src/tool/cancel_task"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { tmpdir } from "../fixture/fixture"

const ctx = {
  sessionID: "test",
  messageID: "",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  metadata: () => {},
  ask: async () => {},
}

describe("tool.cancel_task", () => {
  test("returns not_found for non-existent task", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await CancelTaskTool.init()
        const result = await tool.execute({ task_id: "non-existent" }, ctx)

        const output = JSON.parse(result.output)
        expect(output.status).toBe("not_found")
        expect(output.task_id).toBe("non-existent")
        expect(output.message).toContain("not found")
        expect(result.metadata.status).toBe("not_found")
      },
    })
  })

  test("returns already_completed for completed task", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await CancelTaskTool.init()
        const taskId = "test-task-completed"

        Session.trackBackgroundTask(taskId, Promise.resolve("Task result"), undefined, {
          agent_type: "test",
          description: "Test task",
          session_id: ctx.sessionID,
          start_time: Date.now(),
        })

        await new Promise((r) => setTimeout(r, 100))

        const result = await tool.execute({ task_id: taskId }, ctx)

        const output = JSON.parse(result.output)
        expect(output.status).toBe("already_completed")
        expect(output.task_id).toBe(taskId)
        expect(output.message).toContain("cannot be cancelled")
        expect(result.metadata.status).toBe("already_completed")
      },
    })
  })

  test("cancels a running task", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await CancelTaskTool.init()
        const taskId = "test-task-running"
        let taskStarted = false

        const promise = new Promise<string>((resolve) => {
          taskStarted = true
          setTimeout(() => resolve("Should not complete"), 10000)
        })

        Session.trackBackgroundTask(taskId, promise, undefined, {
          agent_type: "test",
          description: "Test task",
          session_id: ctx.sessionID,
          start_time: Date.now(),
        })

        await new Promise((r) => setTimeout(r, 50))

        const result = await tool.execute({ task_id: taskId }, ctx)

        const output = JSON.parse(result.output)
        expect(output.status).toBe("cancelled")
        expect(output.task_id).toBe(taskId)
        expect(output.message).toContain("cancelled")
        expect(result.metadata.status).toBe("cancelled")
      },
    })
  })

  test("validates input with Zod schema", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await CancelTaskTool.init()

        const parameters = tool.parameters
        expect(parameters).toBeDefined()

        const valid = parameters.safeParse({ task_id: "test-id" })
        expect(valid.success).toBe(true)

        const invalidEmpty = parameters.safeParse({ task_id: "" })
        expect(invalidEmpty.success).toBe(false)

        const invalidSpecialChars = parameters.safeParse({ task_id: "test@id" })
        expect(invalidSpecialChars.success).toBe(false)

        const validWithHyphen = parameters.safeParse({ task_id: "test-id-123" })
        expect(validWithHyphen.success).toBe(true)

        const validWithUnderscore = parameters.safeParse({ task_id: "test_id_123" })
        expect(validWithUnderscore.success).toBe(true)
      },
    })
  })

  test("has correct tool description", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await CancelTaskTool.init()
        expect(tool.description).toContain("Stop a running background task")
        expect(tool.description).toContain("cancelled")
      },
    })
  })
})
