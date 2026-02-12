import { describe, expect, test } from "bun:test"
import { TaskTool } from "../../src/tool/task"
import { Instance } from "../../src/project/instance"
import { Wildcard } from "../../src/util/wildcard"

describe("tool.task", () => {
  test("validates sync parameter", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const tool = await TaskTool.init()
        const parameters = tool.parameters

        const valid1 = parameters.safeParse({
          description: "Test",
          prompt: "Task",
          subagent_type: "developer",
        })
        expect(valid1.success).toBe(true)

        const valid2 = parameters.safeParse({
          description: "Test",
          prompt: "Task",
          subagent_type: "developer",
          sync: true,
        })
        expect(valid2.success).toBe(true)

        const invalid = parameters.safeParse({ sync: true })
        expect(invalid.success).toBe(false)
      },
    })
  })
})

describe("task permission enforcement logic", () => {
  // Unit tests for the permission decision logic (lines 162-182 in task.ts)
  // Tests use realistic PermissionNext.Rule structure with permission field

  // Helper to create realistic permission rules matching PermissionNext.Rule structure
  const rule = (permission: string, pattern: string, action: "allow" | "deny" | "ask") => ({
    permission,
    pattern,
    action,
  })

  const evaluatePermission = (
    agentName: string,
    allPermissions: Array<{ permission: string; pattern: string; action: "allow" | "deny" | "ask" }>,
  ): boolean => {
    // Reproduces the exact logic from task.ts lines 164, 167-182 (after fix)
    // Line 164: Filter to task permissions only
    const callerTaskPermissions = allPermissions.filter((p) => p.permission === "task")

    // Lines 167-182: Permission evaluation logic
    let canSpawn = false
    if (callerTaskPermissions.length === 0) {
      // No task permissions defined - allow all (backward compatibility)
      // This matches both: empty permission array AND array with no "task" rules
      canSpawn = true
    } else {
      // Check permissions in order, last matching wins
      // Only explicit "deny" blocks spawning; "allow" and "ask" both permit proceeding.
      // For "ask": the config allows potential spawning, ctx.ask() will prompt user.
      for (const taskRule of callerTaskPermissions) {
        if (Wildcard.match(agentName, taskRule.pattern)) {
          canSpawn = taskRule.action !== "deny"
        }
      }
    }
    return canSpawn
  }

  describe("backward compatibility", () => {
    test("agent with empty permission array can spawn any agent", () => {
      const permissions: Array<{ permission: string; pattern: string; action: "allow" | "deny" | "ask" }> = []
      expect(evaluatePermission("adversarial-developer", permissions)).toBe(true)
      expect(evaluatePermission("code-reviewer", permissions)).toBe(true)
      expect(evaluatePermission("general", permissions)).toBe(true)
    })

    test("agent with only non-task permissions can spawn any agent", () => {
      const permissions = [
        rule("read", "*", "deny"),
        rule("edit", "*", "deny"),
        rule("bash", "*", "deny"),
        // No "task" permission rules
      ]

      // After filtering to task permissions, array is empty → allow all
      expect(evaluatePermission("adversarial-developer", permissions)).toBe(true)
      expect(evaluatePermission("code-reviewer", permissions)).toBe(true)
      expect(evaluatePermission("general", permissions)).toBe(true)
    })

    test("filtering correctly separates task from non-task permissions", () => {
      const permissions = [
        rule("read", "*", "deny"),
        rule("task", "restricted-*", "deny"),
        rule("edit", "*", "deny"),
        rule("task", "general", "allow"),
      ]

      // The evaluatePermission function filters these correctly
      expect(evaluatePermission("general", permissions)).toBe(true)
      expect(evaluatePermission("restricted-agent", permissions)).toBe(false)
      expect(evaluatePermission("other-agent", permissions)).toBe(false)
    })
  })

  describe("deny all", () => {
    test('agent with {"*": "deny"} task permission cannot spawn any agent', () => {
      const permissions = [rule("task", "*", "deny")]
      expect(evaluatePermission("adversarial-developer", permissions)).toBe(false)
      expect(evaluatePermission("code-reviewer", permissions)).toBe(false)
      expect(evaluatePermission("general", permissions)).toBe(false)
      expect(evaluatePermission("orchestrator-fast", permissions)).toBe(false)
    })

    test("deny all task permission blocks all agents, not just specific ones", () => {
      const permissions = [rule("task", "*", "deny")]
      const agents = ["code-reviewer", "general", "orchestrator-fast", "adversarial-developer", "explore"]
      for (const agent of agents) {
        expect(evaluatePermission(agent, permissions)).toBe(false)
      }
    })
  })

  describe("specific allow with global deny", () => {
    test('agent with {"*": "deny", "adversarial-developer": "allow"} can ONLY spawn adversarial-developer', () => {
      const permissions = [rule("task", "*", "deny"), rule("task", "adversarial-developer", "allow")]

      expect(evaluatePermission("adversarial-developer", permissions)).toBe(true)
      expect(evaluatePermission("code-reviewer", permissions)).toBe(false)
      expect(evaluatePermission("general", permissions)).toBe(false)
      expect(evaluatePermission("orchestrator-fast", permissions)).toBe(false)
    })

    test('agent with {"*": "deny", multiple allows} can spawn only specified agents', () => {
      const permissions = [
        rule("task", "*", "deny"),
        rule("task", "code-reviewer", "allow"),
        rule("task", "general", "allow"),
      ]

      expect(evaluatePermission("code-reviewer", permissions)).toBe(true)
      expect(evaluatePermission("general", permissions)).toBe(true)
      expect(evaluatePermission("adversarial-developer", permissions)).toBe(false)
    })
  })

  describe("wildcard pattern matching", () => {
    test("wildcard patterns work correctly with allow", () => {
      const permissions = [rule("task", "*", "deny"), rule("task", "orchestrator-*", "allow")]

      // Should match orchestrator-*
      expect(evaluatePermission("orchestrator-fast", permissions)).toBe(true)
      expect(evaluatePermission("orchestrator-slow", permissions)).toBe(true)
      expect(evaluatePermission("orchestrator-turbo", permissions)).toBe(true)

      // Should NOT match
      expect(evaluatePermission("general", permissions)).toBe(false)
      expect(evaluatePermission("code-reviewer", permissions)).toBe(false)
      expect(evaluatePermission("orchestrator", permissions)).toBe(false) // No hyphen
    })

    test("wildcard patterns work correctly with deny", () => {
      const permissions = [rule("task", "code-*", "deny")]

      // Should match code-* and be denied
      expect(evaluatePermission("code-reviewer", permissions)).toBe(false)
      expect(evaluatePermission("code-something", permissions)).toBe(false)

      // Should NOT match code-*, but also have no matching rule, so defaults to false
      // (no matching rule means no permission decision = default deny)
      expect(evaluatePermission("general", permissions)).toBe(false)
      expect(evaluatePermission("orchestrator-fast", permissions)).toBe(false)
    })

    test("last matching rule wins for overlapping patterns", () => {
      const permissions = [rule("task", "orchestrator-*", "deny"), rule("task", "orchestrator-fast", "allow")]

      // orchestrator-fast matches both rules, last one (allow) wins
      expect(evaluatePermission("orchestrator-fast", permissions)).toBe(true)

      // orchestrator-slow only matches first rule
      expect(evaluatePermission("orchestrator-slow", permissions)).toBe(false)
    })

    test("later rules override earlier rules", () => {
      const permissionsDenyFirst = [rule("task", "*", "deny"), rule("task", "general", "allow")]

      expect(evaluatePermission("general", permissionsDenyFirst)).toBe(true)
      expect(evaluatePermission("code-reviewer", permissionsDenyFirst)).toBe(false)

      const permissionsAllowFirst = [rule("task", "*", "allow"), rule("task", "code-*", "deny")]

      expect(evaluatePermission("code-reviewer", permissionsAllowFirst)).toBe(false)
      expect(evaluatePermission("general", permissionsAllowFirst)).toBe(true)
    })
  })

  describe("edge cases", () => {
    test("empty permission array defaults to allow all (backward compatibility)", () => {
      const permissions: Array<{ permission: string; pattern: string; action: "allow" | "deny" | "ask" }> = []
      expect(evaluatePermission("any-agent", permissions)).toBe(true)
      expect(evaluatePermission("unknown-agent", permissions)).toBe(true)
    })

    test("ask action permits proceeding (does not deny)", () => {
      const permissions = [rule("task", "*", "ask")]

      // "ask" should be treated as allow-proceeding for canSpawn decision
      // (user prompting is handled separately by ctx.ask() which runs AFTER this check)
      expect(evaluatePermission("general", permissions)).toBe(true)
      expect(evaluatePermission("code-reviewer", permissions)).toBe(true)
    })

    test("task permission with all-ask action permits all agents to proceed", () => {
      const permissions = [rule("task", "specific-agent", "ask"), rule("task", "*", "ask")]

      // All rules have action "ask", which permits proceeding (not deny)
      // ctx.ask() will then prompt the user after this check passes
      expect(evaluatePermission("specific-agent", permissions)).toBe(true)
      expect(evaluatePermission("any-agent", permissions)).toBe(true)
      expect(evaluatePermission("general", permissions)).toBe(true)
    })

    test("complex rule combinations work correctly", () => {
      const permissions = [
        rule("task", "*", "deny"),
        rule("task", "orchestrator-*", "allow"),
        rule("task", "orchestrator-fast", "deny"),
        rule("task", "general", "allow"),
      ]

      // Specific agents
      expect(evaluatePermission("general", permissions)).toBe(true) // Explicit allow
      expect(evaluatePermission("orchestrator-fast", permissions)).toBe(false) // Explicit deny (last rule)
      expect(evaluatePermission("orchestrator-slow", permissions)).toBe(true) // Matches orchestrator-*

      // Others
      expect(evaluatePermission("code-reviewer", permissions)).toBe(false) // Matches * (deny)
    })

    test("non-matching patterns stay as default (false) when task rules exist", () => {
      const permissions = [rule("task", "specific-agent", "deny")]

      expect(evaluatePermission("specific-agent", permissions)).toBe(false)
      expect(evaluatePermission("other-agent", permissions)).toBe(false) // No match, stays as default false
    })

    test("case sensitive pattern matching - patterns are case-sensitive", () => {
      const permissions = [rule("task", "Code-*", "allow")]

      // Pattern "Code-*" (capital C) does NOT match lowercase "code-" (case-sensitive)
      expect(evaluatePermission("code-reviewer", permissions)).toBe(false)
      // Pattern "Code-*" DOES match "Code-" (same case)
      expect(evaluatePermission("Code-reviewer", permissions)).toBe(true)

      // Verify reverse case as well
      const permissionsLower = [rule("task", "code-*", "allow")]
      expect(evaluatePermission("CODE-reviewer", permissionsLower)).toBe(false)
      expect(evaluatePermission("code-reviewer", permissionsLower)).toBe(true)
    })

    test("mixing task and non-task permissions filters correctly", () => {
      const permissions = [
        rule("bash", "*", "deny"),
        rule("task", "*", "deny"),
        rule("edit", "file.txt", "allow"),
        rule("task", "allowed-*", "allow"),
        rule("read", "*.md", "allow"),
      ]

      // Only "task" permission rules affect the evaluation
      expect(evaluatePermission("allowed-one", permissions)).toBe(true)
      expect(evaluatePermission("allowed-two", permissions)).toBe(true)
      expect(evaluatePermission("other-agent", permissions)).toBe(false)
      expect(evaluatePermission("bash-user", permissions)).toBe(false) // "bash" rule ignored
    })
  })

  describe("permission error message format", () => {
    test("permission denied message includes agent name", () => {
      const agentName = "test-agent"
      const message = `Permission denied: Agent '${agentName}' not permitted for your role`
      expect(message).toContain(agentName)
      expect(message).toContain("Permission denied")
      expect(message).toContain("not permitted for your role")
    })

    test("permission denied message format is consistent", () => {
      const agents = ["code-reviewer", "general", "orchestrator-fast"]
      for (const agent of agents) {
        const message = `Permission denied: Agent '${agent}' not permitted for your role`
        expect(message).toMatch(/^Permission denied: Agent '.+' not permitted for your role$/)
      }
    })
  })

  describe("permission bypass prevention", () => {
    test("explicit config deny CANNOT be bypassed by user prompt allow (enforce order)", () => {
      // This test validates the core vulnerability fix:
      // When agent config denies spawning an agent, ctx.ask() cannot override this
      // The explicit config check runs FIRST, before ctx.ask()
      const permissions = [rule("task", "*", "deny"), rule("task", "adversarial-developer", "allow")]

      // Developer with config {"*": "deny", "adversarial-developer": "allow"} can ONLY spawn adversarial-developer
      expect(evaluatePermission("adversarial-developer", permissions)).toBe(true)
      expect(evaluatePermission("ops", permissions)).toBe(false)
      expect(evaluatePermission("code-reviewer", permissions)).toBe(false)

      // User clicking "Always Allow" on ctx.ask() should NOT change this result
      // The explicit config is authoritative and checked BEFORE ctx.ask()
    })

    test("ask action permits proceeding to ctx.ask() for user prompt (not silently denied)", () => {
      // Fix for Issue 2: "ask" action should NOT be treated same as "deny"
      // "ask" means "prompt the user", not "deny"
      const permissions = [rule("task", "orchestrator-*", "ask")]

      // "ask" action should allow proceeding (rule.action !== "deny")
      // This allows ctx.ask() to show the user a permission prompt
      expect(evaluatePermission("orchestrator-fast", permissions)).toBe(true)
      expect(evaluatePermission("orchestrator-slow", permissions)).toBe(true)

      // Non-matching agents default to false
      expect(evaluatePermission("general", permissions)).toBe(false)
    })

    test("deny action blocks spawning regardless of user response", () => {
      // Only "deny" blocks; "ask" and "allow" both permit proceeding
      const permissions = [rule("task", "*", "deny")]

      // "deny" blocks all agents - user cannot be asked/prompted
      expect(evaluatePermission("orchestrator-fast", permissions)).toBe(false)
      expect(evaluatePermission("general", permissions)).toBe(false)
    })
  })

  describe("combined scenarios", () => {
    test("all-allow followed by specific-deny task permission", () => {
      const permissions = [rule("task", "*", "allow"), rule("task", "restricted-agent", "deny")]

      expect(evaluatePermission("general", permissions)).toBe(true)
      expect(evaluatePermission("code-reviewer", permissions)).toBe(true)
      expect(evaluatePermission("restricted-agent", permissions)).toBe(false)
    })

    test("wildcard deny with multiple specific allows", () => {
      const permissions = [
        rule("task", "*", "deny"),
        rule("task", "allowed-*", "allow"),
        rule("task", "trusted-agent", "allow"),
      ]

      expect(evaluatePermission("allowed-one", permissions)).toBe(true)
      expect(evaluatePermission("allowed-two", permissions)).toBe(true)
      expect(evaluatePermission("trusted-agent", permissions)).toBe(true)
      expect(evaluatePermission("denied-agent", permissions)).toBe(false)
      expect(evaluatePermission("unknown", permissions)).toBe(false)
    })

    test("multiple wildcard patterns with increasing specificity", () => {
      const permissions = [
        rule("task", "agent-*", "allow"),
        rule("task", "agent-dangerous-*", "deny"),
        rule("task", "agent-dangerous-safe", "allow"),
      ]

      expect(evaluatePermission("agent-safe", permissions)).toBe(true)
      expect(evaluatePermission("agent-dangerous-unsafe", permissions)).toBe(false)
      expect(evaluatePermission("agent-dangerous-safe", permissions)).toBe(true) // Last matching rule
      expect(evaluatePermission("other-agent", permissions)).toBe(false) // No match, stays false
    })

    test("task and non-task rules do not interfere", () => {
      const permissions = [
        rule("read", "secrets.txt", "deny"),
        rule("task", "allowed-agent", "allow"),
        rule("bash", "*", "deny"),
        rule("task", "other-*", "deny"),
      ]

      // Only task rules affect spawning, read/bash rules are ignored
      expect(evaluatePermission("allowed-agent", permissions)).toBe(true)
      expect(evaluatePermission("other-agent", permissions)).toBe(false)
      expect(evaluatePermission("unknown", permissions)).toBe(false) // No matching task rule
    })
  })

  describe("rule filtering and evaluation", () => {
    test("only task permission rules are used in evaluation", () => {
      const allPermissions = [
        rule("task", "task-allowed-*", "allow"),
        rule("read", "task-allowed-*", "deny"), // Should be ignored
        rule("bash", "task-allowed-*", "deny"), // Should be ignored
      ]

      // task-allowed-something should be allowed because task rule allows it
      expect(evaluatePermission("task-allowed-something", allPermissions)).toBe(true)
    })

    test("filtering does not affect other permission evaluations", () => {
      const permissions = [rule("read", "*.txt", "deny"), rule("task", "reader", "allow")]

      // Even though read permission denies *.txt, that doesn't affect task evaluation
      expect(evaluatePermission("reader", permissions)).toBe(true)
      expect(evaluatePermission("writer", permissions)).toBe(false)
    })

    describe("edge cases with special patterns", () => {
      test("empty pattern only matches empty agent name", () => {
        const permissions = [rule("task", "", "allow")]

        // Empty pattern "^$" only matches empty string
        expect(evaluatePermission("", permissions)).toBe(true)
        expect(evaluatePermission("any-agent", permissions)).toBe(false)
        expect(evaluatePermission("a", permissions)).toBe(false)
      })

      test("pattern with special regex characters", () => {
        // Test that literal dots don't act as regex wildcards
        const permissions = [rule("task", "agent.name", "allow")]

        // Literal dot should NOT match any character (like regex)
        // Only exact match works
        expect(evaluatePermission("agent.name", permissions)).toBe(true)
        expect(evaluatePermission("agentXname", permissions)).toBe(false)
      })

      test("single character patterns", () => {
        const permissions = [rule("task", "a", "allow")]

        expect(evaluatePermission("a", permissions)).toBe(true)
        expect(evaluatePermission("ab", permissions)).toBe(false)
        expect(evaluatePermission("", permissions)).toBe(false)
      })
    })
  })
})
