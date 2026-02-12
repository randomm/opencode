import { describe, expect, test } from "bun:test"
import { ListTasksTool } from "../../src/tool/list_tasks"
import { Instance } from "../../src/project/instance"

describe("tool.list_tasks", () => {
  const ctx = {
    sessionID: "test-session",
    messageID: "",
    callID: "",
    agent: "test",
    abort: AbortSignal.any([]),
    messages: [],
    metadata: () => {},
    ask: async () => {},
    extra: { bypassAgentCheck: true },
  }

  test("returns empty list when no tasks", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await ListTasksTool.init()
        const result = await tool.execute({}, ctx)

        const output = JSON.parse(result.output)
        expect(output.pending).toEqual([])
        expect(output.completed).toEqual([])
        expect(output.total_count).toBe(0)
      },
    })
  })

  test("respects limit parameter", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await ListTasksTool.init()
        const result = await tool.execute({ limit: 5 }, ctx)

        const output = JSON.parse(result.output)
        expect(output.total_count).toBeLessThanOrEqual(5)
      },
    })
  })

  test("can exclude completed tasks", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await ListTasksTool.init()
        const result = await tool.execute({ include_completed: false }, ctx)

        const output = JSON.parse(result.output)
        expect(output.completed).toEqual([])
      },
    })
  })
})
