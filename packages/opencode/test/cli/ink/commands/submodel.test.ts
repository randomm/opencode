import { describe, expect, test, mock } from "bun:test"
import type { SessionState, UIMode } from "../../../../src/cli/ink/state/types"
import type { Action } from "../../../../src/cli/ink/state/reducer"

describe("cli.ink.commands.handlers.submodel", () => {
  const mockDispatch = mock((_action: Action) => {})
  const mockSetUIMode = mock((_mode: UIMode) => {})
  const mockSession: SessionState = {
    id: "test-session",
    agent: "build",
    model: "anthropic/claude-3-5-sonnet-20241022",
  }

  const createContext = () => ({
    dispatch: mockDispatch,
    session: mockSession,
    setUIMode: mockSetUIMode,
  })

  describe("submodelHandler", () => {
    test("sets subagent model with valid model format", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()

      await submodelHandler(["anthropic/claude-3-5-haiku-20241022"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SET_SUBAGENT_MODEL",
        payload: "anthropic/claude-3-5-haiku-20241022",
      })
    })

    test("accepts provider/model format", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()

      await submodelHandler(["openai/gpt-4"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SET_SUBAGENT_MODEL",
        payload: "openai/gpt-4",
      })
    })

    test("does not dispatch if no arguments provided", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler([], context)

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    test("rejects invalid model format without slash", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["invalid-model"], context)

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    test("rejects model with multiple slashes", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["provider/model/version"], context)

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    test("accepts model with hyphens and dots", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()

      await submodelHandler(["anthropic/claude-3.5-sonnet"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SET_SUBAGENT_MODEL",
        payload: "anthropic/claude-3.5-sonnet",
      })
    })

    test("rejects empty model name", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler([""], context)

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    test("rejects model with leading hyphen in provider", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["-provider/model"], context)

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    test("rejects model with leading hyphen in model name", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["provider/-model"], context)

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    test("rejects single character provider or model", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["a/b"], context)

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    test("accepts minimum valid format", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()

      await submodelHandler(["ab/cd"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SET_SUBAGENT_MODEL",
        payload: "ab/cd",
      })
    })
  })
})
