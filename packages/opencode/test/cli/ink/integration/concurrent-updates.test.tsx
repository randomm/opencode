/** @jsxImportSource react */
import { describe, it, expect, beforeEach } from "bun:test"
import { render } from "ink-testing-library"
import { useReducer } from "react"
import { Box, Text } from "ink"
import { appReducer, initialState, type Action } from "@/cli/ink/state/reducer"
import { StreamingProse } from "@/cli/ink/components/StreamingProse"
import { ToolDisplay } from "@/cli/ink/components/ToolDisplay"
import { TaskDisplay } from "@/cli/ink/components/TaskDisplay"

describe("Concurrent Updates Integration", () => {
  describe("Prose streaming + tool status updates simultaneously", () => {
    it("updates both prose and tool state without flicker", () => {
      const TestComponent = () => {
        const [state, dispatch] = useReducer(appReducer, initialState)

        return (
          <Box flexDirection="column">
            {state.streaming.text && <StreamingProse text={state.streaming.text} />}
            {Array.from(state.streaming.tools.values()).map((tool) => (
              <ToolDisplay key={tool.id} tool={tool} />
            ))}
          </Box>
        )
      }

      const { lastFrame, rerender } = render(<TestComponent />)

      expect(lastFrame()).toBeDefined()
      expect(lastFrame()).not.toContain("undefined")
    })

    it("handles rapid text streaming while tool transitions states", () => {
      let currentState = initialState

      currentState = appReducer(currentState, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "ls" } },
      })

      currentState = appReducer(currentState, {
        type: "STREAM_TEXT",
        payload: "Executing ",
      })

      currentState = appReducer(currentState, {
        type: "STREAM_TEXT",
        payload: "command ",
      })

      currentState = appReducer(currentState, {
        type: "STREAM_TEXT",
        payload: "now...",
      })

      currentState = appReducer(currentState, {
        type: "TOOL_END",
        payload: { id: "tool-1", output: "file1.txt\nfile2.txt" },
      })

      expect(currentState.streaming.text).toBe("Executing command now...")
      expect(currentState.streaming.tools.get("tool-1")?.state).toBe("completed")
      expect(currentState.streaming.tools.get("tool-1")?.output).toBe("file1.txt\nfile2.txt")
    })

    it("maintains tool state consistency during concurrent prose updates", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "read", input: { path: "/test.ts" } },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-2", name: "write", input: { path: "/out.ts" } },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Processing files..." })
      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", output: "content" },
      })
      state = appReducer(state, { type: "STREAM_TEXT", payload: " Done." })
      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-2", output: "written" },
      })

      expect(state.streaming.tools.get("tool-1")?.state).toBe("completed")
      expect(state.streaming.tools.get("tool-2")?.state).toBe("completed")
      expect(state.streaming.text).toBe("Processing files... Done.")
    })
  })

  describe("Multiple tools running in parallel", () => {
    it("tracks multiple concurrent tools independently", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "npm install" } },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-2", name: "read", input: { path: "/package.json" } },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-3", name: "write", input: { path: "/config.ts" } },
      })

      expect(state.streaming.tools.size).toBe(3)
      expect(state.streaming.tools.get("tool-1")?.state).toBe("running")
      expect(state.streaming.tools.get("tool-2")?.state).toBe("running")
      expect(state.streaming.tools.get("tool-3")?.state).toBe("running")

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-2", output: "package content" },
      })

      expect(state.streaming.tools.get("tool-1")?.state).toBe("running")
      expect(state.streaming.tools.get("tool-2")?.state).toBe("completed")
      expect(state.streaming.tools.get("tool-3")?.state).toBe("running")
    })

    it("completes tools in different order than started", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "a", name: "slow", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "b", name: "fast", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "c", name: "medium", input: {} },
      })

      state = appReducer(state, { type: "TOOL_END", payload: { id: "b", output: "fast done" } })
      state = appReducer(state, { type: "TOOL_END", payload: { id: "c", output: "medium done" } })
      state = appReducer(state, { type: "TOOL_END", payload: { id: "a", output: "slow done" } })

      expect(state.streaming.tools.get("a")?.state).toBe("completed")
      expect(state.streaming.tools.get("b")?.state).toBe("completed")
      expect(state.streaming.tools.get("c")?.state).toBe("completed")
    })

    it("handles tool errors while other tools continue", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "test" } },
      })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-2", name: "read", input: { path: "/file" } },
      })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", error: "Command failed" },
      })

      expect(state.streaming.tools.get("tool-1")?.state).toBe("error")
      expect(state.streaming.tools.get("tool-1")?.error).toBe("Command failed")
      expect(state.streaming.tools.get("tool-2")?.state).toBe("running")

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-2", output: "success" },
      })

      expect(state.streaming.tools.get("tool-2")?.state).toBe("completed")
    })
  })

  describe("Task with child tools + prose streaming", () => {
    it("tracks task and its child tools while streaming text", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Run tests" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Starting task..." })

      expect(state.streaming.tasks.has("task-1")).toBe(true)
      expect(state.streaming.tasks.get("task-1")?.state).toBe("running")
      expect(state.streaming.text).toBe("Starting task...")
    })

    it("maintains task state during concurrent tool and text updates", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Build project" },
      })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: { command: "npm build" } },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Building... " })

      state = appReducer(state, {
        type: "TOOL_END",
        payload: { id: "tool-1", output: "Build successful" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Complete." })

      state = appReducer(state, {
        type: "TASK_END",
        payload: { id: "task-1" },
      })

      expect(state.streaming.tasks.get("task-1")?.state).toBe("completed")
      expect(state.streaming.tools.get("tool-1")?.state).toBe("completed")
      expect(state.streaming.text).toBe("Building... Complete.")
    })

    it("prevents message completion while task is running", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Long running task" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Task in progress" })

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages.length).toBe(0)
      expect(state.streaming.text).toBe("Task in progress")
      expect(state.streaming.tasks.get("task-1")?.state).toBe("running")
    })

    it("allows message completion after task completes", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TASK_START",
        payload: { id: "task-1", description: "Quick task" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Done" })

      state = appReducer(state, {
        type: "TASK_END",
        payload: { id: "task-1" },
      })

      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages.length).toBe(1)
      expect(state.messages[0].parts[0].content).toBe("Done")
      expect(state.streaming.text).toBe("")
      expect(state.streaming.tasks.size).toBe(0)
    })
  })

  describe("Rapid state changes without flicker", () => {
    it("processes 100 rapid text updates without data loss", () => {
      let state = initialState

      for (let i = 0; i < 100; i++) {
        state = appReducer(state, { type: "STREAM_TEXT", payload: `${i} ` })
      }

      const expected = Array.from({ length: 100 }, (_, i) => `${i} `).join("")
      expect(state.streaming.text).toBe(expected)
    })

    it("handles rapid tool state transitions", () => {
      let state = initialState

      for (let i = 0; i < 10; i++) {
        state = appReducer(state, {
          type: "TOOL_START",
          payload: { id: `tool-${i}`, name: "test", input: { index: i } },
        })

        state = appReducer(state, {
          type: "TOOL_END",
          payload: { id: `tool-${i}`, output: `result-${i}` },
        })
      }

      expect(state.streaming.tools.size).toBe(10)
      for (let i = 0; i < 10; i++) {
        expect(state.streaming.tools.get(`tool-${i}`)?.state).toBe("completed")
      }
    })

    it("handles interleaved tool starts and completions", () => {
      let state = initialState

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "1", name: "a", input: {} },
      })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "2", name: "b", input: {} },
      })
      state = appReducer(state, { type: "TOOL_END", payload: { id: "1", output: "done" } })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "3", name: "c", input: {} },
      })
      state = appReducer(state, { type: "TOOL_END", payload: { id: "2", output: "done" } })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "4", name: "d", input: {} },
      })
      state = appReducer(state, { type: "TOOL_END", payload: { id: "3", output: "done" } })
      state = appReducer(state, { type: "TOOL_END", payload: { id: "4", output: "done" } })

      expect(state.streaming.tools.size).toBe(4)
      expect(Array.from(state.streaming.tools.values()).every((t) => t.state === "completed")).toBe(true)
    })

    it("maintains consistency with alternating text and tool updates", () => {
      let state = initialState

      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          state = appReducer(state, { type: "STREAM_TEXT", payload: `text-${i} ` })
        } else {
          state = appReducer(state, {
            type: "TOOL_START",
            payload: { id: `tool-${i}`, name: "test", input: {} },
          })
        }
      }

      const textParts = state.streaming.text.split(" ").filter(Boolean)
      expect(textParts.length).toBe(10)
      expect(state.streaming.tools.size).toBe(10)
    })
  })

  describe("Component rendering stability", () => {
    it("renders concurrent updates without throwing", () => {
      const TestComponent = () => {
        const [state, dispatch] = useReducer(appReducer, initialState)

        return (
          <Box flexDirection="column">
            {state.streaming.text && <Text>{state.streaming.text}</Text>}
            {Array.from(state.streaming.tools.values()).map((tool) => (
              <ToolDisplay key={tool.id} tool={tool} />
            ))}
            {Array.from(state.streaming.tasks.values()).map((task) => (
              <TaskDisplay key={task.id} task={task} agent={state.session.agent} />
            ))}
          </Box>
        )
      }

      const { lastFrame } = render(<TestComponent />)
      expect(lastFrame()).toBeDefined()
    })

    it("handles state transitions during component lifecycle", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Initial text" })

      const tools1 = new Map()
      tools1.set("tool-1", { id: "tool-1", name: "bash", state: "running", input: {} })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: {} },
      })

      expect(state.streaming.text).toBe("Initial text")
      expect(state.streaming.tools.has("tool-1")).toBe(true)

      state = appReducer(state, { type: "STREAM_TEXT", payload: " Updated" })

      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-2", name: "read", input: {} },
      })

      expect(state.streaming.text).toBe("Initial text Updated")
      expect(state.streaming.tools.size).toBe(2)
    })
  })
})
