/**
 * Tests documenting model resolution APIs in task.ts and supporting types.
 *
 * Acceptance criteria:
 * 1. Exact API calls and types used in task.ts for model resolution
 * 2. Correct way to get last assistant message from a PM session and extract modelID/providerID
 * 3. SessionPrompt.prompt() signature accepts a model parameter
 */

import { describe, test, expect } from "bun:test"
import z from "zod"
import { SessionPrompt } from "../../src/session/prompt"
import { MessageV2 } from "../../src/session/message-v2"

// Source files under test
const TASK_TOOL_SRC = "src/tool/task.ts"
const PROMPT_SRC = "src/session/prompt.ts"

describe("task.ts model resolution — exact API calls", () => {
  test("uses MessageV2.get to fetch the parent session message", async () => {
    const src = await Bun.file(TASK_TOOL_SRC).text()
    // Exact call used to fetch the triggering message
    expect(src).toContain("MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })")
  })

  test("asserts fetched message is an assistant message before reading modelID", async () => {
    const src = await Bun.file(TASK_TOOL_SRC).text()
    // Guards against wrong role before accessing msg.info.modelID / msg.info.providerID
    expect(src).toContain('msg.info.role !== "assistant"')
  })

  test("resolves model as agent.model fallback to parent message model", async () => {
    const src = await Bun.file(TASK_TOOL_SRC).text()
    // The exact expression used to build the model object
    expect(src).toContain("agent.model ??")
    expect(src).toContain("msg.info.modelID")
    expect(src).toContain("msg.info.providerID")
  })

  test("passes resolved model to both SessionPrompt.prompt call sites", async () => {
    const src = await Bun.file(TASK_TOOL_SRC).text()
    const calls = [...src.matchAll(/SessionPrompt\.prompt\(\{[\s\S]*?\}\)/g)].map((m) => m[0])
    expect(calls.length).toBeGreaterThanOrEqual(2)
    for (const call of calls) {
      expect(call).toContain("model:")
    }
  })

  test("model passed to SessionPrompt.prompt has modelID and providerID fields", async () => {
    const src = await Bun.file(TASK_TOOL_SRC).text()
    // Both sync and async prompt calls use the same model shape
    expect(src).toContain("modelID: model.modelID")
    expect(src).toContain("providerID: model.providerID")
  })
})

describe("MessageV2.Assistant — types for last assistant message extraction", () => {
  test("MessageV2.Assistant schema has modelID field", () => {
    const result = MessageV2.Assistant.safeParse({
      role: "assistant",
      id: "msg_01abc",
      sessionID: "ses_01abc",
      parentID: "msg_00abc",
      modelID: "claude-sonnet-4-5",
      providerID: "anthropic",
      mode: "build",
      agent: "build",
      path: { cwd: "/tmp", root: "/tmp" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: Date.now() },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.modelID).toBe("claude-sonnet-4-5")
    }
  })

  test("MessageV2.Assistant schema has providerID field", () => {
    const result = MessageV2.Assistant.safeParse({
      role: "assistant",
      id: "msg_01abc",
      sessionID: "ses_01abc",
      parentID: "msg_00abc",
      modelID: "claude-sonnet-4-5",
      providerID: "anthropic",
      mode: "build",
      agent: "build",
      path: { cwd: "/tmp", root: "/tmp" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: Date.now() },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.providerID).toBe("anthropic")
    }
  })

  test("MessageV2.WithParts type has info field typed as MessageV2.Info (discriminated union)", () => {
    // Verify the shape of MessageV2.WithParts matches what task.ts expects
    const parsed = MessageV2.WithParts.safeParse({
      info: {
        role: "assistant",
        id: "msg_01abc",
        sessionID: "ses_01abc",
        parentID: "msg_00abc",
        modelID: "gpt-4o",
        providerID: "openai",
        mode: "build",
        agent: "build",
        path: { cwd: "/tmp", root: "/tmp" },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: Date.now() },
      },
      parts: [],
    })
    expect(parsed.success).toBe(true)
  })
})

describe("last assistant message extraction from PM session", () => {
  test("MessageV2.stream is the correct API to iterate messages for a session", async () => {
    // MessageV2.stream(sessionID) is an AsyncIterable<WithParts>
    // The same pattern used in pulse.ts resolveModel and prompt.ts loop
    const src = await Bun.file(PROMPT_SRC).text()
    expect(src).toContain("MessageV2.stream(")
  })

  test("filtering for role === 'assistant' on msg.info yields assistant messages", () => {
    // Verify that role discrimination is available on the Info union type
    const assistantInfo = MessageV2.Info.safeParse({
      role: "assistant",
      id: "msg_01abc",
      sessionID: "ses_01abc",
      parentID: "msg_00abc",
      modelID: "claude-sonnet-4-5",
      providerID: "anthropic",
      mode: "build",
      agent: "build",
      path: { cwd: "/tmp", root: "/tmp" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: Date.now() },
    })
    expect(assistantInfo.success).toBe(true)
    if (assistantInfo.success) {
      expect(assistantInfo.data.role).toBe("assistant")
      // TypeScript narrowing: after role === "assistant", modelID and providerID are accessible
      if (assistantInfo.data.role === "assistant") {
        expect(assistantInfo.data.modelID).toBe("claude-sonnet-4-5")
        expect(assistantInfo.data.providerID).toBe("anthropic")
      }
    }
  })

  test("pulse.ts resolveModel iterates MessageV2.stream to find first assistant message", async () => {
    const src = await Bun.file("src/tasks/pulse.ts").text()
    // resolveModel must use MessageV2.stream to iterate session messages
    expect(src).toContain("for await (const msg of MessageV2.stream(")
    expect(src).toContain('msg.info.role === "assistant"')
    expect(src).toContain("msg.info.modelID")
    expect(src).toContain("msg.info.providerID")
  })
})

describe("SessionPrompt.prompt — model parameter in signature", () => {
  test("PromptInput schema has an optional model field", () => {
    // model is optional — SessionPrompt.prompt({ sessionID, parts }) is valid without it
    const withoutModel = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_01aaaaaaaaaaaaaaaaaaaaaaa",
      parts: [{ type: "text", text: "hello" }],
    })
    expect(withoutModel.success).toBe(true)
  })

  test("PromptInput schema accepts model with providerID and modelID", () => {
    const withModel = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_01aaaaaaaaaaaaaaaaaaaaaaa",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
      parts: [{ type: "text", text: "hello" }],
    })
    expect(withModel.success).toBe(true)
  })

  test("PromptInput model field shape matches task.ts usage", () => {
    // task.ts passes: model: { modelID: model.modelID, providerID: model.providerID }
    const modelShape = z.object({ providerID: z.string(), modelID: z.string() })
    const result = modelShape.safeParse({ providerID: "anthropic", modelID: "claude-sonnet-4-5" })
    expect(result.success).toBe(true)

    // PromptInput.model must accept the same shape
    const promptWithModel = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_01aaaaaaaaaaaaaaaaaaaaaaa",
      model: { providerID: "anthropic", modelID: "claude-sonnet-4-5" },
      parts: [],
    })
    expect(promptWithModel.success).toBe(true)
  })

  test("prompt.ts source exports PromptInput with model field", async () => {
    const src = await Bun.file(PROMPT_SRC).text()
    // The PromptInput schema must define a model property
    expect(src).toContain("model:")
    // model is typed with providerID and modelID
    expect(src).toContain("providerID: z.string()")
    expect(src).toContain("modelID: z.string()")
  })
})
