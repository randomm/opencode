import { describe, expect, test, mock } from "bun:test"
import type { SessionState, UIMode } from "../../../../src/cli/ink/state/types"
import type { Action } from "../../../../src/cli/ink/state/reducer"

describe("cli.ink.commands.handlers", () => {
  const mockDispatch = mock((_action: Action) => {})
  const mockSetUIMode = mock((_mode: UIMode) => {})
  const mockSession: SessionState = {
    id: "test-session",
    agent: "build",
    model: "gpt-4",
  }

  const createContext = () => ({
    dispatch: mockDispatch,
    session: mockSession,
    setUIMode: mockSetUIMode,
  })

  describe("help handler", () => {
    test("executes without error", async () => {
      const { helpHandler } = await import("../../../../src/cli/ink/commands/handlers/help")
      const context = createContext()
      await helpHandler([], context)
    })
  })

  describe("clear handler", () => {
    test("dispatches CLEAR_STREAMING action", async () => {
      const { clearHandler } = await import("../../../../src/cli/ink/commands/handlers/clear")
      const context = createContext()
      await clearHandler([], context)
      expect(mockDispatch).toHaveBeenCalledWith({ type: "CLEAR_STREAMING" })
    })
  })

  describe("quit handler", () => {
    test("exits process", async () => {
      const { quitHandler } = await import("../../../../src/cli/ink/commands/handlers/quit")
      const mockExit = mock(() => {})
      const originalExit = process.exit
      process.exit = mockExit as never

      const context = createContext()
      await quitHandler([], context)
      expect(mockExit).toHaveBeenCalledWith(0)

      process.exit = originalExit
    })
  })

  describe("compact handler", () => {
    test("executes without error", async () => {
      const { compactHandler } = await import("../../../../src/cli/ink/commands/handlers/compact")
      const context = createContext()
      await compactHandler([], context)
    })
  })

  describe("new session handler", () => {
    test("executes without error", async () => {
      const { newSessionHandler } = await import("../../../../src/cli/ink/commands/handlers/session")
      const context = createContext()
      await newSessionHandler([], context)
    })
  })
})
