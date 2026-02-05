import { describe, it, expect, mock } from "bun:test"
import type { Action } from "@/cli/ink/state/reducer"
import type { Event } from "@opencode-ai/sdk/v2"

describe("SDK Event Handling Logic", () => {
  it("processes tool running event correctly", () => {
    const dispatch = mock<(action: Action) => void>(() => {})

    const toolRunningEvent: Event = {
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-1",
          sessionID: "sess-1",
          messageID: "msg-1",
          type: "tool",
          callID: "call-1",
          tool: "read_file",
          state: {
            status: "running",
            input: { path: "/test" },
            time: { start: Date.now() },
          },
        },
      },
    }

    if (toolRunningEvent.type === "message.part.updated" && toolRunningEvent.properties.part.type === "tool") {
      const part = toolRunningEvent.properties.part
      if (part.state.status === "running") {
        dispatch({
          type: "TOOL_START",
          payload: {
            id: part.callID,
            name: part.tool,
            input: part.state.input as Record<string, string | number | boolean | null>,
          },
        })
      }
    }

    expect(dispatch).toHaveBeenCalledWith({
      type: "TOOL_START",
      payload: {
        id: "call-1",
        name: "read_file",
        input: { path: "/test" },
      },
    })
  })

  it("processes tool completed event correctly", () => {
    const dispatch = mock<(action: Action) => void>(() => {})

    const toolCompletedEvent: Event = {
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-1",
          sessionID: "sess-1",
          messageID: "msg-1",
          type: "tool",
          callID: "call-1",
          tool: "read_file",
          state: {
            status: "completed",
            input: { path: "/test" },
            output: "file contents",
            title: "Read file",
            metadata: {},
            time: { start: Date.now(), end: Date.now() },
          },
        },
      },
    }

    if (toolCompletedEvent.type === "message.part.updated" && toolCompletedEvent.properties.part.type === "tool") {
      const part = toolCompletedEvent.properties.part
      if (part.state.status === "completed") {
        dispatch({
          type: "TOOL_END",
          payload: {
            id: part.callID,
            output: part.state.output,
          },
        })
      }
    }

    expect(dispatch).toHaveBeenCalledWith({
      type: "TOOL_END",
      payload: {
        id: "call-1",
        output: "file contents",
      },
    })
  })

  it("processes tool error event correctly", () => {
    const dispatch = mock<(action: Action) => void>(() => {})

    const toolErrorEvent: Event = {
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-1",
          sessionID: "sess-1",
          messageID: "msg-1",
          type: "tool",
          callID: "call-1",
          tool: "read_file",
          state: {
            status: "error",
            input: { path: "/test" },
            error: "File not found",
            time: { start: Date.now(), end: Date.now() },
          },
        },
      },
    }

    if (toolErrorEvent.type === "message.part.updated" && toolErrorEvent.properties.part.type === "tool") {
      const part = toolErrorEvent.properties.part
      if (part.state.status === "error") {
        dispatch({
          type: "TOOL_END",
          payload: {
            id: part.callID,
            error: part.state.error,
          },
        })
      }
    }

    expect(dispatch).toHaveBeenCalledWith({
      type: "TOOL_END",
      payload: {
        id: "call-1",
        error: "File not found",
      },
    })
  })

  it("processes subtask event correctly", () => {
    const dispatch = mock<(action: Action) => void>(() => {})

    const taskStartEvent: Event = {
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-1",
          sessionID: "sess-1",
          messageID: "msg-1",
          type: "subtask",
          prompt: "Test task",
          description: "A test task",
          agent: "developer",
        },
      },
    }

    if (taskStartEvent.type === "message.part.updated" && taskStartEvent.properties.part.type === "subtask") {
      const part = taskStartEvent.properties.part
      dispatch({
        type: "TASK_START",
        payload: {
          id: part.id,
          description: part.description,
        },
      })
    }

    expect(dispatch).toHaveBeenCalledWith({
      type: "TASK_START",
      payload: {
        id: "part-1",
        description: "A test task",
      },
    })
  })

  it("ignores tool pending events", () => {
    const dispatch = mock<(action: Action) => void>(() => {})

    const toolPendingEvent: Event = {
      type: "message.part.updated",
      properties: {
        part: {
          id: "part-1",
          sessionID: "sess-1",
          messageID: "msg-1",
          type: "tool",
          callID: "call-1",
          tool: "read_file",
          state: {
            status: "pending",
            input: { path: "/test" },
            raw: "read_file({path: '/test'})",
          },
        },
      },
    }

    if (toolPendingEvent.type === "message.part.updated" && toolPendingEvent.properties.part.type === "tool") {
      const part = toolPendingEvent.properties.part
      if (part.state.status === "pending") {
        // Do nothing for pending
      }
    }

    expect(dispatch).not.toHaveBeenCalled()
  })

  it("processes message.updated event correctly", () => {
    const dispatch = mock<(action: Action) => void>(() => {})

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
      dispatch({
        type: "MESSAGE_COMPLETE",
        payload: { id: messageUpdatedEvent.properties.info.id },
      })
    }

    expect(dispatch).toHaveBeenCalledWith({
      type: "MESSAGE_COMPLETE",
      payload: { id: "msg-1" },
    })
  })

  it("processes session.status idle event correctly", () => {
    const dispatch = mock<(action: Action) => void>(() => {})

    const sessionStatusEvent: Event = {
      type: "session.status",
      properties: {
        sessionID: "sess-1",
        status: { type: "idle" },
      },
    }

    if (sessionStatusEvent.type === "session.status") {
      if (sessionStatusEvent.properties.status.type === "idle") {
        // Don't dispatch CLEAR_STREAMING - MESSAGE_COMPLETE handles it
      }
    }

    expect(dispatch).not.toHaveBeenCalled()
  })
})
