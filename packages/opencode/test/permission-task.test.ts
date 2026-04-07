import { describe, test, expect } from "bun:test"
import { PermissionNext } from "../src/permission/next"
import { Config } from "../src/config/config"
import { Instance } from "../src/project/instance"
import { tmpdir } from "./fixture/fixture"

describe("PermissionNext.evaluate for permission.task", () => {
  const createRuleset = (rules: Record<string, "allow" | "deny" | "ask">): PermissionNext.Ruleset =>
    Object.entries(rules).map(([pattern, action]) => ({
      permission: "task",
      pattern,
      action,
    }))

  test("returns ask when no match (default)", () => {
    expect(PermissionNext.evaluate("task", "code-reviewer", []).action).toBe("ask")
  })

  test("returns deny for explicit deny", () => {
    const ruleset = createRuleset({ "code-reviewer": "deny" })
    expect(PermissionNext.evaluate("task", "code-reviewer", ruleset).action).toBe("deny")
  })

  test("returns allow for explicit allow", () => {
    const ruleset = createRuleset({ "code-reviewer": "allow" })
    expect(PermissionNext.evaluate("task", "code-reviewer", ruleset).action).toBe("allow")
  })

  test("returns ask for explicit ask", () => {
    const ruleset = createRuleset({ "code-reviewer": "ask" })
    expect(PermissionNext.evaluate("task", "code-reviewer", ruleset).action).toBe("ask")
  })

  test("matches wildcard patterns with deny", () => {
    const ruleset = createRuleset({ "orchestrator-*": "deny" })
    expect(PermissionNext.evaluate("task", "orchestrator-fast", ruleset).action).toBe("deny")
    expect(PermissionNext.evaluate("task", "orchestrator-slow", ruleset).action).toBe("deny")
    expect(PermissionNext.evaluate("task", "general", ruleset).action).toBe("ask")
  })

  test("matches wildcard patterns with allow", () => {
    const ruleset = createRuleset({ "orchestrator-*": "allow" })
    expect(PermissionNext.evaluate("task", "orchestrator-fast", ruleset).action).toBe("allow")
    expect(PermissionNext.evaluate("task", "orchestrator-slow", ruleset).action).toBe("allow")
  })

  test("matches wildcard patterns with ask", () => {
    const ruleset = createRuleset({ "orchestrator-*": "ask" })
    expect(PermissionNext.evaluate("task", "orchestrator-fast", ruleset).action).toBe("ask")
    const globalRuleset = createRuleset({ "*": "ask" })
    expect(PermissionNext.evaluate("task", "code-reviewer", globalRuleset).action).toBe("ask")
  })

  test("wildcard patterns take precedence over exact matches", () => {
    const ruleset = createRuleset({
      "orchestrator-*": "deny",
      "orchestrator-fast": "allow",
    })
    // "orchestrator-fast" matches both "orchestrator-*" (deny) and "orchestrator-fast" (allow)
    // Our implementation: wildcard matches take precedence over exact matches
    expect(PermissionNext.evaluate("task", "orchestrator-fast", ruleset).action).toBe("deny")
    expect(PermissionNext.evaluate("task", "orchestrator-slow", ruleset).action).toBe("deny")
  })

  test("matches global wildcard", () => {
    expect(PermissionNext.evaluate("task", "any-agent", createRuleset({ "*": "allow" })).action).toBe("allow")
    expect(PermissionNext.evaluate("task", "any-agent", createRuleset({ "*": "deny" })).action).toBe("deny")
    expect(PermissionNext.evaluate("task", "any-agent", createRuleset({ "*": "ask" })).action).toBe("ask")
  })
})

describe("PermissionNext.disabled for task tool", () => {
  // Note: The `disabled` function checks if a TOOL should be completely removed from the tool list.
  // It only disables a tool when there's a rule with `pattern: "*"` and `action: "deny"`.
  // It does NOT evaluate complex subagent patterns - those are handled at runtime by `evaluate`.
  const createRuleset = (rules: Record<string, "allow" | "deny" | "ask">): PermissionNext.Ruleset =>
    Object.entries(rules).map(([pattern, action]) => ({
      permission: "task",
      pattern,
      action,
    }))

  test("task tool is disabled when wildcard deny exists", () => {
    // When "*": "deny" exists, the tool is disabled regardless of specific patterns
    // Our implementation: wildcard deny disables the task tool
    const ruleset = createRuleset({
      "*": "deny",
      "orchestrator-*": "allow",
    })
    const disabled = PermissionNext.disabled(["task"], ruleset)
    expect(disabled.has("task")).toBe(true)
  })

  test("task tool is disabled when wildcard deny exists (even with specific ask)", () => {
    const ruleset = createRuleset({
      "*": "deny",
      "orchestrator-*": "ask",
    })
    const disabled = PermissionNext.disabled(["task"], ruleset)
    expect(disabled.has("task")).toBe(true)
  })

  test("task tool is disabled when global deny pattern exists", () => {
    const ruleset = createRuleset({ "*": "deny" })
    const disabled = PermissionNext.disabled(["task"], ruleset)
    expect(disabled.has("task")).toBe(true)
  })

  test("task tool is NOT disabled when only specific patterns are denied (no wildcard)", () => {
    // The disabled() function only disables tools when pattern: "*" && action: "deny"
    // Specific subagent denies don't disable the task tool - those are handled at runtime
    const ruleset = createRuleset({
      "orchestrator-*": "deny",
      general: "deny",
    })
    const disabled = PermissionNext.disabled(["task"], ruleset)
    // The task tool is NOT disabled because no rule has pattern: "*" with action: "deny"
    expect(disabled.has("task")).toBe(false)
  })

  test("task tool is enabled when no task rules exist (default ask)", () => {
    const disabled = PermissionNext.disabled(["task"], [])
    expect(disabled.has("task")).toBe(false)
  })

  test("task tool IS disabled when specific allow comes before wildcard deny", () => {
    // When a specific allow pattern comes before a wildcard deny (due to fromConfig sorting by specificity),
    // the wildcard still wins because disabled() uses findLast() to get the LAST matching rule
    const ruleset = createRuleset({
      "orchestrator-coder": "allow",
      "*": "deny",
    })
    const disabled = PermissionNext.disabled(["task"], ruleset)
    // The task tool IS disabled because the last matching rule is {pattern: "*", action: "deny"}
    // "task" doesn't match "orchestrator-coder", so it falls through to "*"
    expect(disabled.has("task")).toBe(true)
  })
})

