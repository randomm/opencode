import { describe, expect, test } from "bun:test"
import path from "path"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionProcessor } from "../../src/session/processor"
import { Session } from "../../src/session"
import { Instance } from "../../src/project/instance"

const projectRoot = path.join(__dirname, "../..")

describe("SessionProcessor - pending tool handling (issue #213)", () => {
  test("tool-result handler should accept pending status", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const assistantMessage = await Session.createMessage({
          sessionID: session.id,
        })

        const processor = SessionProcessor.create({
          assistantMessage,
          sessionID: session.id,
          model: {
            type: "openai",
            name: "test-model",
            providerID: "test",
          },
          abort: new AbortController().signal,
        })

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
        const assistantMessage = await Session.createMessage({
          sessionID: session.id,
        })

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
})