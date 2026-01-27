import { describe, it, expect } from "bun:test"
import { summarizeInput } from "../../../src/cli/lite/summary"

describe("summarizeInput", () => {
  describe("bash tool", () => {
    it("returns command truncated to 60 chars", () => {
      const input = { command: "git status" }
      expect(summarizeInput("bash", input)).toBe("git status")
    })

    it("truncates long commands to 60 chars", () => {
      const longCmd = "a".repeat(70)
      const input = { command: longCmd }
      expect(summarizeInput("bash", input).length).toBe(60)
    })
  })

  describe("read tool", () => {
    it("returns last two path segments", () => {
      const input = { filePath: "/Users/janni/git/opencode/src/cli/lite/index.ts" }
      expect(summarizeInput("read", input)).toBe("lite/index.ts")
    })

    it("handles single segment paths", () => {
      const input = { filePath: "index.ts" }
      expect(summarizeInput("read", input)).toBe("index.ts")
    })
  })

  describe("write and edit tools", () => {
    it("returns last two path segments for write", () => {
      const input = { filePath: "/Users/janni/src/file.ts" }
      expect(summarizeInput("write", input)).toBe("src/file.ts")
    })

    it("returns last two path segments for edit", () => {
      const input = { filePath: "/Users/janni/src/file.ts" }
      expect(summarizeInput("edit", input)).toBe("src/file.ts")
    })
  })

  describe("rg and grep tools", () => {
    it("returns pattern with quotes for rg without include", () => {
      const input = { pattern: "function.*export" }
      expect(summarizeInput("rg", input)).toBe('"function.*export"')
    })

    it("returns pattern and include filter", () => {
      const input = { pattern: "TODO", include: "*.ts" }
      expect(summarizeInput("rg", input)).toBe('"TODO" in *.ts')
    })

    it("truncates long patterns to 30 chars", () => {
      const longPattern = "a".repeat(40)
      const input = { pattern: longPattern }
      expect(summarizeInput("rg", input)).toBe(`"${"a".repeat(30)}"`)
    })

    it("works with grep tool", () => {
      const input = { pattern: "error", include: "*.log" }
      expect(summarizeInput("grep", input)).toBe('"error" in *.log')
    })
  })

  describe("glob tool", () => {
    it("returns pattern truncated to 60 chars", () => {
      const input = { pattern: "src/**/*.test.ts" }
      expect(summarizeInput("glob", input)).toBe("src/**/*.test.ts")
    })

    it("truncates long patterns", () => {
      const longPattern = "a".repeat(70)
      const input = { pattern: longPattern }
      expect(summarizeInput("glob", input).length).toBe(60)
    })
  })

  describe("task tool", () => {
    it("returns agent and description", () => {
      const input = { subagent_type: "developer", description: "Fix the WASM issue" }
      expect(summarizeInput("task", input)).toBe("@developer: Fix the WASM issue")
    })

    it("truncates description to 40 chars", () => {
      const longDesc = "a".repeat(50)
      const input = { subagent_type: "developer", description: longDesc }
      const result = summarizeInput("task", input)
      expect(result).toMatch(/^@developer:/)
      expect(result.length).toBe(52) // "@developer: " (12) + 40 chars
    })

    it("returns just description without agent", () => {
      const input = { description: "Some task" }
      expect(summarizeInput("task", input)).toBe("Some task")
    })
  })

  describe("todo tools", () => {
    it("returns 'todo list' for todowrite", () => {
      expect(summarizeInput("todowrite", {})).toBe("todo list")
    })

    it("returns 'todo list' for todoread", () => {
      expect(summarizeInput("todoread", {})).toBe("todo list")
    })
  })

  describe("fallback behavior", () => {
    it("returns first string value for unknown tool", () => {
      const input = { query: "search term", count: 5 }
      expect(summarizeInput("unknown", input)).toBe("search term")
    })

    it("truncates fallback to 60 chars", () => {
      const longStr = "a".repeat(70)
      const input = { data: longStr }
      expect(summarizeInput("unknown", input).length).toBe(60)
    })

    it("returns empty string when input is undefined", () => {
      expect(summarizeInput("bash", undefined)).toBe("")
    })

    it("returns empty string when no string values present", () => {
      const input = { count: 5, active: true }
      expect(summarizeInput("unknown", input)).toBe("")
    })
  })
})
