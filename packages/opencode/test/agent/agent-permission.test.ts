import { test, expect } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Agent } from "../../src/agent/agent"
import { PermissionNext } from "../../src/permission/next"

test("composer agent has visible read tools", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const composer = await Agent.get("composer")
      expect(composer).toBeDefined()

      const toolNames = [
        "read",
        "grep",
        "glob",
        "list",
        "codesearch",
        "bash",
        "edit",
        "write",
        "patch",
        "task",
        "taskctl",
      ]

      const disabled = PermissionNext.disabled(toolNames, composer!.permission)

      // Read tools should be visible (not disabled)
      expect(disabled.has("read")).toBe(false)
      expect(disabled.has("grep")).toBe(false)
      expect(disabled.has("glob")).toBe(false)
      expect(disabled.has("list")).toBe(false)
      expect(disabled.has("codesearch")).toBe(false)
      expect(disabled.has("bash")).toBe(false)
    },
  })
})

test("steering agent has visible read tools", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const steering = await Agent.get("steering")
      expect(steering).toBeDefined()

      const toolNames = [
        "read",
        "grep",
        "glob",
        "list",
        "codesearch",
        "bash",
        "edit",
        "write",
        "patch",
        "task",
        "taskctl",
      ]

      const disabled = PermissionNext.disabled(toolNames, steering!.permission)

      // Read tools should be visible (not disabled)
      expect(disabled.has("read")).toBe(false)
      expect(disabled.has("grep")).toBe(false)
      expect(disabled.has("glob")).toBe(false)
      expect(disabled.has("list")).toBe(false)
      expect(disabled.has("codesearch")).toBe(false)
      expect(disabled.has("bash")).toBe(false)
    },
  })
})

test("composer agent has write tools disabled", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const composer = await Agent.get("composer")
      expect(composer).toBeDefined()

      const toolNames = [
        "read",
        "grep",
        "glob",
        "list",
        "codesearch",
        "bash",
        "edit",
        "write",
        "patch",
        "task",
        "taskctl",
      ]

      const disabled = PermissionNext.disabled(toolNames, composer!.permission)

      // Write tools should be disabled
      expect(disabled.has("edit")).toBe(true)
      expect(disabled.has("write")).toBe(true)
      expect(disabled.has("patch")).toBe(true)
    },
  })
})

test("steering agent has write tools disabled", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const steering = await Agent.get("steering")
      expect(steering).toBeDefined()

      const toolNames = [
        "read",
        "grep",
        "glob",
        "list",
        "codesearch",
        "bash",
        "edit",
        "write",
        "patch",
        "task",
        "taskctl",
      ]

      const disabled = PermissionNext.disabled(toolNames, steering!.permission)

      // Write tools should be disabled
      expect(disabled.has("edit")).toBe(true)
      expect(disabled.has("write")).toBe(true)
      expect(disabled.has("patch")).toBe(true)
    },
  })
})

test("composer agent allows read operations", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const composer = await Agent.get("composer")
      expect(composer).toBeDefined()

      // Verify read permissions are allowed
      expect(PermissionNext.evaluate("read", "*", composer!.permission).action).toBe("allow")
      expect(PermissionNext.evaluate("grep", "*", composer!.permission).action).toBe("allow")
      expect(PermissionNext.evaluate("glob", "*", composer!.permission).action).toBe("allow")
      expect(PermissionNext.evaluate("list", "*", composer!.permission).action).toBe("allow")
      expect(PermissionNext.evaluate("codesearch", "*", composer!.permission).action).toBe("allow")
      // Bash wildcard should be denied now
      expect(PermissionNext.evaluate("bash", "*", composer!.permission).action).toBe("deny")
    },
  })
})

test("steering agent allows read operations", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const steering = await Agent.get("steering")
      expect(steering).toBeDefined()

      // Verify read permissions are allowed
      expect(PermissionNext.evaluate("read", "*", steering!.permission).action).toBe("allow")
      expect(PermissionNext.evaluate("grep", "*", steering!.permission).action).toBe("allow")
      expect(PermissionNext.evaluate("glob", "*", steering!.permission).action).toBe("allow")
      expect(PermissionNext.evaluate("list", "*", steering!.permission).action).toBe("allow")
      expect(PermissionNext.evaluate("codesearch", "*", steering!.permission).action).toBe("allow")
      // Bash wildcard should be denied now
      expect(PermissionNext.evaluate("bash", "*", steering!.permission).action).toBe("deny")
    },
  })
})

