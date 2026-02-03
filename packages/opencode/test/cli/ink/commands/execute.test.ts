import { describe, expect, test, mock } from "bun:test"
import { executeCommand, isCommand, parseCommand } from "../../../../src/cli/ink/commands/execute"
import type { Action } from "../../../../src/cli/ink/state/reducer"
import type { SessionState, UIMode } from "../../../../src/cli/ink/state/types"

describe("cli.ink.commands.execute", () => {
  describe("isCommand", () => {
    test("returns true for strings starting with /", () => {
      expect(isCommand("/help")).toBe(true)
      expect(isCommand("/agent")).toBe(true)
      expect(isCommand("/model gpt-4")).toBe(true)
    })

    test("returns false for strings not starting with /", () => {
      expect(isCommand("help")).toBe(false)
      expect(isCommand("test message")).toBe(false)
      expect(isCommand("")).toBe(false)
      expect(isCommand(" /help")).toBe(false)
    })
  })

  describe("parseCommand", () => {
    test("parses command without arguments", () => {
      const result = parseCommand("/help")
      expect(result.name).toBe("help")
      expect(result.args).toEqual([])
    })

    test("parses command with single argument", () => {
      const result = parseCommand("/agent build")
      expect(result.name).toBe("agent")
      expect(result.args).toEqual(["build"])
    })

    test("parses command with multiple arguments", () => {
      const result = parseCommand("/session abc-123")
      expect(result.name).toBe("session")
      expect(result.args).toEqual(["abc-123"])
    })

    test("handles extra whitespace", () => {
      const result = parseCommand("/model   gpt-4   ")
      expect(result.name).toBe("model")
      expect(result.args).toEqual(["gpt-4"])
    })

    test("strips leading slash", () => {
      const result = parseCommand("/clear")
      expect(result.name).toBe("clear")
      expect(result.args).toEqual([])
    })

    test("handles command with no slash", () => {
      const result = parseCommand("help")
      expect(result.name).toBe("help")
      expect(result.args).toEqual([])
    })

    test("handles empty command (just slash)", () => {
      const result = parseCommand("/")
      expect(result.name).toBe("")
      expect(result.args).toEqual([])
    })

    test("handles slash with only whitespace", () => {
      const result = parseCommand("/   ")
      expect(result.name).toBe("")
      expect(result.args).toEqual([])
    })
  })

  describe("executeCommand", () => {
    const mockDispatch = mock(() => {})
    const mockSession: SessionState = {
      id: "test-session",
      agent: "build",
      model: "gpt-4",
    }
    const mockSetUIMode = mock((_mode: UIMode) => {})

    test("executes valid command", async () => {
      const context = {
        dispatch: mockDispatch,
        session: mockSession,
        setUIMode: mockSetUIMode,
      }

      const result = await executeCommand("/help", context)
      expect(result).toBe(true)
    })

    test("returns false for invalid command", async () => {
      const context = {
        dispatch: mockDispatch,
        session: mockSession,
        setUIMode: mockSetUIMode,
      }

      const result = await executeCommand("/nonexistent", context)
      expect(result).toBe(false)
    })

    test("passes arguments to handler", async () => {
      const context = {
        dispatch: mockDispatch,
        session: mockSession,
        setUIMode: mockSetUIMode,
      }

      const result = await executeCommand("/agent build", context)
      expect(result).toBe(true)
    })
  })
})
