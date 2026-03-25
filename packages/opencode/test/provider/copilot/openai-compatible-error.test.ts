import { describe, test, expect } from "bun:test"
import {
  openaiCompatibleErrorDataSchema,
  defaultOpenAICompatibleErrorStructure,
  type OpenAICompatibleErrorData,
} from "../../../src/provider/sdk/copilot/openai-compatible-error"
import { z } from "zod/v4"

describe("openaiCompatibleErrorDataSchema", () => {
  test("accepts standard OpenAI error format", () => {
    const data = {
      error: {
        message: "Invalid request",
        type: "invalid_request_error",
        param: "messages",
        code: "invalid_input",
      },
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.error.message).toBe("Invalid request")
    }
  })

  test("accepts standard OpenAI error with optional fields as null", () => {
    const data = {
      error: {
        message: "Server error",
        type: null,
        param: null,
        code: null,
      },
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.error.message).toBe("Server error")
    }
  })

  test("accepts status_code-wrapped error format", () => {
    const data = {
      status_code: 500,
      error: {
        message: "Internal server error",
        type: "server_error",
        param: "",
        code: "",
        id: "err-123",
      },
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.error.message).toBe("Internal server error")
    }
  })

  test("accepts status_code-wrapped format with optional fields as null", () => {
    const data = {
      status_code: 503,
      error: {
        message: "Service unavailable",
        type: null,
        param: null,
        code: null,
        id: null,
      },
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.error.message).toBe("Service unavailable")
    }
  })

  test("accepts code as number in standard format", () => {
    const data = {
      error: {
        message: "Rate limit exceeded",
        type: "rate_limit_error",
        param: null,
        code: 429,
      },
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test("accepts code as number in status_code-wrapped format", () => {
    const data = {
      status_code: 500,
      error: {
        message: "Error",
        type: "server_error",
        param: "",
        code: 5000,
        id: "",
      },
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test("allows extra unknown fields in error object", () => {
    const data = {
      error: {
        message: "Invalid request",
        type: "invalid_request_error",
        param: null,
        code: null,
        timestamp: "2024-01-01T00:00:00Z",
        request_id: "req-abc123",
      },
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test("allows extra unknown fields in status_code-wrapped format", () => {
    const data = {
      status_code: 500,
      error: {
        message: "Internal server error",
        type: "server_error",
        param: "",
        code: "",
        id: "err-123",
        trace_id: "trace-456",
        timestamp: "2024-01-01T00:00:00Z",
      },
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test("rejects missing message field", () => {
    const data = {
      error: {
        type: "invalid_request_error",
      },
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test("rejects error object missing entirely", () => {
    const data = {
      status: "error",
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test("rejects neither standard nor wrapped format", () => {
    const data = {
      errorMessage: "Something went wrong",
    }

    const result = openaiCompatibleErrorDataSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test("accepts param as any type in standard format", () => {
    const data1 = {
      error: {
        message: "Error",
        type: "error",
        param: "string_param",
        code: null,
      },
    }
    const data2 = {
      error: {
        message: "Error",
        type: "error",
        param: 42,
        code: null,
      },
    }
    const data3 = {
      error: {
        message: "Error",
        type: "error",
        param: { nested: "object" },
        code: null,
      },
    }

    expect(openaiCompatibleErrorDataSchema.safeParse(data1).success).toBe(true)
    expect(openaiCompatibleErrorDataSchema.safeParse(data2).success).toBe(true)
    expect(openaiCompatibleErrorDataSchema.safeParse(data3).success).toBe(true)
  })
})

describe("defaultOpenAICompatibleErrorStructure.errorToMessage", () => {
  test("extracts message from standard error format", () => {
    const data: OpenAICompatibleErrorData = {
      error: {
        message: "Invalid input",
        type: "invalid_request_error",
        param: null,
        code: null,
      },
    }

    const msg = defaultOpenAICompatibleErrorStructure.errorToMessage(data)
    expect(msg).toBe("Invalid input")
  })

  test("extracts message from status_code-wrapped format", () => {
    const data: OpenAICompatibleErrorData = {
      status_code: 500,
      error: {
        message: "Internal server error",
        type: "server_error",
        param: "",
        code: "",
        id: "err-123",
      },
    } as OpenAICompatibleErrorData

    const msg = defaultOpenAICompatibleErrorStructure.errorToMessage(data)
    expect(msg).toBe("Internal server error")
  })

  test("handles empty message string", () => {
    const data: OpenAICompatibleErrorData = {
      error: {
        message: "",
        type: null,
        param: null,
        code: null,
      },
    }

    const msg = defaultOpenAICompatibleErrorStructure.errorToMessage(data)
    expect(msg).toBe("")
  })
})
