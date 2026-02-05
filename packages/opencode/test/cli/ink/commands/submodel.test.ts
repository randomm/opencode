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

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
    })

    test("rejects invalid model format without slash", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["invalid-model"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
    })

    test("rejects model with multiple slashes", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["provider/model/version"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
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

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
    })

    test("rejects model with leading hyphen in provider", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["-provider/model"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
    })

    test("rejects model with leading hyphen in model name", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["provider/-model"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
    })

    test("rejects single character provider or model", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["a/b"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
    })

    test("rejects single character model name", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["provider/a"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
    })

    test("rejects single digit model name", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["provider/1"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
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

    test("rejects model with trailing hyphen in provider", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["provider-/model"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
    })

    test("rejects model with trailing hyphen in model name", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      await submodelHandler(["provider/model-"], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
    })

    test("rejects model exceeding maximum length", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      const longProvider = "a".repeat(65)
      const longModel = "b".repeat(129)
      await submodelHandler([`${longProvider}/${longModel}`], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Model name too long.\n",
      })
    })

    test("accepts model at maximum length boundary", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()

      const provider = "a" + "b".repeat(62) + "c"
      const model = "x" + "y".repeat(126) + "z"
      await submodelHandler([`${provider}/${model}`], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "SET_SUBAGENT_MODEL",
        payload: `${provider}/${model}`,
      })
    })

    test("rejects provider exceeding 64 characters", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      const provider = "a" + "b".repeat(63) + "c"
      await submodelHandler([`${provider}/model`], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Provider or model name invalid.\n",
      })
    })

    test("rejects model name exceeding 128 characters", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      const model = "a" + "b".repeat(127) + "c"
      await submodelHandler([`provider/${model}`], context)

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Provider or model name invalid.\n",
      })
    })

    test("rejects malicious backtracking input without timeout", async () => {
      const { submodelHandler } = await import("../../../../src/cli/ink/commands/handlers/submodel")
      const context = createContext()
      mockDispatch.mockClear()

      const attack = "a" + "b-".repeat(50) + "!/model"
      const start = Date.now()
      await submodelHandler([attack], context)
      const duration = Date.now() - start

      expect(mockDispatch).toHaveBeenCalledWith({
        type: "STREAM_TEXT",
        payload: "Invalid model format. Use: /submodel provider/model-name\n",
      })
      expect(duration).toBeLessThan(100)
    })
  })
})