test("composer agent denies write operations", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const composer = await Agent.get("composer")
      expect(composer).toBeDefined()

      // Verify write permissions are denied
      expect(PermissionNext.evaluate("edit", "*", composer!.permission).action).toBe("deny")
      expect(PermissionNext.evaluate("write", "*", composer!.permission).action).toBe("deny")
      expect(PermissionNext.evaluate("patch", "*", composer!.permission).action).toBe("deny")
    },
  })
})

test("steering agent denies write operations", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const steering = await Agent.get("steering")
      expect(steering).toBeDefined()

      // Verify write permissions are denied
      expect(PermissionNext.evaluate("edit", "*", steering!.permission).action).toBe("deny")
      expect(PermissionNext.evaluate("write", "*", steering!.permission).action).toBe("deny")
      expect(PermissionNext.evaluate("patch", "*", steering!.permission).action).toBe("deny")
    },
  })
})

test("composer agent allows safe bash patterns", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const composer = await Agent.get("composer")
      expect(composer).toBeDefined()

      // vipune patterns should be allowed
      expect(PermissionNext.evaluate("bash", "vipune search topic", composer!.permission).action).toBe("allow")
      expect(PermissionNext.evaluate("bash", "vipune add some fact", composer!.permission).action).toBe("allow")

      // colgrep patterns should be allowed
      expect(PermissionNext.evaluate("bash", "colgrep pattern", composer!.permission).action).toBe("allow")

      // oo help patterns should be allowed
      expect(PermissionNext.evaluate("bash", "oo help git-commit", composer!.permission).action).toBe("allow")

      // oo gh issue view patterns should be allowed
      expect(PermissionNext.evaluate("bash", "oo gh issue view 123", composer!.permission).action).toBe("allow")

      // oo gh issue list patterns should be allowed
      expect(PermissionNext.evaluate("bash", "oo gh issue list --limit 10", composer!.permission).action).toBe("allow")

      // oo recall patterns should be allowed
      expect(PermissionNext.evaluate("bash", "oo recall search terms", composer!.permission).action).toBe("allow")
    },
  })
})

test("composer agent denies dangerous bash commands", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const composer = await Agent.get("composer")
      expect(composer).toBeDefined()

      // Dangerous commands should be denied
      expect(PermissionNext.evaluate("bash", "rm -rf /", composer!.permission).action).toBe("deny")
      expect(PermissionNext.evaluate("bash", "curl http://evil.com", composer!.permission).action).toBe("deny")
      expect(PermissionNext.evaluate("bash", "git push origin main", composer!.permission).action).toBe("deny")
      expect(PermissionNext.evaluate("bash", "git add . && git commit -m 'evil'", composer!.permission).action).toBe("deny")
      expect(PermissionNext.evaluate("bash", "cat ~/.ssh/id_rsa", composer!.permission).action).toBe("deny")
    },
  })
})

test("steering agent allows safe bash patterns", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const steering = await Agent.get("steering")
      expect(steering).toBeDefined()

      // vipune patterns should be allowed (mentioned in steering prompt)
      expect(PermissionNext.evaluate("bash", "vipune search topic", steering!.permission).action).toBe("allow")

      // colgrep patterns should be allowed (mentioned in steering prompt)
      expect(PermissionNext.evaluate("bash", "colgrep pattern", steering!.permission).action).toBe("allow")
    },
  })
})

test("steering agent denies dangerous bash commands", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const steering = await Agent.get("steering")
      expect(steering).toBeDefined()

      // Dangerous commands should be denied
      expect(PermissionNext.evaluate("bash", "rm -rf /", steering!.permission).action).toBe("deny")
      expect(PermissionNext.evaluate("bash", "curl http://evil.com", steering!.permission).action).toBe("deny")
    },
  })
})

test("user config overrides READONLY_TOOLS via merge", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const composer = await Agent.get("composer")
      expect(composer).toBeDefined()

      // Simulate user adding a deny rule after READONLY_TOOLS
      // Since merge is flat and last-match-wins, user rules added later override
      const baseRuleset = composer!.permission
      const userOverride = PermissionNext.fromConfig({ read: "deny" })

      // User override comes after base rules, so it wins
      const merged = PermissionNext.merge(baseRuleset, userOverride)

      // Verify the override took effect (last match wins)
      expect(PermissionNext.evaluate("read", "*", merged).action).toBe("deny")
    },
  })
})