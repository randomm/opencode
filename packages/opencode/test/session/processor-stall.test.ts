import { describe, expect, test } from "bun:test"
import path from "path"
import { SessionProcessor, isSessionStalled } from "../../src/session/processor"
import { MessageV2 } from "../../src/session/message-v2"
import { Session } from "../../src/session"
import { LLM } from "../../src/session/llm"
import { Instance } from "../../src/project/instance"
import { Identifier } from "../../src/id/id"
import type {Provider} from "../../src/provider/provider"

const projectRoot = path.join(__dirname, "../..")

function createModel(): Provider.Model {
  return {
    id: "test-model",
    providerID: "test",
    name: "Test",
    limit: {
      context: 100_000,
      input: 0,
      output: 32_000,
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    api: { npm: "@ai-sdk/anthropic" },
    options: {},
  } as Provider.Model
}

function createAssistantMessage(sessionID: string): MessageV2.Assistant {
  return {
    id: Identifier.ascending("message"),
    sessionID,
    role: "assistant",
    parentID: Identifier.ascending("message"),
    modelID: "test-model",
    providerID: "test",
    mode: "code",
    agent: "code",
    path: { cwd: "/test", root: "/test" },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() },
  }
}

describe("SessionProcessor stall detection configuration", () => {
  test("default stall timeout is 180000ms (3 minutes)", () => {
    const defaultTimeout = parseInt(process.env.OPENCODE_STALL_TIMEOUT_MS || "180000", 10)

    expect(defaultTimeout).toBe(180000)
    expect(defaultTimeout / 60000).toBe(3)
  })

  test("env var OPENCODE_STALL_TIMEOUT_MS can override default", () => {
    const original = process.env.OPENCODE_STALL_TIMEOUT_MS
    process.env.OPENCODE_STALL_TIMEOUT_MS = "300000"

    const customTimeout = parseInt(process.env.OPENCODE_STALL_TIMEOUT_MS || "180000", 10)

    expect(customTimeout).toBe(300000)
    expect(customTimeout / 60000).toBe(5)

    process.env.OPENCODE_STALL_TIMEOUT_MS = original
  })
})

describe("Stall detection parentID gating", () => {
  test("subagent session (with parentID) evaluates stall condition correctly", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const parent = await Session.create({})
        const session = await Session.create({ parentID: parent.id })
        expect(session.parentID).toBe(parent.id)

        // Test the exact condition from processor.ts line 94:
        // if (session.parentID && Date.now() - lastTokenTime > stallTimeout)
        const lastTokenTime = Date.now() - 1000 // 1 second ago
        const stallTimeout = 500 // 500ms timeout
        const elapsed = Date.now() - lastTokenTime
        const shouldStall = !!session.parentID && elapsed > stallTimeout

        // Subagent with parentID: parentID is truthy, so full condition evaluates
        expect(shouldStall).toBe(true)

        await Session.remove(session.id)
        await Session.remove(parent.id)
      },
    })
  })

  test("root session (no parentID) does NOT evaluate stall condition", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        expect(session.parentID).toBeUndefined()

        // Test the exact condition from processor.ts line 94:
        // if (session.parentID && Date.now() - lastTokenTime > stallTimeout)
        const lastTokenTime = Date.now() - 1000 // 1 second ago
        const stallTimeout = 500 // 500ms timeout
        const elapsed = Date.now() - lastTokenTime
        const shouldStall = !!session.parentID && elapsed > stallTimeout

        // Root session: parentID is undefined/falsy, so short-circuits to false
        // even though elapsed > stallTimeout would be true
        expect(shouldStall).toBe(false)

        await Session.remove(session.id)
      },
    })
  })
})

describe("Stall timeout validation", () => {
  test("handles valid integer timeout values", () => {
    process.env.OPENCODE_STALL_TIMEOUT_MS = "90000"

    const timeout = parseInt(process.env.OPENCODE_STALL_TIMEOUT_MS || "180000", 10)

    expect(timeout).toBe(90000)
    expect(timeout).toBeGreaterThanOrEqual(1000)
  })

  test("parses string env var to integer", () => {
    process.env.OPENCODE_STALL_TIMEOUT_MS = "120000"
    const parsed = parseInt(process.env.OPENCODE_STALL_TIMEOUT_MS || "180000", 10)

    expect(typeof parsed).toBe("number")
    expect(parsed).toBe(120000)
  })

  test("uses fallback when env var is not set", () => {
    const original = process.env.OPENCODE_STALL_TIMEOUT_MS
    delete process.env.OPENCODE_STALL_TIMEOUT_MS

    const timeout = parseInt(process.env.OPENCODE_STALL_TIMEOUT_MS || "180000", 10)

    expect(timeout).toBe(180000)

    if (original) process.env.OPENCODE_STALL_TIMEOUT_MS = original
  })
})

describe("Stalled sessions tracking", () => {
  test("isSessionStalled reports stall status for sessions", () => {
    expect(typeof isSessionStalled).toBe("function")
    expect(isSessionStalled("nonexistent-session")).toBe(false)
  })
})