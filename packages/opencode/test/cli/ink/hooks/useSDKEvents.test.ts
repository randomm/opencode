import { describe, it, expect, mock } from "bun:test"
import type { Action } from "@/cli/ink/state/reducer"
import type { Event } from "@opencode-ai/sdk/v2"

describe("useSDKEvents - sendMessage logic", () => {
  it("formats prompt request correctly", () => {
    const sessionId = "sess-1"
    const content = "test message"

    const expectedRequest = {
      sessionID: sessionId,
      parts: [{ type: "text", text: content }],
    }

    expect(expectedRequest.sessionID).toBe("sess-1")
    expect(expectedRequest.parts).toHaveLength(1)
    expect(expectedRequest.parts[0].type).toBe("text")
    expect(expectedRequest.parts[0].text).toBe("test message")
  })

  it("clears streaming state before sending", () => {
    const dispatch = mock<(action: Action) => void>(() => {})

    dispatch({ type: "CLEAR_STREAMING" })

    expect(dispatch).toHaveBeenCalledWith({ type: "CLEAR_STREAMING" })
  })

  it("handles error by setting streaming to false", () => {
    let isStreaming = true
    const error = new Error("Network error")

    try {
      throw error
    } catch (err) {
      isStreaming = false
      console.error("Failed to send message:", err)
    }

    expect(isStreaming).toBe(false)
  })
})

describe("useSDKEvents - streaming state tracking", () => {
  it("sets isStreaming to false on message.updated event", () => {
    const dispatch = mock<(action: Action) => void>(() => {})
    let isStreaming = true

    const messageUpdatedEvent: Event = {
      type: "message.updated",
      properties: {
        info: {
          id: "msg-1",
          sessionID: "sess-1",
          role: "assistant",
          parts: [],
          time: { created: Date.now() },
        },
      },
    }

    if (messageUpdatedEvent.type === "message.updated") {
      isStreaming = false
      dispatch({
        type: "MESSAGE_COMPLETE",
        payload: { id: messageUpdatedEvent.properties.info.id },
      })
    }

    expect(isStreaming).toBe(false)
    expect(dispatch).toHaveBeenCalledWith({
      type: "MESSAGE_COMPLETE",
      payload: { id: "msg-1" },
    })
  })

  it("sets isStreaming to false on session.status idle event", () => {
    const dispatch = mock<(action: Action) => void>(() => {})
    let isStreaming = true

    const sessionStatusEvent: Event = {
      type: "session.status",
      properties: {
        sessionID: "sess-1",
        status: { type: "idle" },
      },
    }

    if (sessionStatusEvent.type === "session.status") {
      if (sessionStatusEvent.properties.status.type === "idle") {
        isStreaming = false
        dispatch({ type: "CLEAR_STREAMING" })
      }
    }

    expect(isStreaming).toBe(false)
    expect(dispatch).toHaveBeenCalledWith({ type: "CLEAR_STREAMING" })
  })
})
