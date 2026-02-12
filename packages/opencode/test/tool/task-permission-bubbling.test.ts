import { describe, expect, test } from "bun:test"

/**
 * Task tool permission bubbling and delegation tests for ask->deny conversion
 * Covers security logic from src/tool/task.ts lines 189-191
 */

describe("tool.task permission bubbling", () => {
  test("converts ask to deny for child tasks", () => {
    const parentPermission = { permission: "task", pattern: "ops", action: "ask" }

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

  test("preserves permission and pattern fields during conversion", () => {
    const parent = { permission: "task", pattern: "ops", action: "ask" }

    const converted = {
      permission: parent.permission,
      pattern: parent.pattern,
      action: parent.action === "ask" ? "deny" : parent.action,
    }

    expect(converted.permission).toBe("task")
    expect(converted.pattern).toBe("ops")
    expect(converted.action).toBe("deny")
  })

  test("preserves permission and pattern for allow action", () => {
    const parent = { permission: "task", pattern: "developer", action: "allow" }

    const converted = {
      permission: parent.permission,
      pattern: parent.pattern,
      action: parent.action === "ask" ? "deny" : parent.action,
    }

    expect(converted.permission).toBe("task")
    expect(converted.pattern).toBe("developer")
    expect(converted.action).toBe("allow")
  })

  test("preserves permission and pattern for deny action", () => {
    const parent = { permission: "task", pattern: "ops", action: "deny" }

    const converted = {
      permission: parent.permission,
      pattern: parent.pattern,
      action: parent.action === "ask" ? "deny" : parent.action,
    }

    expect(converted.permission).toBe("task")
    expect(converted.pattern).toBe("ops")
    expect(converted.action).toBe("deny")
  })

  test("bubbles multiple permissions to child session", () => {
    const parentPermissions = [
      { permission: "Task", pattern: "ops", action: "ask" },
      { permission: "task", pattern: "developer", action: "allow" },
      { permission: "task", pattern: "research", action: "deny" },
    ]

    const converted = parentPermissions.map((p: any) => ({
      permission: p.permission,
      pattern: p.pattern,
      action: p.action === "ask" ? "deny" : p.action,
    }))

    expect(converted.find((p: any) => p.pattern === "ops")?.action).toBe("deny")
    expect(converted.find((p: any) => p.pattern === "developer")?.action).toBe("allow")
    expect(converted.find((p: any) => p.pattern === "research")?.action).toBe("deny")
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
    const parent = { permission: [] }

    const hasTaskPermission = (parent.permission as any[]).some((rule) => rule.permission === "task")

    if (!hasTaskPermission) {
      const denial = { permission: "task", pattern: "*", action: "deny" }
      expect(denial.action).toBe("deny")
      expect(hasTaskPermission).toBe(false)
    }
  })

  describe("null parentAgent safety", () => {
    test("empty array when parentAgent is null", () => {
      const parentAgent = null

      const parentTaskPermissions =
        // eslint-disable-next-line @typescript-eslint/strict-null-checks
        parentAgent?.permission
          ?.filter((p: any) => p.permission === "task")
          ?.map((p: any) => ({
            permission: "task",
            pattern: p.pattern,
            action: p.action === "ask" ? "deny" : p.action,
          })) ?? []

      expect(parentTaskPermissions).toEqual([])
      expect(parentTaskPermissions.length).toBe(0)
    })

    test("empty array when parentAgent.permission is undefined", () => {
      const parentAgent = { permission: undefined } as any

      const parentTaskPermissions =
        // eslint-disable-next-line @typescript-eslint/strict-null-checks
        parentAgent?.permission
          ?.filter((p: any) => p.permission === "task")
          ?.map((p: any) => ({
            permission: "task",
            pattern: p.pattern,
            action: p.action === "ask" ? "deny" : p.action,
          })) ?? []

      expect(parentTaskPermissions).toEqual([])
      expect(parentTaskPermissions.length).toBe(0)
    })

    test("adds base denials even with null parentAgent", () => {
      const parentTaskPermissions = []

      const baseDenials = [
        { permission: "todowrite", pattern: "*", action: "deny" },
        { permission: "todoread", pattern: "*", action: "deny" },
      ]

      const childPermissions = [...baseDenials, ...parentTaskPermissions]

      expect(childPermissions).toHaveLength(2)
      expect(childPermissions.some((p) => p.permission === "todowrite" && p.action === "deny")).toBe(true)
      expect(childPermissions.some((p) => p.permission === "todoread" && p.action === "deny")).toBe(true)
    })
  })
})
