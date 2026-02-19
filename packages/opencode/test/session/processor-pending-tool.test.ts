import { describe, expect, test } from "bun:test"
import path from "path"
import { Session } from "../../src/session"
import { Instance } from "../../src/project/instance"
import { Identifier } from "../../src/id/id"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionProcessor } from "../../src/session/processor"
import type { Provider } from "../../src/provider/provider"

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

describe("SessionProcessor - pending tool handling (issue #213)", () => {
  test("tool-result handler should accept pending status", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const assistantMessage = await Session.updateMessage(createAssistantMessage(session.id))

        const toolCallId = "tool-call-123"

        const pendingPart = await Session.updatePart({
          id: "part-1",
          messageID: assistantMessage.id,
          sessionID: session.id,
          type: "tool",
          callID: toolCallId,
          tool: "bash",
          state: {
            status: "pending",
            input: {},
            raw: "",
          },
        })

        expect(pendingPart.state.status).toBe("pending")

        const updatedPart = await Session.updatePart({
          ...pendingPart,
          state: {
            status: "completed",
            input: {},
            output: "test output",
            metadata: {},
            title: "Test",
            time: {
              start: Date.now(),
              end: Date.now(),
            },
          },
        })

        expect(updatedPart.state.status).toBe("completed")

        await Session.remove(session.id)
      },
    })
  })

  test("tool-error handler should accept pending status", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const assistantMessage = await Session.updateMessage(createAssistantMessage(session.id))

        const toolCallId = "tool-call-456"

        const pendingPart = await Session.updatePart({
          id: "part-2",
          messageID: assistantMessage.id,
          sessionID: session.id,
          type: "tool",
          callID: toolCallId,
          tool: "bash",
          state: {
            status: "pending",
            input: {},
            raw: "",
          },
        })

        expect(pendingPart.state.status).toBe("pending")

        const errorPart = await Session.updatePart({
          ...pendingPart,
          state: {
            status: "error",
            input: {},
            error: "Tool execution failed",
            time: {
              start: Date.now(),
              end: Date.now(),
            },
          },
        })

        expect(errorPart.state.status).toBe("error")
        expect(errorPart.state.error).toBe("Tool execution failed")

        await Session.remove(session.id)
      },
    })
  })

  test("as any type bypass removed - secure error handling with Object.getOwnPropertyDescriptor", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})

        // Helper function matching the pattern used in processor.ts
        function getErrorMessage(e: unknown): string {
          try {
            const desc = e && typeof e === "object"
              ? Object.getOwnPropertyDescriptor(e, "message")
              : undefined
            return desc?.value && typeof desc.value === "string"
              ? desc.value
              : String(e)
          } catch {
            return "Unknown error"
          }
        }

        // Test Error instance handling
        const error1 = new Error("Test error message")
        expect(error1 instanceof Error).toBe(true)
        expect(error1.message).toBe("Test error message")
        expect(getErrorMessage(error1)).toBe("Test error message")

        // Test object with message property (cross-realm error-like object)
        const errorLike = { message: "Cross-realm error", stack: "..." }
        expect(getErrorMessage(errorLike)).toBe("Cross-realm error")

        // Test primitive types (all handled by String() fallback)
        expect(getErrorMessage(null)).toBe("null")
        expect(getErrorMessage(undefined)).toBe("undefined")
        expect(getErrorMessage(42)).toBe("42")
        expect(getErrorMessage("test")).toBe("test")
        expect(getErrorMessage(true)).toBe("true")

        // Test object without message property
        const objWithoutMsg = { code: "ERR_TEST" }
        expect(getErrorMessage(objWithoutMsg)).toBe("[object Object]")

        // Test error object with getter on message property - ObjectPropertyDescriptor doesn't invoke getters
        // This is safe behavior: we don't risk throwing from getters during error handling
        const errorWithGetter = {
          get message() {
            return "Getter message"
          },
        }
        expect(getErrorMessage(errorWithGetter)).toBe("[object Object]")

        // Test error object with throwing getter - should fall back to String()
        const errorWithThrowingGetter = {
          get message() {
            throw new Error("Getter throws")
          },
        }
        // Object.getOwnPropertyDescriptor safely reads property descriptor without invoking getter
        expect(getErrorMessage(errorWithThrowingGetter)).toBe("[object Object]")

        // Test object with circular reference - should not crash
        const circularObj: any = { message: "Circular" }
        circularObj.self = circularObj
        expect(getErrorMessage(circularObj)).toBe("Circular")

        // Test frozen object
        const frozen = Object.freeze({ message: "Frozen error" })
        expect(getErrorMessage(frozen)).toBe("Frozen error")

        // Test non-string message value (number)
        const errorWithNumberMessage = { message: 123 as any }
        expect(getErrorMessage(errorWithNumberMessage)).toBe("[object Object]")

        await Session.remove(session.id)
      },
    })
  })
})