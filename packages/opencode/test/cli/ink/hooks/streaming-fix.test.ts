import { describe, it, expect } from "bun:test"
import { appReducer, initialState } from "@/cli/ink/state/reducer"
import type { Event } from "@opencode-ai/sdk/v2"

describe("TUI Response Rendering Fix - Issue #142", () => {
  it("preserves response text through complete event sequence", () => {
    // Simulate the exact event sequence from the debug log where response was lost
    const sessionId = "sess-1"
    let state = initialState
    let isStreaming = false

    // 1. User sends message - clear previous state
    state = appReducer(state, { type: "CLEAR_STREAMING" })
    isStreaming = true
    expect(state.streaming.text).toBe("")
    expect(state.messages).toHaveLength(0)

    // 2. message.part.updated - LLM streams text response
    const textEvent: Event = {
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-1",
          sessionID: sessionId,
          messageID: "msg-1",
          type: "text",
          text: "Hello! How can I help you today?",
        },
        delta: "Hello! How can I help you today?",
      },
    }

    if (textEvent.type === "message.part.updated" && textEvent.properties.part.type === "text") {
      const content = textEvent.properties.delta ?? textEvent.properties.part.text
      state = appReducer(state, { type: "STREAM_TEXT", payload: content as string })
    }

    // Response is now in streaming.text
    expect(state.streaming.text).toBe("Hello! How can I help you today?")
    expect(state.messages).toHaveLength(0)

    // 3. message.updated - message completes
    const messageUpdatedEvent: Event = {
      type: "message.updated",
      properties: {
        info: {
          id: "msg-1",
          sessionID: sessionId,
          role: "assistant",
          parts: [],
          time: { created: Date.now() },
        },
      },
    }

    if (messageUpdatedEvent.type === "message.updated") {
      isStreaming = false
      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: messageUpdatedEvent.properties.info.id },
      })
    }

    // MESSAGE_COMPLETE moves text to messages array and clears streaming
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].parts).toHaveLength(1)
    expect(state.messages[0].parts[0].type).toBe("text")
    if (state.messages[0].parts[0].type === "text") {
      expect(state.messages[0].parts[0].content).toBe("Hello! How can I help you today?")
    }
    expect(state.streaming.text).toBe("")

    // 4. session.status: idle - this was clearing everything (THE BUG!)
    // After the fix, this should NOT dispatch CLEAR_STREAMING
    const sessionStatusEvent: Event = {
      type: "session.status",
      properties: {
        sessionID: sessionId,
        status: { type: "idle" },
      },
    }

    if (sessionStatusEvent.type === "session.status") {
      if (sessionStatusEvent.properties.status.type === "idle") {
        isStreaming = false
        // FIX: Don't dispatch CLEAR_STREAMING here
        // The old buggy code did: dispatch({ type: "CLEAR_STREAMING" })
      }
    }

    // Message should still be preserved in messages array
    expect(state.messages).toHaveLength(1)
    if (state.messages[0].parts[0].type === "text") {
      expect(state.messages[0].parts[0].content).toBe("Hello! How can I help you today?")
    }
    expect(isStreaming).toBe(false)
  })

  it("handles multiple text chunks correctly", () => {
    const sessionId = "sess-1"
    let state = initialState

    // Clear previous state
    state = appReducer(state, { type: "CLEAR_STREAMING" })

    // Stream text in chunks
    state = appReducer(state, { type: "STREAM_TEXT", payload: "Hello! " })
    state = appReducer(state, { type: "STREAM_TEXT", payload: "How can " })
    state = appReducer(state, { type: "STREAM_TEXT", payload: "I help you?" })

    expect(state.streaming.text).toBe("Hello! How can I help you?")

    // Complete the message
    state = appReducer(state, {
      type: "MESSAGE_COMPLETE",
      payload: { id: "msg-1" },
    })

    expect(state.messages).toHaveLength(1)
    if (state.messages[0].parts[0].type === "text") {
      expect(state.messages[0].parts[0].content).toBe("Hello! How can I help you?")
    }
    expect(state.streaming.text).toBe("")
  })
})
