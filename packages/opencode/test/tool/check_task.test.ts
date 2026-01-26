import { describe, expect, test } from "bun:test"
import { CheckTaskTool } from "../../src/tool/check_task"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionStatus } from "../../src/session/status"
import { MessageV2 } from "../../src/session/message-v2"
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

describe("tool.check_task", () => {
  test("returns not_found for non-existent task", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await CheckTaskTool.init()
        const result = await tool.execute({ task_id: "non-existent" }, ctx)

        const output = JSON.parse(result.output)
        expect(output.status).toBe("not_found")
        expect(output.task_id).toBe("non-existent")
        expect(result.metadata.status).toBe("not_found")
      },
    })
  })

  test("returns running status for busy session", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({ permission: [] })

        SessionStatus.set(session.id, { type: "busy" })

        const tool = await CheckTaskTool.init()
        const result = await tool.execute({ task_id: session.id }, ctx)

        const output = JSON.parse(result.output)
        expect(output.status).toBe("running")
        expect(output.task_id).toBe(session.id)
        expect(output.started_at).toBeDefined()
        expect(output.completed_at).toBeUndefined()
        expect(result.metadata.status).toBe("running")
      },
    })
  })

  test("returns completed status with result for idle session", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({ permission: [] })

        const msgInfo: MessageV2.Info = {
          id: "msg1",
          sessionID: session.id,
          role: "assistant",
          parentID: "",
          mode: "test",
          modelID: "gpt-4",
          providerID: "openai",
          agent: "test",
          path: {
            cwd: tmp.path,
            root: tmp.path,
          },
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: {
              read: 0,
              write: 0,
            },
          },
          time: {
            created: Date.now(),
          },
        }

        const msg = await Session.updateMessage(msgInfo)

        await Session.updatePart({
          id: "part1",
          sessionID: session.id,
          messageID: msg.id,
          type: "text",
          text: "Task completed successfully!",
        })

        SessionStatus.set(session.id, { type: "idle" })

        const tool = await CheckTaskTool.init()
        const result = await tool.execute({ task_id: session.id }, ctx)

        const output = JSON.parse(result.output)
        expect(output.status).toBe("completed")
        expect(output.task_id).toBe(session.id)
        expect(output.result).toBe("Task completed successfully!")
        expect(output.started_at).toBeDefined()
        expect(output.completed_at).toBeDefined()
        expect(result.metadata.status).toBe("completed")
      },
    })
  })

  test("returns failed status for retry session", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({ permission: [] })

        SessionStatus.set(session.id, {
          type: "retry",
          attempt: 3,
          message: "Task failed after retries",
          next: Date.now() + 5000,
        })

        const tool = await CheckTaskTool.init()
        const result = await tool.execute({ task_id: session.id }, ctx)

        const output = JSON.parse(result.output)
        expect(output.status).toBe("failed")
        expect(output.task_id).toBe(session.id)
        expect(output.error).toBe("Task failed after retries")
        expect(output.started_at).toBeDefined()
        expect(output.completed_at).toBeDefined()
        expect(result.metadata.status).toBe("failed")
      },
    })
  })

  test("validates input with Zod schema", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await CheckTaskTool.init()

        const parameters = tool.parameters
        expect(parameters).toBeDefined()

        const valid = parameters.safeParse({ task_id: "test-id" })
        expect(valid.success).toBe(true)

        const invalid = parameters.safeParse({})
        expect(invalid.success).toBe(false)
      },
    })
  })
})
