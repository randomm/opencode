import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Agent } from "../../src/agent/agent"
import { PermissionNext } from "../../src/permission/next"
import { tmpdir } from "../fixture/fixture"

// Helper to evaluate permission for a tool with wildcard pattern
function evalPerm(agent: Agent.Info | undefined, permission: string): PermissionNext.Action | undefined {
  if (!agent) return undefined
  return PermissionNext.evaluate(permission, "*", agent.permission).action
}

describe("agent permissions for taskctl pipeline", () => {
  test("adversarial-pipeline agent has taskctl permission", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const adversarial = await Agent.get("adversarial-pipeline")
        expect(adversarial).toBeDefined()
        expect(adversarial?.permission).toBeDefined()

        // Check the raw ruleset contains taskctl allowance
        const hasTaskctlAllow = adversarial!.permission.some(
          (rule: any) => rule.permission === "taskctl" && rule.action === "allow"
        )
        expect(hasTaskctlAllow).toBe(true)

        // Verify via PermissionNext.evaluate - taskctl with any pattern should be allowed
        const result = PermissionNext.evaluate("taskctl", "*", adversarial!.permission)
        expect(result.action).toBe("allow")
      },
    })
  })

  test("adversarial-pipeline agent has bash permission", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const adversarial = await Agent.get("adversarial-pipeline")
        expect(adversarial).toBeDefined()

        // Verify bash is allowed
        const result = PermissionNext.evaluate("bash", "*", adversarial!.permission)
        expect(result.action).toBe("allow")
      },
    })
  })

  test("developer-pipeline agent explicitly denies taskctl permission", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const developer = await Agent.get("developer-pipeline")
        expect(developer).toBeDefined()

        // Developer should explicitly deny taskctl - not just "not allow"
        const result = PermissionNext.evaluate("taskctl", "*", developer!.permission)
        expect(result.action).toBe("deny")  // Explicit deny, not fallback "ask"
      },
    })
  })

  test("adversarial-pipeline denies everything else (minimal permissions)", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const adversarial = await Agent.get("adversarial-pipeline")
        expect(adversarial).toBeDefined()

        // Check that common tools are denied (wildcard deny rule)
        const deniedTools = ["edit", "write", "read", "task"]

        for (const tool of deniedTools) {
          const result = PermissionNext.evaluate(tool, "*", adversarial!.permission)
          expect(result.action).toBe("deny")
        }
      },
    })
  })

  test("developer-pipeline denies task tool", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const developer = await Agent.get("developer-pipeline")
        expect(developer).toBeDefined()

        // Developer should NOT be able to spawn other agents via task tool
        const result = PermissionNext.evaluate("task", "*", developer!.permission)
        expect(result.action).toBe("deny")
      },
    })
  })
})