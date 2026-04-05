import { describe, test, expect } from "bun:test"
import { z } from "zod"

// Replicate the schema from tool.ts to test the fixes
const verdictParamsSchema = z.object({
  taskId: z.string(),
  command: z.enum(["verdict"]),
  verdict: z.enum(["APPROVED", "ISSUES_FOUND", "CRITICAL_ISSUES_FOUND"]),
  verdictSummary: z.string().optional(),
  verdictIssues: z.array(z.object({
    location: z.string(),
    severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    fix: z.string(),
  })).optional(),
  verdictScenarios: z.array(z.object({
    scenario: z.string().max(500),
    result: z.string().max(500),
  })).max(50).optional(),
  // This is the FIXED version - using .nullish() instead of .nullable().optional()
  coverageLevel: z.enum(["critical", "high", "medium", "low"]).nullish(),
})

describe("adversarial schema fixes", () => {

  describe("coverageLevel schema validation", () => {
    test("accepts valid enum values", () => {
      const result = verdictParamsSchema.safeParse({
        taskId: "test-task-123",
        command: "verdict",
        verdict: "APPROVED",
        verdictSummary: "All good",
        verdictIssues: [],
        verdictScenarios: [],
        coverageLevel: "critical",
      })
      expect(result.success).toBe(true)
      expect(result.data?.coverageLevel).toBe("critical")
    })

    test("accepts null value", () => {
      const result = verdictParamsSchema.safeParse({
        taskId: "test-task-123",
        command: "verdict",
        verdict: "APPROVED",
        verdictSummary: "All good",
        verdictIssues: [],
        verdictScenarios: [],
        coverageLevel: null,
      })
      expect(result.success).toBe(true)
      expect(result.data?.coverageLevel).toBe(null)
    })

    test("accepts undefined (not provided)", () => {
      const result = verdictParamsSchema.safeParse({
        taskId: "test-task-123",
        command: "verdict",
        verdict: "APPROVED",
        verdictSummary: "All good",
        verdictIssues: [],
        verdictScenarios: [],
        // coverageLevel not provided
      })
      expect(result.success).toBe(true)
      expect(result.data?.coverageLevel).toBe(undefined)
    })

    test("REJECTS invalid string values", () => {
      const invalidInputs = [
        "CRITICAL", // wrong case
        "invalid",
        "🔥",
        "high-medium",
        "",
      ]

      for (const input of invalidInputs) {
        const result = verdictParamsSchema.safeParse({
          taskId: "test-task-123",
          command: "verdict",
          verdict: "APPROVED",
          verdictSummary: "All good",
          verdictIssues: [],
          verdictScenarios: [],
          coverageLevel: input as any,
        })
        expect(result.success).toBe(false)
      }
    })
  })

  describe("testedScenarios schema validation", () => {
    test("accepts empty array", () => {
      const result = verdictParamsSchema.safeParse({
        taskId: "test-task-123",
        command: "verdict",
        verdict: "APPROVED",
        verdictSummary: "All good",
        verdictIssues: [],
        verdictScenarios: [],
      })
      expect(result.success).toBe(true)
    })

    test("accepts array up to 50 items", () => {
      const scenarios = Array.from({ length: 50 }, (_, i) => ({
        scenario: `Test scenario ${i}`,
        result: `Result ${i}`,
      }))

      const result = verdictParamsSchema.safeParse({
        taskId: "test-task-123",
        command: "verdict",
        verdict: "APPROVED",
        verdictSummary: "All good",
        verdictIssues: [],
        verdictScenarios: scenarios,
      })
      expect(result.success).toBe(true)
      expect(result.data?.verdictScenarios).toHaveLength(50)
    })

    test("REJECTS array with 51 items", () => {
      const scenarios = Array.from({ length: 51 }, (_, i) => ({
        scenario: `Test scenario ${i}`,
        result: `Result ${i}`,
      }))

      const result = verdictParamsSchema.safeParse({
        taskId: "test-task-123",
        command: "verdict",
        verdict: "APPROVED",
        verdictSummary: "All good",
        verdictIssues: [],
        verdictScenarios: scenarios,
      })
      expect(result.success).toBe(false)
    })

    test("rejects strings exceeding max length", () => {
      const result = verdictParamsSchema.safeParse({
        taskId: "test-task-123",
        command: "verdict",
        verdict: "APPROVED",
        verdictSummary: "All good",
        verdictIssues: [],
        verdictScenarios: [{
          scenario: "a".repeat(501), // exceeds 500
          result: "valid result",
        }],
      })
      expect(result.success).toBe(false)
    })
  })
})