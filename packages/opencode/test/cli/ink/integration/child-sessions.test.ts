import { describe, it, expect } from "bun:test"
import { appReducer, initialState, type Action } from "@/cli/ink/state/reducer"

describe("Child Session Event Handling", () => {
  const PARENT_SESSION = "session-parent-123"
  const CHILD_SESSION = "session-child-456"

  describe("Event buffering (events arrive before task metadata)", () => {
    it("buffers tool events for unknown session IDs gracefully", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: PARENT_SESSION, agent: "build", model: "claude-3" },
      })

      expect(state.session.id).toBe(PARENT_SESSION)
      expect(state.streaming.tools.size).toBe(0)
    })

    it("handles task start followed by tool events", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: PARENT_SESSION, agent: "build", model: "claude-3" },
      })

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Child task" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "test" } },
      })

      expect(state.streaming.tasks.has("task-1")).toBe(true)
      expect(state.streaming.tools.has("tool-1")).toBe(true)
    })

    it("ignores tool events for wrong session ID", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: PARENT_SESSION, agent: "build", model: "claude-3" },
      })

      const initialToolCount = state.streaming.tools.size

      expect(initialToolCount).toBe(0)
    })

    it("processes events in correct order when buffered", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: PARENT_SESSION, agent: "build", model: "claude-3" },
      })

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Process data" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "read", input: { path: "/data" } },
      })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", output: "data content" },
      })

      state = appReducer(state, {
        type: "TASK_END",
        payload: { id: "task-1" },
      })

      expect(state.streaming.tasks.get("task-1")?.state).toBe("completed")
      expect(state.streaming.tools.get("tool-1")?.state).toBe("completed")
    })
  })

  describe("Late-arriving events (events arrive after task completes)", () => {
    it("ignores tool updates for completed tasks", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Quick task" },
      })

      state = appReducer(state, {
        type: "TASK_END",
        payload: { id: "task-1" },
      })

      expect(state.streaming.tasks.get("task-1")?.state).toBe("completed")

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "late-tool", name: "bash", input: { command: "ls" } },
      })

      const toolState = state.streaming.tools.get("late-tool")
      expect(toolState).toBeDefined()
    })

    it("completes message even with late tool events", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Main task" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "build" } },
      })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", output: "built" },
      })

      state = appReducer(state, {
        type: "TASK_END",
        payload: { id: "task-1" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Done" })

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages.length).toBe(1)
      expect(state.streaming.tasks.size).toBe(0)
      expect(state.streaming.tools.size).toBe(0)
    })

    it("handles tool completion after task already completed", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Task" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "slow", input: {} },
      })

      state = appReducer(state, {
        type: "TASK_END",
        payload: { id: "task-1" },
      })

      expect(state.streaming.tasks.get("task-1")?.state).toBe("completed")
      expect(state.streaming.tools.get("tool-1")?.state).toBe("running")

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", output: "finally done" },
      })

      expect(state.streaming.tools.get("tool-1")?.state).toBe("completed")
    })
  })

  describe("Child session ID mapping", () => {
    it("associates tools with correct parent session", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: PARENT_SESSION, agent: "build", model: "claude-3" },
      })

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Delegated work" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "npm test" } },
      })

      expect(state.session.id).toBe(PARENT_SESSION)
      expect(state.streaming.tasks.has("task-1")).toBe(true)
      expect(state.streaming.tools.has("tool-1")).toBe(true)
    })

    it("tracks multiple tasks with different child sessions", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: PARENT_SESSION, agent: "build", model: "claude-3" },
      })

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Task A" },
      })

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-2", description: "Task B" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-a", name: "bash", input: { task: "A" } },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-b", name: "read", input: { task: "B" } },
      })

      expect(state.streaming.tasks.size).toBe(2)
      expect(state.streaming.tools.size).toBe(2)
      expect(state.streaming.tasks.get("task-1")?.state).toBe("running")
      expect(state.streaming.tasks.get("task-2")?.state).toBe("running")
    })

    it("completes each task independently", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Fast task" },
      })

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-2", description: "Slow task" },
      })

      state = appReducer(state, {
        type: "TASK_END",
        payload: { id: "task-1" },
      })

      expect(state.streaming.tasks.get("task-1")?.state).toBe("completed")
      expect(state.streaming.tasks.get("task-2")?.state).toBe("running")

      state = appReducer(state, {
        type: "TASK_END",
        payload: { id: "task-2" },
      })

      expect(state.streaming.tasks.get("task-2")?.state).toBe("completed")
    })

    it("handles nested task hierarchy", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "parent-task", description: "Parent task" },
      })

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "child-task", description: "Child task" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "nested-tool", name: "bash", input: { level: "child" } },
      })

      expect(state.streaming.tasks.size).toBe(2)
      expect(state.streaming.tools.size).toBe(1)

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "nested-tool", output: "done" },
      })

      state = appReducer(state, {
        type: "TASK_END",
        payload: { id: "child-task" },
      })

      expect(state.streaming.tasks.get("child-task")?.state).toBe("completed")
      expect(state.streaming.tasks.get("parent-task")?.state).toBe("running")
    })
  })

  describe("Event ordering consistency", () => {
    it("maintains correct state through mixed event sequence", () => {
      let state = initialState

      const events: Action[] = [
        { type: "TASK_START", payload: { id: "task-1", description: "Main" } },
        { type: "STREAM_TEXT", payload: "Starting... " },
        { type: "TOOL_START", payload: { id: "tool-1", name: "bash", input: {} } },
        { type: "STREAM_TEXT", payload: "Running tool... " },
        { type: "TOOL_END", payload: { id: "tool-1", output: "success" } },
        { type: "STREAM_TEXT", payload: "Done." },
        { type: "TASK_END", payload: { id: "task-1" } },
      ]

      for (const event of events) {
        state = appReducer(state, event)
      }

      expect(state.streaming.text).toBe("Starting... Running tool... Done.")
      expect(state.streaming.tasks.get("task-1")?.state).toBe("completed")
      expect(state.streaming.tools.get("tool-1")?.state).toBe("completed")
    })

    it("handles rapid task creation and completion", () => {
      let state = initialState

      for (let i = 0; i < 5; i++) {
        state = appReducer(state, {
          type: "TASK_START",
          payload: { id: `task-${i}`, description: `Task ${i}` },
        })

        state = appReducer(state, {
          type: "TOOL_START",
          payload: { id: `tool-${i}`, name: "test", input: { index: i } },
        })

        state = appReducer(state, {
          type: "TOOL_END",
          payload: { id: `tool-${i}`, output: `result-${i}` },
        })

        state = appReducer(state, {
          type: "TASK_END",
          payload: { id: `task-${i}` },
        })
      }

      expect(state.streaming.tasks.size).toBe(5)
      expect(state.streaming.tools.size).toBe(5)

      for (let i = 0; i < 5; i++) {
        expect(state.streaming.tasks.get(`task-${i}`)?.state).toBe("completed")
        expect(state.streaming.tools.get(`tool-${i}`)?.state).toBe("completed")
      }
    })

    it("preserves event integrity with concurrent updates", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "concurrent-task", description: "Concurrent work" },
      })

      const actions: Action[] = []
      for (let i = 0; i < 10; i++) {
        actions.push({ type: "STREAM_TEXT", payload: `${i} ` })
        actions.push({
          type: "TOOL_START",
          payload: { id: `tool-${i}`, name: "test", input: { i } },
        })
      }

      for (const action of actions) {
        state = appReducer(state, action)
      }

      expect(state.streaming.tools.size).toBe(10)
      expect(state.streaming.tasks.get("concurrent-task")?.state).toBe("running")

      const textNumbers = state.streaming.text
        .trim()
        .split(" ")
        .map((n) => parseInt(n))
      expect(textNumbers).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    })
  })
})
