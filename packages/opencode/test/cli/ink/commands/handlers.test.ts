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
    test("clears terminal screen and all state in TTY environment", async () => {
      const { clearHandler } = await import("../../../../src/cli/ink/commands/handlers/clear")
      const context = createContext()

      // Mock stdout.write to capture ANSI escape codes
      const originalWrite = process.stdout.write
      const originalIsTTY = process.stdout.isTTY
      const writeMock = mock(() => true)

      try {
        process.stdout.write = writeMock as never
        process.stdout.isTTY = true

        await clearHandler([], context)

        // Verify ANSI escape codes were written using terminal utilities
        // Should write clear.screen (\x1b[2J) + cursor.home (\x1b[H)
        expect(writeMock).toHaveBeenCalledWith("\x1b[2J\x1b[H")

        // Verify all state was cleared (messages + streaming)
        expect(mockDispatch).toHaveBeenCalledWith({ type: "CLEAR_ALL" })
      } finally {
        // Restore original write and isTTY (always executes)
        process.stdout.write = originalWrite
        process.stdout.isTTY = originalIsTTY
      }
    })

    test("skips ANSI codes in non-TTY environment but clears state", async () => {
      const { clearHandler } = await import("../../../../src/cli/ink/commands/handlers/clear")
      const context = createContext()

      // Mock stdout.write to verify ANSI codes are NOT written
      const originalWrite = process.stdout.write
      const originalIsTTY = process.stdout.isTTY
      const writeMock = mock(() => true)

      try {
        process.stdout.write = writeMock as never
        process.stdout.isTTY = false

        await clearHandler([], context)

        // Verify ANSI escape codes were NOT written in non-TTY
        expect(writeMock).not.toHaveBeenCalled()

        // Verify state was still cleared (this always happens)
        expect(mockDispatch).toHaveBeenCalledWith({ type: "CLEAR_ALL" })
      } finally {
        // Restore original write and isTTY (always executes)
        process.stdout.write = originalWrite
        process.stdout.isTTY = originalIsTTY
      }
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
