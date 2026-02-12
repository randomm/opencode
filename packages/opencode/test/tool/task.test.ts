import { describe, expect, test } from "bun:test"
import { TaskTool } from "../../src/tool/task"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

const ctx = {
  sessionID: "test-parent",
  messageID: "msg-1",
  callID: "",
  agent: "test",
  abort: AbortSignal.any([]),
  metadata: () => {},
  ask: async () => {},
  extra: { bypassAgentCheck: true },
}

describe("tool.task", () => {
  test("validates sync parameter", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await TaskTool.init()
        const parameters = tool.parameters

        const valid1 = parameters.safeParse({
          description: "Test",
          prompt: "Task",
          subagent_type: "developer",
        })
        expect(valid1.success).toBe(true)

        const valid2 = parameters.safeParse({
          description: "Test",
          prompt: "Task",
          subagent_type: "developer",
          sync: true,
        })
        expect(valid2.success).toBe(true)

        const invalid = parameters.safeParse({ sync: true })
        expect(invalid.success).toBe(false)
      },
    })
  })
})
