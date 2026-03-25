import { describe, test, expect } from "bun:test"
import {
  openaiCompatibleErrorDataSchema,
  defaultOpenAICompatibleErrorStructure,
  type OpenAICompatibleErrorData,
} from "../../src/provider/sdk/copilot/openai-compatible-error"

describe("Cerebras Error Schema Integration", () => {
  test("cerebras custom loader uses defaultOpenAICompatibleErrorStructure", () => {
    // Verify that the error schema accepts standard format
    const standardError = {
      error: {
        message: "Invalid request",
        type: "invalid_request_error",
        param: "messages",
        code: "invalid_input",
      },
    }

    const standardResult = openaiCompatibleErrorDataSchema.safeParse(standardError)
    expect(standardResult.success).toBe(true)
    if (standardResult.success) {
      const msg = defaultOpenAICompatibleErrorStructure.errorToMessage(standardResult.data)
      expect(msg).toBe("Invalid request")
    }
  })

  test("cerebras custom loader handles status_code-wrapped error responses", () => {
    // Verify that cerebras responses like {status_code:500, error:{message:"..."}} are accepted
    const wrappedError = {
      status_code: 500,
      error: {
        message: "Internal server error",
        type: "server_error",
        param: "",
        code: "500",
        id: "err-123",
      },
    }

    const wrappedResult = openaiCompatibleErrorDataSchema.safeParse(wrappedError)
    expect(wrappedResult.success).toBe(true)
    if (wrappedResult.success) {
      const msg = defaultOpenAICompatibleErrorStructure.errorToMessage(wrappedResult.data)
      expect(msg).toBe("Internal server error")
    }
  })

  test("cerebras errorToMessage extracts message from standard format", () => {
    const standard = {
      error: {
        message: "Invalid input",
        type: "invalid_request_error",
        param: null,
        code: null,
      },
    } satisfies OpenAICompatibleErrorData

    const msg = defaultOpenAICompatibleErrorStructure.errorToMessage(standard)
    expect(msg).toBe("Invalid input")
  })

  test("cerebras errorToMessage extracts message from wrapped format", () => {
    const wrapped = {
      status_code: 500,
      error: {
        message: "Server error",
        type: "server_error",
        param: "",
        code: "500",
        id: "req-456",
      },
    } as OpenAICompatibleErrorData

    const msg = defaultOpenAICompatibleErrorStructure.errorToMessage(wrapped)
    expect(msg).toBe("Server error")
  })

  test("cerebras schemas allow extra fields in both formats", () => {
    // Standard format with extra fields
    const standardExtra = {
      error: {
        message: "Error",
        type: "error",
        param: null,
        code: null,
        request_id: "req-123",
        timestamp: "2024-01-01T00:00:00Z",
      },
    }

    expect(
      openaiCompatibleErrorDataSchema.safeParse(standardExtra).success,
    ).toBe(true)

    // Wrapped format with extra fields
    const wrappedExtra = {
      status_code: 500,
      error: {
        message: "Error",
        type: "server_error",
        param: "",
        code: "500",
        id: "err-123",
        trace_id: "trace-456",
        timestamp: "2024-01-01T00:00:00Z",
      },
    }

    expect(
      openaiCompatibleErrorDataSchema.safeParse(wrappedExtra).success,
    ).toBe(true)
  })
})