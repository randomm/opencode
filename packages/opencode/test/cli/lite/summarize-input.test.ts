import { describe, test, expect } from "bun:test"
import { summarizeInput } from "../../../src/cli/lite/summary"

describe("summarizeInput", () => {
  describe("bash tool", () => {
    test("returns command truncated to 60 chars", () => {
      const input = { command: "git status" }
      expect(summarizeInput("bash", input)).toBe("git status")
    })

    test("truncates very long commands to 60 chars", () => {
      const longCmd = "a".repeat(70)
      const input = { command: longCmd }
      const result = summarizeInput("bash", input)
      expect(result).toBe("a".repeat(60))
      expect(result.length).toBe(60)
    })

    test("handles missing command key", () => {
      const input = {}
      expect(summarizeInput("bash", input)).toBe("")
    })
  })

  describe("read tool", () => {
    test("returns last two path segments", () => {
      const input = { filePath: "/Users/janni/git/opencode/src/cli/lite/index.ts" }
      expect(summarizeInput("read", input)).toBe("lite/index.ts")
    })

    test("handles single segment paths", () => {
      const input = { filePath: "index.ts" }
      expect(summarizeInput("read", input)).toBe("index.ts")
    })

    test("handles deeply nested paths - returns only last 2 segments", () => {
      const input = { filePath: "/a/b/c/d/e/f/g/h/i/j/file.ts" }
      expect(summarizeInput("read", input)).toBe("j/file.ts")
    })

    test("handles paths with trailing slash", () => {
      const input = { filePath: "src/" }
      expect(summarizeInput("read", input)).toBe("src/")
    })
  })

  describe("write and edit tools", () => {
    test("write returns last two path segments", () => {
      const input = { filePath: "/Users/janni/src/file.ts" }
      expect(summarizeInput("write", input)).toBe("src/file.ts")
    })

    test("edit returns last two path segments", () => {
      const input = { filePath: "/Users/janni/src/file.ts" }
      expect(summarizeInput("edit", input)).toBe("src/file.ts")
    })

    test("handles missing filePath key", () => {
      const input = {}
      expect(summarizeInput("write", input)).toBe("")
    })
  })

  describe("rg tool", () => {
    test("rg returns pattern with quotes without include", () => {
      const input = { pattern: "function.*export" }
      expect(summarizeInput("rg", input)).toBe('"function.*export"')
    })

    test("rg returns pattern and include filter", () => {
      const input = { pattern: "TODO", include: "*.ts" }
      expect(summarizeInput("rg", input)).toBe('"TODO" in *.ts')
    })

    test("rg truncates long patterns to 30 chars", () => {
      const longPattern = "a".repeat(40)
      const input = { pattern: longPattern }
      const result = summarizeInput("rg", input)
      expect(result).toBe(`"${"a".repeat(30)}"`)
    })

    test("handles missing include key", () => {
      const input = { pattern: "test" }
      expect(summarizeInput("rg", input)).toBe('"test"')
    })

    test("handles missing pattern key", () => {
      const input = { include: "*.ts" }
      expect(summarizeInput("rg", input)).toBe('"" in *.ts')
    })
  })

  describe("task tool", () => {
    test("returns agent and description", () => {
      const input = { subagent_type: "developer", description: "Fix the WASM issue" }
      expect(summarizeInput("task", input)).toBe("@developer: Fix the WASM issue")
    })

    test("truncates description to 40 chars", () => {
      const longDesc = "a".repeat(50)
      const input = { subagent_type: "developer", description: longDesc }
      const result = summarizeInput("task", input)
      expect(result).toBe("@developer: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
      expect(result.length).toBe(12 + 40)
    })

    test("returns just description without agent", () => {
      const input = { description: "Some task" }
      expect(summarizeInput("task", input)).toBe("Some task")
    })

    test("handles missing description key", () => {
      const input = { subagent_type: "developer" }
      expect(summarizeInput("task", input)).toBe("@developer: ")
    })
  })

  describe("todo tools", () => {
    test("todowrite returns 'todo list'", () => {
      expect(summarizeInput("todowrite", {})).toBe("todo list")
    })

    test("todowrite ignores input content", () => {
      expect(summarizeInput("todowrite", { items: [] })).toBe("todo list")
    })

    test("todoread returns 'todo list'", () => {
      expect(summarizeInput("todoread", {})).toBe("todo list")
    })
  })

  describe("unknown tool fallback", () => {
    test("returns first string value", () => {
      const input = { query: "search term", count: 5 }
      expect(summarizeInput("unknown", input)).toBe("search term")
    })

    test("truncates fallback to 60 chars", () => {
      const longStr = "a".repeat(70)
      const input = { data: longStr }
      const result = summarizeInput("unknown", input)
      expect(result).toBe("a".repeat(60))
      expect(result.length).toBe(60)
    })

    test("finds string value among other types", () => {
      const input = { active: false, count: 5, query: "search" }
      expect(summarizeInput("unknown", input)).toBe("search")
    })
  })

  describe("edge cases", () => {
    test("returns empty string when input is undefined", () => {
      expect(summarizeInput("bash")).toBe("")
    })

    test("returns empty string when input is empty object", () => {
      expect(summarizeInput("unknown", {})).toBe("")
    })

    test("returns empty string when no string values present", () => {
      const input = { count: 5, active: true, ratio: 0.5 }
      expect(summarizeInput("unknown", input)).toBe("")
    })

    test("handles input with null values", () => {
      const input = { command: null }
      expect(summarizeInput("bash", input)).toBe("")
    })

    test("handles input with undefined values", () => {
      const input = { filePath: undefined }
      expect(summarizeInput("read", input)).toBe("")
    })

    test("handles input with mixed types", () => {
      const input = { count: 42, flag: true, name: "test", nested: { deep: "value" } }
      expect(summarizeInput("unknown", input)).toBe("test")
    })
  })
})
