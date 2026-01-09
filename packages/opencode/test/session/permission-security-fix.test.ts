import { describe, expect, test } from "bun:test"
import path from "path"
import { Session } from "../../src/session"
import { PermissionNext } from "../../src/permission/next"
import { Instance } from "../../src/project/instance"

const projectRoot = path.join(__dirname, "../..")

describe("Permission security fix validation", () => {
  test("Task restrictions override agent wildcard allow permissions", () => {
    // Simulate the permission conflict: agent has "*": "allow", task adds restrictions
    const agentPermissions: PermissionNext.Ruleset = [
      { permission: "*", pattern: "*", action: "allow" },
      { permission: "bash", pattern: "*", action: "allow" },
    ]

    const taskRestrictions: PermissionNext.Ruleset = [
      { permission: "task", pattern: "*", action: "deny" },
      { permission: "git", pattern: "*", action: "deny" },
    ]

    // Merge order matters: agent first, then restrictions (last wins)
    const merged = PermissionNext.merge(agentPermissions, taskRestrictions)

    // Git should be denied because restriction comes after agent's wildcard allow
    expect(PermissionNext.evaluate("git", "*", merged).action).toBe("deny")
    expect(PermissionNext.evaluate("bash", "*", merged).action).toBe("allow")
    expect(PermissionNext.evaluate("write", "*", merged).action).toBe("allow") // from wildcard
    expect(PermissionNext.evaluate("task", "*", merged).action).toBe("deny")
  })

  test("Session creation inherits parent permissions correctly", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        // Create parent with git restrictions
        const parent = await Session.create({
          title: "Parent",
          permission: [
            { permission: "git", pattern: "*", action: "deny" },
            { permission: "bash", pattern: "*", action: "allow" },
          ],
        })

        // Create child that adds more permissions
        const child = await Session.create({
          parentID: parent.id,
          permission: [{ permission: "read", pattern: "*", action: "allow" }],
        })

        // Child should inherit parent's git restrictions
        expect(PermissionNext.evaluate("git", "*", child.permission!).action).toBe("deny")
        expect(PermissionNext.evaluate("bash", "*", child.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("read", "*", child.permission!).action).toBe("allow")
      },
    })
  })

  test("Permission merge order is critical for security", () => {
    const parentPermissions: PermissionNext.Ruleset = [{ permission: "git", pattern: "*", action: "deny" }]

    const agentDefaults: PermissionNext.Ruleset = [
      { permission: "*", pattern: "*", action: "allow" }, // Overriding default
    ]

    const taskRestrictions: PermissionNext.Ruleset = [
      { permission: "git", pattern: "*", action: "deny" }, // Must be last
    ]

    // Wrong order demonstration (without task restrictions)
    const wrongWithoutRestrictions = PermissionNext.merge(parentPermissions, agentDefaults)
    expect(PermissionNext.evaluate("git", "*", wrongWithoutRestrictions).action).toBe("allow") // SECURITY ISSUE

    // Correct order with restrictions (task restrictions override agent defaults)
    const correctMerge = PermissionNext.merge(
      parentPermissions,
      agentDefaults,
      taskRestrictions, // Must come last to override agent "*": "allow"
    )
    expect(PermissionNext.evaluate("git", "*", correctMerge).action).toBe("deny") // SECURE
  })

  test("Security fix prevents git permission bypass in task sessions", () => {
    // Simulate actual task permission creation from the fix
    const agentPermissions: PermissionNext.Ruleset = [
      { permission: "*", pattern: "*", action: "allow" }, // Agent defaults
    ]

    // This simulates the fixed task.ts permission creation
    const taskPermissions = PermissionNext.merge(
      agentPermissions,
      [
        { permission: "task", pattern: "*", action: "deny" },
        { permission: "todowrite", pattern: "*", action: "deny" },
        { permission: "todoread", pattern: "*", action: "deny" },
      ],
      [
        { permission: "git", pattern: "*", action: "deny" }, // Must be last
      ],
    )

    // All sensitive operations should be denied
    expect(PermissionNext.evaluate("git", "*", taskPermissions).action).toBe("deny")
    expect(PermissionNext.evaluate("task", "*", taskPermissions).action).toBe("deny")
    expect(PermissionNext.evaluate("todowrite", "*", taskPermissions).action).toBe("deny")
    expect(PermissionNext.evaluate("todoread", "*", taskPermissions).action).toBe("deny")

    // Non-restricted operations should still work
    expect(PermissionNext.evaluate("read", "*", taskPermissions).action).toBe("allow")
    expect(PermissionNext.evaluate("bash", "*", taskPermissions).action).toBe("allow")
  })
})
