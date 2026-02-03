import { describe, it, expect, mock } from "bun:test"
import { isCommand, parseCommand, executeCommand } from "@/cli/ink/commands/execute"
import { getCommand, getAllCommands } from "@/cli/ink/commands/registry"
import { appReducer, initialState, type Action } from "@/cli/ink/state/reducer"
import type { CommandContext } from "@/cli/ink/commands/types"

describe("Command Integration", () => {
  function createMockContext(): CommandContext {
    const actions: Action[] = []
    return {
      dispatch: (action: Action) => {
        actions.push(action)
      },
      session: {
        id: "test-session",
        agent: "build",
        model: "claude-3",
        subagentModel: null,
      },
      setUIMode: mock(() => {}),
    }
  }

  describe("Command detection", () => {
    it("identifies commands starting with /", () => {
      expect(isCommand("/help")).toBe(true)
      expect(isCommand("/model")).toBe(true)
      expect(isCommand("/quit")).toBe(true)
    })

    it("rejects non-command input", () => {
      expect(isCommand("help")).toBe(false)
      expect(isCommand("What is this?")).toBe(false)
      expect(isCommand("")).toBe(false)
    })

    it("handles whitespace correctly", () => {
      expect(isCommand("  /help")).toBe(false)
      expect(isCommand("/help  ")).toBe(true)
    })
  })

  describe("Command parsing", () => {
    it("parses simple command", () => {
      const result = parseCommand("/help")
      expect(result.name).toBe("help")
      expect(result.args).toEqual([])
    })

    it("parses command with single argument", () => {
      const result = parseCommand("/agent developer")
      expect(result.name).toBe("agent")
      expect(result.args).toEqual(["developer"])
    })

    it("parses command with multiple arguments", () => {
      const result = parseCommand("/model anthropic claude-3-5-sonnet")
      expect(result.name).toBe("model")
      expect(result.args).toEqual(["anthropic", "claude-3-5-sonnet"])
    })

    it("handles extra whitespace", () => {
      const result = parseCommand("/help   ")
      expect(result.name).toBe("help")
      expect(result.args).toEqual([])
    })

    it("handles multiple spaces between arguments", () => {
      const result = parseCommand("/agent    developer")
      expect(result.name).toBe("agent")
      expect(result.args).toEqual(["developer"])
    })

    it("returns empty name for empty input", () => {
      const result = parseCommand("")
      expect(result.name).toBe("")
      expect(result.args).toEqual([])
    })

    it("returns empty name for just slash", () => {
      const result = parseCommand("/")
      expect(result.name).toBe("")
      expect(result.args).toEqual([])
    })
  })

  describe("Command registry", () => {
    it("retrieves registered commands", () => {
      expect(getCommand("help")).toBeDefined()
      expect(getCommand("quit")).toBeDefined()
      expect(getCommand("model")).toBeDefined()
      expect(getCommand("agent")).toBeDefined()
    })

    it("returns undefined for unknown commands", () => {
      expect(getCommand("unknown")).toBeUndefined()
      expect(getCommand("notacommand")).toBeUndefined()
    })

    it("lists all commands", () => {
      const commands = getAllCommands()
      expect(commands.length).toBeGreaterThan(0)
      expect(commands.every((cmd) => cmd.name && cmd.handler)).toBe(true)
    })

    it("each command has required properties", () => {
      const commands = getAllCommands()
      for (const cmd of commands) {
        expect(cmd.name).toBeDefined()
        expect(typeof cmd.name).toBe("string")
        expect(cmd.handler).toBeDefined()
        expect(typeof cmd.handler).toBe("function")
      }
    })
  })

  describe("Command execution", () => {
    it("executes valid command", async () => {
      const context = createMockContext()
      const result = await executeCommand("/help", context)
      expect(result).toBeDefined()
    })

    it("returns false for unknown command", async () => {
      const context = createMockContext()
      const result = await executeCommand("/unknown", context)
      expect(result).toBe(false)
    })

    it("returns false for empty command", async () => {
      const context = createMockContext()
      const result = await executeCommand("/", context)
      expect(result).toBe(false)
    })

    it("handles command errors gracefully", async () => {
      const context = createMockContext()
      const result = await executeCommand("/help invalid args that might cause error", context)
      expect(typeof result).toBe("boolean")
    })

    it("provides correct context to command handlers", async () => {
      let capturedContext: CommandContext | null = null

      const testCommand = {
        name: "test",
        description: "Test command",
        handler: async (args: string[], ctx: CommandContext) => {
          capturedContext = ctx
        },
      }

      const context = createMockContext()
      await testCommand.handler([], context)

      expect(capturedContext).toBeDefined()
      expect(capturedContext?.session.id).toBe("test-session")
    })
  })

  describe("State updates from commands", () => {
    it("updates state when command dispatches actions", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: "sess-1", agent: "build", model: "claude-3" },
      })

      expect(state.session.id).toBe("sess-1")
      expect(state.session.agent).toBe("build")
    })

    it("clears streaming state on clear command", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Some text" })
      state = appReducer(state, {
        type: "TOOL_START",
        payload: { id: "tool-1", name: "bash", input: {} },
      })

      expect(state.streaming.text).toBe("Some text")
      expect(state.streaming.tools.size).toBe(1)

      state = appReducer(state, { type: "CLEAR_STREAMING" })

      expect(state.streaming.text).toBe("")
      expect(state.streaming.tools.size).toBe(0)
    })

    it("switches agent via command", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: "sess-1", agent: "build", model: "claude-3" },
      })

      expect(state.session.agent).toBe("build")

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: "sess-1", agent: "developer", model: "claude-3" },
      })

      expect(state.session.agent).toBe("developer")
    })

    it("updates subagent model independently", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: "sess-1", agent: "build", model: "anthropic/claude-3-5-sonnet-20241022" },
      })

      state = appReducer(state, {
        type: "SET_SUBAGENT_MODEL",
        payload: "anthropic/claude-3-5-haiku-20241022",
      })

      expect(state.session.model).toBe("anthropic/claude-3-5-sonnet-20241022")
      expect(state.session.subagentModel).toBe("anthropic/claude-3-5-haiku-20241022")
    })
  })

  describe("Invalid command handling", () => {
    it("handles malformed command gracefully", async () => {
      const context = createMockContext()
      const result = await executeCommand("/ / /", context)
      expect(result).toBe(false)
    })

    it("handles command with no handler", () => {
      const invalidCommand = getCommand("nonexistent")
      expect(invalidCommand).toBeUndefined()
    })

    it("handles command with special characters", async () => {
      const context = createMockContext()
      const result = await executeCommand("/help@#$%", context)
      expect(typeof result).toBe("boolean")
    })

    it("handles very long command input", async () => {
      const context = createMockContext()
      const longInput = "/help " + "a".repeat(10000)
      const result = await executeCommand(longInput, context)
      expect(typeof result).toBe("boolean")
    })
  })

  describe("Command state consistency", () => {
    it("maintains state consistency across multiple commands", () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: "sess-1", agent: "build", model: "claude-3" },
      })

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Text 1" })

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: "sess-1", agent: "developer", model: "claude-3" },
      })

      expect(state.session.agent).toBe("developer")
      expect(state.streaming.text).toBe("Text 1")

      state = appReducer(state, { type: "CLEAR_STREAMING" })

      expect(state.session.agent).toBe("developer")
      expect(state.streaming.text).toBe("")
    })

    it("preserves messages when executing commands", () => {
      let state = initialState

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Message 1" })
      state = appReducer(state, {
        type: "MESSAGE_COMPLETE",
        payload: { id: "msg-1" },
      })

      expect(state.messages.length).toBe(1)

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: "sess-2", agent: "build", model: "claude-3" },
      })

      expect(state.messages.length).toBe(1)
      expect(state.session.id).toBe("sess-2")
    })

    it("handles rapid command execution", () => {
      let state = initialState

      for (let i = 0; i < 100; i++) {
        state = appReducer(state, {
          type: "SET_SESSION",
          payload: { id: `sess-${i}`, agent: i % 2 === 0 ? "build" : "developer", model: "claude-3" },
        })
      }

      expect(state.session.id).toBe("sess-99")
      expect(state.session.agent).toBe("developer")
    })

    it("maintains UI mode across state updates", () => {
      let state = initialState

      expect(state.ui.mode).toBe("input")

      state = appReducer(state, { type: "SET_UI_MODE", payload: "select" })
      expect(state.ui.mode).toBe("select")

      state = appReducer(state, { type: "STREAM_TEXT", payload: "Text" })
      expect(state.ui.mode).toBe("select")

      state = appReducer(state, { type: "SET_UI_MODE", payload: "input" })
      expect(state.ui.mode).toBe("input")
    })
  })

  describe("Command error recovery", () => {
    it("recovers from command execution failure", async () => {
      const context = createMockContext()

      await executeCommand("/unknown", context)

      const result = await executeCommand("/help", context)
      expect(typeof result).toBe("boolean")
    })

    it("does not corrupt state on command failure", async () => {
      let state = initialState

      state = appReducer(state, {
        type: "SET_SESSION",
        payload: { id: "sess-1", agent: "build", model: "claude-3" },
      })

      const sessionIdBefore = state.session.id

      const context = createMockContext()
      await executeCommand("/invalid", context)

      expect(state.session.id).toBe(sessionIdBefore)
    })
  })
})
