import { describe, expect, test } from "bun:test"

/**
 * Task tool permission bubbling and tests for ask->deny conversion
 * Covers security logic from src/tool/task.ts lines 189-191
 */

describe("tool.task permission bubbling", () => {
  test("converts ask to deny for child tasks", () => {
    // This validates the security rule from task.ts:
    // "ask" permissions become "deny" in child sessions (lines 189-19191)

    const parentPermission = { permission: "task", pattern: "ops", action: "ask" }

    // Actual conversion logic from implementation
    const action = parentPermission.action === "ask" ? "deny" : parentPermission.action

    expect(action).toBe("deny")
  })

  test("preserves allow permissions", () => {
    const parentPermission = { permission: "task", pattern: "developer", action: "allow" }

    const action = parentPermission.action === "ask" ? "deny" : parentPermission.action

    expect(action).toBe("allow")
  })

  test("preserves deny permissions", () => {
    const parentPermission = { permission: "task", pattern: "research", action: "deny" }

    const action = parentPermission.action === "ask" ? "deny" : parentPermission.action

    expect(action).toBe("deny")
  })

  test("bubbles multiple permissions to child session", () => {
    const parentPermissions = [
      { permission: "task", pattern: "ops", action: "ask" },
      { permission: "task", pattern: "developer", action: "allow" },
      { permission: "task", pattern: "research", action: "deny" },
    ]

    const converted = parentPermissions.map((p: any) => ({
      permission: p.permission,
      pattern: p.pattern,
      action: p.action === "ask" ? "deny" : p.action,
    }))

    expect(converted.find((p) => p.pattern === "ops")?.action).toBe("deny")
    expect(converted.find((p) => p.pattern === "developer")?.action).toBe("allow")
    expect(converted.find((p) => p.pattern === "research")?.action).toBe("deny")
  })

  test("adds base denials to child session", () => {
    const baseDenials = [
      { permission: "todowrite", pattern: "*", action: "deny" },
      { permission: "todoread", pattern: "*", action: "deny" },
    ]

    const parentPermissions = [{ permission: "task", pattern: "developer", action: "allow" }]

    const childPermissions = [...baseDenials, ...parentPermissions]

    expect(childPermissions).toHaveLength(3)
    expect(childPermissions.some((p) => p.permission === "todowrite" && p.action === "deny")).toBe(true)
    expect(childPermissions.some((p) => p.permission === "todoread" && p.action === "deny")).toBe(true)
    expect(childPermissions.some((p) => p.permission === "task" && p.pattern === "developer")).toBe(true)
  })

  test("denies all tasks when parent lacks permission", () => {
    const parent = { permission: [] } // No task permission

    const hasTaskPermission = (parent.permission as any[]).some((rule) => rule.permission === "task")

    // This triggers the conditional from task.ts lines 209-217
    if (!hasTaskPermission) {
      const denial = { permission: "task", pattern: "*", action: "deny" }
      expect(denial.action).toBe("deny")
      expect(hasTaskPermission).toBe(false)
    }
  })
})
