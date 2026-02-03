import { describe, it, expect } from "bun:test"
import { appReducer, initialState, type Action } from "@/cli/ink/state/reducer"

describe("Message Lifecycle Integration", () => {
  describe("User input → streaming → completion", () => {
    it("completes full message lifecycle", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Let me help you with that." })

      expect(state.streaming.text).toBe("Let me help you with that.")
      expect(state.messages.length).toBe(0)

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages.length).toBe(1)
      expect(state.messages[0].id).toBe("msg-1")
      expect(state.messages[0].role).toBe("assistant")
      expect(state.messages[0].parts[0].content).toBe("Let me help you with that.")
      expect(state.streaming.text).toBe("")
    })

    it("accumulates text during streaming phase", () => {
      let state = initialState

      const chunks = ["Let", " me", " help", " you", "."]
      for (const chunk of chunks) {
        state = appReducer(state, { type: "STREAM_TEXT", payload: chunk })
      }

      expect(state.streaming.text).toBe("Let me help you.")

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages[0].parts[0].content).toBe("Let me help you.")
    })

    it("includes completed tools in message", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "ls" } },
      })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", output: "file1.txt\nfile2.txt" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Files listed successfully." })

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages.length).toBe(1)
      expect(state.messages[0].parts.length).toBe(2)
      expect(state.messages[0].parts[0].type).toBe("text")
      expect(state.messages[0].parts[1].type).toBe("tool")
      expect(state.messages[0].parts[1].content).toBe("file1.txt\nfile2.txt")
    })

    it("excludes running tools from completed message", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "running" } },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Processing..." })

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages.length).toBe(0)
      expect(state.streaming.text).toBe("Processing...")
      expect(state.streaming.tools.get("tool-1")?.state).toBe("running")
    })

    it("handles empty streaming state gracefully", () => {
      let state = initialState

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages.length).toBe(0)
      expect(state.streaming.text).toBe("")
    })

    it("preserves previous messages when completing new one", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "First message" })
      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Second message" })
      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-2" },
      })

      expect(state.messages.length).toBe(2)
      expect(state.messages[0].parts[0].content).toBe("First message")
      expect(state.messages[1].parts[0].content).toBe("Second message")
    })
  })

  describe("Cancel during streaming", () => {
    it("clears streaming state on cancel", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Processing your request..." })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "long-task" } },
      })

      expect(state.streaming.text).toBe("Processing your request...")
      expect(state.streaming.tools.size).toBe(1)

      state = appReducer(state, { type: "CLEAR_STREAMING" })

      expect(state.streaming.text).toBe("")
      expect(state.streaming.tools.size).toBe(0)
    })

    it("preserves completed messages when clearing streaming", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "First message" })
      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Second message in progress" })

      state = appReducer(state, { type: "CLEAR_STREAMING" })

      expect(state.messages.length).toBe(1)
      expect(state.messages[0].parts[0].content).toBe("First message")
      expect(state.streaming.text).toBe("")
    })

    it("clears all running tools on cancel", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-2", name: "read", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-3", name: "write", input: {} },
      })

      expect(state.streaming.tools.size).toBe(3)

      state = appReducer(state, { type: "CLEAR_STREAMING" })

      expect(state.streaming.tools.size).toBe(0)
    })

    it("clears all running tasks on cancel", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Long task" },
      })
      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-2", description: "Another task" },
      })

      expect(state.streaming.tasks.size).toBe(2)

      state = appReducer(state, { type: "CLEAR_STREAMING" })

      expect(state.streaming.tasks.size).toBe(0)
    })
  })

  describe("Error during streaming", () => {
    it("completes message with tool error", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "fail" } },
      })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", error: "Command failed with exit code 1" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "An error occurred." })

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages.length).toBe(1)
      expect(state.streaming.tools.size).toBe(0)
    })

    it("tracks tool error state correctly", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "read", input: { path: "/nonexistent" } },
      })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", error: "File not found" },
      })

      expect(state.streaming.tools.get("tool-1")?.state).toBe("error")
      expect(state.streaming.tools.get("tool-1")?.error).toBe("File not found")
      expect(state.streaming.tools.get("tool-1")?.output).toBeUndefined()
    })

    it("continues processing after tool error", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "bad" } },
      })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", error: "Failed" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-2", name: "bash", input: { command: "good" } },
      })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-2", output: "Success" },
      })

      expect(state.streaming.tools.get("tool-1")?.state).toBe("error")
      expect(state.streaming.tools.get("tool-2")?.state).toBe("completed")
    })

    it("handles multiple concurrent tool errors", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "read", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-2", name: "write", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-3", name: "bash", input: {} },
      })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", error: "Read failed" },
      })
      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-2", error: "Write failed" },
      })
      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-3", error: "Bash failed" },
      })

      expect(state.streaming.tools.get("tool-1")?.state).toBe("error")
      expect(state.streaming.tools.get("tool-2")?.state).toBe("error")
      expect(state.streaming.tools.get("tool-3")?.state).toBe("error")
    })
  })

  describe("Message state transitions", () => {
    it("marks message as complete", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Done" })
      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages[0].complete).toBe(true)
    })

    it("creates message with correct role", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Hello" })
      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages[0].role).toBe("assistant")
    })

    it("assigns correct message ID", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Test" })
      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "custom-msg-id-123" },
      })

      expect(state.messages[0].id).toBe("custom-msg-id-123")
    })

    it("orders message parts correctly", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Before tool. " })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", output: "tool output" },
      })

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages[0].parts.length).toBe(2)
      expect(state.messages[0].parts[0].type).toBe("text")
      expect(state.messages[0].parts[0].content).toBe("Before tool. ")
      expect(state.messages[0].parts[1].type).toBe("tool")
    })

    it("handles message with multiple tool parts", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "read", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", output: "content1" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-2", name: "write", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-2", output: "content2" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Both tools completed" })

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      const toolParts = state.messages[0].parts.filter((p) => p.type === "tool")
      expect(toolParts.length).toBe(2)
    })

    it("starts fresh streaming state after message completion", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "First" })
      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.streaming.text).toBe("")
      expect(state.streaming.tools.size).toBe(0)
      expect(state.streaming.tasks.size).toBe(0)

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Second" })

      expect(state.streaming.text).toBe("Second")
      expect(state.messages.length).toBe(1)
    })
  })
})
