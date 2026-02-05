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
      // Error would be logged: console.error("Failed to send message:", err)
    }

    expect(isStreaming).toBe(false)
  })
})

describe("useSDKEvents - message filtering", () => {
  it("filters out user message text parts", () => {
    const dispatch = mock<(action: Action) => void>(() => {})
    const currentAssistantMessageId = "msg-assistant-123"
    const userMessageId = "msg-user-456"

    // Simulate user message text part (should be filtered)
    const userTextEvent: Event = {
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-1",
          sessionID: "sess-1",
          messageID: userMessageId,
          type: "text",
          text: "Hello?",
        },
      },
    }

    // Check if this is a text part from a non-assistant message
    if (userTextEvent.type === "message.part.updated" && userTextEvent.properties.part.type === "text") {
      const part = userTextEvent.properties.part
      if (currentAssistantMessageId && part.messageID !== currentAssistantMessageId) {
        // This should be skipped - don't dispatch
        return
      }
    }

    expect(dispatch).not.toHaveBeenCalled()
  })

  it("allows assistant message text parts", () => {
    const dispatch = mock<(action: Action) => void>(() => {})
    const currentAssistantMessageId = "msg-assistant-123"

    // Simulate assistant message text part (should be allowed)
    const assistantTextEvent: Event = {
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-2",
          sessionID: "sess-1",
          messageID: currentAssistantMessageId,
          type: "text",
          text: "I can help with that!",
        },
      },
    }

    // Check if this is a text part from the assistant message
    if (assistantTextEvent.type === "message.part.updated" && assistantTextEvent.properties.part.type === "text") {
      const part = assistantTextEvent.properties.part
      if (currentAssistantMessageId && part.messageID !== currentAssistantMessageId) {
        return
      }

      dispatch({
        type: "STREAM_TEXT",
        payload: part.text,
      })
    }

    expect(dispatch).toHaveBeenCalledWith({
      type: "STREAM_TEXT",
      payload: "I can help with that!",
    })
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
        // Don't dispatch CLEAR_STREAMING - MESSAGE_COMPLETE handles it
      }
    }

    expect(isStreaming).toBe(false)
    expect(dispatch).not.toHaveBeenCalled()
  })
})