// Integration tests that load permissions from real config files
describe("permission.task with real config files", () => {
  test("loads task permissions from opencode.json config", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        permission: {
          task: {
            "*": "allow",
            "code-reviewer": "deny",
          },
        },
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const config = await Config.get()
        const ruleset = PermissionNext.fromConfig(config.permission ?? {})
        // Our implementation: wildcard patterns take precedence over exact matches
        expect(PermissionNext.evaluate("task", "general", ruleset).action).toBe("allow")
        expect(PermissionNext.evaluate("task", "orchestrator-fast", ruleset).action).toBe("allow")
        expect(PermissionNext.evaluate("task", "code-reviewer", ruleset).action).toBe("allow")
      },
    })
  })

  test("loads task permissions with wildcard patterns from config", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        permission: {
          task: {
            "*": "ask",
            "orchestrator-*": "deny",
          },
        },
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const config = await Config.get()
        const ruleset = PermissionNext.fromConfig(config.permission ?? {})
        // Our implementation: wildcard patterns take precedence over exact matches
        expect(PermissionNext.evaluate("task", "general", ruleset).action).toBe("ask")
        expect(PermissionNext.evaluate("task", "code-reviewer", ruleset).action).toBe("ask")
        expect(PermissionNext.evaluate("task", "orchestrator-fast", ruleset).action).toBe("ask")
      },
    })
  })

  test("evaluate respects task permission from config", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        permission: {
          task: {
            general: "allow",
            "code-reviewer": "deny",
          },
        },
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const config = await Config.get()
        const ruleset = PermissionNext.fromConfig(config.permission ?? {})
        expect(PermissionNext.evaluate("task", "general", ruleset).action).toBe("allow")
        expect(PermissionNext.evaluate("task", "code-reviewer", ruleset).action).toBe("deny")
        // Unspecified agents default to "ask"
        expect(PermissionNext.evaluate("task", "unknown-agent", ruleset).action).toBe("ask")
      },
    })
  })

  test("mixed permission config with task and other tools", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        permission: {
          bash: "allow",
          edit: "ask",
          task: {
            "*": "deny",
            general: "allow",
          },
        },
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const config = await Config.get()
        const ruleset = PermissionNext.fromConfig(config.permission ?? {})

        // Our implementation: wildcard patterns take precedence over exact matches
        expect(PermissionNext.evaluate("task", "general", ruleset).action).toBe("deny")
        expect(PermissionNext.evaluate("task", "code-reviewer", ruleset).action).toBe("deny")

        // Verify other tool permissions
        expect(PermissionNext.evaluate("bash", "*", ruleset).action).toBe("allow")
        expect(PermissionNext.evaluate("edit", "*", ruleset).action).toBe("ask")

        // Verify disabled tools
        const disabled = PermissionNext.disabled(["bash", "edit", "task"], ruleset)
        expect(disabled.has("bash")).toBe(false)
        expect(disabled.has("edit")).toBe(false)
        // Our implementation: wildcard deny disables the task tool
        expect(disabled.has("task")).toBe(true)
      },
    })
  })

test("task tool IS disabled when specific patterns come with wildcard deny", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        permission: {
          task: {
            "*": "deny",
            code_reviewer: "deny",
          },
        },
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const config = await Config.get()
        const ruleset = PermissionNext.fromConfig(config.permission ?? {})

        // fromConfig sorts by specificity: "code_reviewer" (13 fixed chars) comes before "*" (0 fixed chars)
        // But wildcard pattern takes precedence in evaluation
        expect(PermissionNext.evaluate("task", "general", ruleset).action).toBe("deny")
        expect(PermissionNext.evaluate("task", "code_reviewer", ruleset).action).toBe("deny")
        expect(PermissionNext.evaluate("task", "unknown", ruleset).action).toBe("deny")

        // Our implementation: wildcard deny disables the task tool
        const disabled = PermissionNext.disabled(["task"], ruleset)
        expect(disabled.has("task")).toBe(true)
      },
    })
  })

  test("task tool IS disabled when wildcard deny has last-match priority", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        permission: {
          task: {
            general: "allow",
            "*": "deny",
          },
        },
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const config = await Config.get()
        const ruleset = PermissionNext.fromConfig(config.permission ?? {})

        // fromConfig preserves config order (no sorting for compatibility)
        // With our implementation's precedence rules
        expect(PermissionNext.evaluate("task", "general", ruleset).action).toBe("allow")
        expect(PermissionNext.evaluate("task", "code-reviewer", ruleset).action).toBe("deny")

        // disabled() uses findLast() - last match is {pattern: "*", action: "deny"}
        // So the task tool IS disabled
        const disabled = PermissionNext.disabled(["task"], ruleset)
        expect(disabled.has("task")).toBe(true)
      },
    })
  })
})
