import { describe, expect, test } from "bun:test"
import path from "path"
import { SessionPrompt } from "../../src/session/prompt"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { Instance } from "../../src/project/instance"
import { Agent } from "../../src/agent/agent"
import { PermissionNext } from "../../src/permission/next"
import { Config } from "../../src/config/config"
import { Identifier } from "../../src/id/id"

const projectRoot = path.join(__dirname, "../..")

describe("Session permission inheritance and merging", () => {
  const createMockSession = async (parentID?: string, permissions?: PermissionNext.Ruleset) => {
    return await Session.create({
      parentID,
      title: "Test session",
      permission: permissions ?? [],
    })
  }

  const createMockAgent = async (permissions?: PermissionNext.Ruleset) => {
    const agent = await Agent.get("developer")
    return {
      ...agent,
      permission: permissions ?? [],
    } as Agent.Info
  }

  test("subagent inherits parent's session permissions by default", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const parentSession = await createMockSession(undefined, [
          { permission: "bash", pattern: "*", action: "allow" },
          { permission: "edit", pattern: "*", action: "deny" },
        ])

        const agent = await createMockAgent([])
        const childSession = await createMockSession(parentSession.id, [
          { permission: "read", pattern: "*", action: "allow" },
        ])

        // Child session should have parent permissions preserved
        expect(childSession.permission).toContainEqual({ permission: "bash", pattern: "*", action: "allow" })
        expect(childSession.permission).toContainEqual({ permission: "edit", pattern: "*", action: "deny" })
        expect(childSession.permission).toContainEqual({ permission: "read", pattern: "*", action: "allow" })
      },
    })
  })

  test("SessionPrompt.prompt() merges tools with existing permissions", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await createMockSession(undefined, [
          { permission: "bash", pattern: "*", action: "allow" },
          { permission: "edit", pattern: "*", action: "deny" },
        ])

        const agent = await createMockAgent([])

        // Prompt with additional tools should MERGE, not REPLACE
        await SessionPrompt.prompt({
          sessionID: session.id,
          agent: agent.name,
          parts: [{ type: "text", text: "Test prompt" }],
          tools: {
            read: true,
            write: false,
          },
        })

        const updatedSession = await Session.get(session.id)
        
        // Original permissions should be preserved
        expect(updatedSession.permission).toContainEqual({ permission: "bash", pattern: "*", action: "allow" })
        expect(updatedSession.permission).toContainEqual({ permission: "edit", pattern: "*", action: "deny" })
        
        // New tool permissions should be added
        expect(updatedSession.permission).toContainEqual({ permission: "read", pattern: "*", action: "allow" })
        expect(updatedSession.permission).toContainEqual({ permission: "write", pattern: "*", action: "deny" })
      },
    })
  })

  test("SessionPrompt.prompt() with empty tools preserves existing permissions", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await createMockSession(undefined, [
          { permission: "bash", pattern: "*", action: "allow" },
          { permission: "edit", pattern: "/tmp/*", action: "allow" },
        ])

        const agent = await createMockAgent([])

        // Prompt with empty tools should not affect permissions
        await SessionPrompt.prompt({
          sessionID: session.id,
          agent: agent.name,
          parts: [{ type: "text", text: "Test prompt" }],
          tools: {},
        })

        const updatedSession = await Session.get(session.id)
        
        // All original permissions should be preserved
        expect(updatedSession.permission).toEqual([
          { permission: "bash", pattern: "*", action: "allow" },
          { permission: "edit", pattern: "/tmp/*", action: "allow" },
        ])
      },
    })
  })

  test("SessionPrompt.prompt() without tools preserves existing permissions", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await createMockSession(undefined, [
          { permission: "bash", pattern: "git*", action: "allow" },
          { permission: "bash", pattern: "*", action: "deny" },
        ])

        const agent = await createMockAgent([])

        // Prompt without tools parameter should not affect permissions
        await SessionPrompt.prompt({
          sessionID: session.id,
          agent: agent.name,
          parts: [{ type: "text", text: "Test prompt" }],
        })

        const updatedSession = await Session.get(session.id)
        
        // All original permissions should be preserved
        expect(updatedSession.permission).toEqual([
          { permission: "bash", pattern: "git*", action: "allow" },
          { permission: "bash", pattern: "*", action: "deny" },
        ])
      },
    })
  })

  test("Task tool respects configured agent permission blocks", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const parentSession = await createMockSession(undefined, [
          { permission: "task", pattern: "forbidden-agent", action: "deny" },
          { permission: "task", pattern: "allowed-agent", action: "allow" },
        ])

        // Test that task tool filtering respects session permissions
        const ruleset = PermissionNext.evaluate("task", "forbidden-agent", parentSession.permission!)
        expect(ruleset.action).toBe("deny")

        const allowedRuleset = PermissionNext.evaluate("task", "allowed-agent", parentSession.permission!)
        expect(allowedRuleset.action).toBe("allow")
      },
    })
  })

  test("Complex inheritance scenario: parent + agent + tools", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const parentSession = await createMockSession(undefined, [
          { permission: "bash", pattern: "*", action: "deny" },
          { permission: "read", pattern: "*.md", action: "allow" },
        ])

        const agent = await createMockAgent([
          { permission: "read", pattern: "*", action: "allow" },
        ])

        // Create child session with inherited permissions
        const childSession = await createMockSession(parentSession.id, [
          { permission: "write", pattern: "/tmp/*", action: "allow" },
        ])

        // Prompt with additional tools should merge all permissions
        await SessionPrompt.prompt({
          sessionID: childSession.id,
          agent: agent.name,
          parts: [{ type: "text", text: "Test prompt" }],
          tools: {
            git: true, // Should be allowed
            deploy: false, // Should be denied
          },
        })

        const finalSession = await Session.get(childSession.id)
        
        // Parent permissions should be inherited
        expect(finalSession.permission).toContainEqual({ permission: "bash", pattern: "*", action: "deny" })
        expect(finalSession.permission).toContainEqual({ permission: "read", pattern: "*.md", action: "allow" })
        
        // Child session permissions should be preserved
        expect(finalSession.permission).toContainEqual({ permission: "write", pattern: "/tmp/*", action: "allow" })
        
        // Agent permissions should be merged
        expect(finalSession.permission).toContainEqual({ permission: "read", pattern: "*", action: "allow" })
        
        // Tool permissions from prompt should be added
        expect(finalSession.permission).toContainEqual({ permission: "git", pattern: "*", action: "allow" })
        expect(finalSession.permission).toContainEqual({ permission: "deploy", pattern: "*", action: "deny" })
      },
    })
  })

  test("Permission inheritance works with wildcard patterns", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const parentSession = await createMockSession(undefined, [
          { permission: "*", pattern: "*", action: "deny" },
          { permission: "git", pattern: "*", action: "allow" },
          { permission: "read", pattern: "*.txt", action: "allow" },
        ])

        // Create child session with specific allow overrides
        const childSession = await createMockSession(parentSession.id, [
          { permission: "bash", pattern: "*", action: "allow" },
        ])

        // Check permission evaluation follows inheritance rules
        expect(PermissionNext.evaluate("bash", "*", childSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("git", "*", childSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("read", "*.txt", childSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("write", "*", childSession.permission!).action).toBe("deny")
        
        // Prompt should not break inherited permission structure
        await SessionPrompt.prompt({
          sessionID: childSession.id,
          agent: "developer",
          parts: [{ type: "text", text: "Test" }],
          tools: { deploy: true },
        })

        const updatedSession = await Session.get(childSession.id)
        
        // Inherited permissions should still work
        expect(PermissionNext.evaluate("bash", "*", updatedSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("git", "*", updatedSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("deploy", "*", updatedSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("write", "*", updatedSession.permission!).action).toBe("deny")
      },
    })
  })

  test("Nested subagent permissions cascade correctly", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        // Create parent -> child -> grandchild hierarchy
        const parentSession = await createMockSession(undefined, [
          { permission: "bash", pattern: "*", action: "allow" },
        ])

        const childSession = await createMockSession(parentSession.id, [
          { permission: "edit", pattern: "*", action: "allow" },
        ])

        const grandchildSession = await createMockSession(childSession.id, [
          { permission: "read", pattern: "*", action: "allow" },
        ])

        // Grandchild should inherit all parent permissions
        expect(grandchildSession.permission).toContainEqual({ permission: "bash", pattern: "*", action: "allow" })
        expect(grandchildSession.permission).toContainEqual({ permission: "edit", pattern: "*", action: "allow" })
        expect(grandchildSession.permission).toContainEqual({ permission: "read", pattern: "*", action: "allow" })

        // Prompt on grandchild should preserve all inherited permissions
        await SessionPrompt.prompt({
          sessionID: grandchildSession.id,
          agent: "developer",
          parts: [{ type: "text", text: "Test" }],
          tools: { deploy: true },
        })

        const finalSession = await Session.get(grandchildSession.id)
        
        // All permissions should be preserved
        expect(PermissionNext.evaluate("bash", "*", finalSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("edit", "*", finalSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("read", "*", finalSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("deploy", "*", finalSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("write", "*", finalSession.permission!).action).toBe("deny") // Default deny
      },
    })
  })
})

describe("Permission integration with real session workflows", () => {
  test("Task tool creates session with proper permission inheritance", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const config = await Config.get()
        const agents = await Agent.list().then((x) => x.filter((a) => a.mode !== "primary"))
        const agent = agents.find((a) => a.name === "developer") ?? agents[0]

        // Create parent session with some permissions
        const parentSession = await Session.create({
          title: "Parent session",
          permission: [
            { permission: "bash", pattern: "*", action: "allow" },
            { permission: "edit", pattern: "*", action: "deny" },
          ],
        })

        // Task tool should create child session that inherits and merges permissions
        const taskSession = await Session.create({
          parentID: parentSession.id,
          title: "Task session",
          permission: PermissionNext.merge(
            agent.permission ?? [],
            [
              {
                permission: "todowrite",
                pattern: "*",
                action: "deny",
              },
              {
                permission: "todoread",
                pattern: "*",
                action: "deny",
              },
              {
                permission: "task",
                pattern: "*",
                action: "deny",
              },
              ...(config.experimental?.primary_tools?.map((t) => ({
                pattern: "*",
                action: "allow" as const,
                permission: t,
              })) ?? []),
            ],
          ),
        })

        // Should inherit from parent but also add task-specific restrictions
        expect(taskSession.permission).toContainEqual({ permission: "bash", pattern: "*", action: "allow" })
        expect(taskSession.permission).toContainEqual({ permission: "edit", pattern: "*", action: "deny" })
        expect(taskSession.permission).toContainEqual({ permission: "task", pattern: "*", action: "deny" })
      },
    })
  })

  test("Permission evaluation respects inheritance order (last match wins)", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const parentSession = await Session.create({
          title: "Parent session",
          permission: [
            { permission: "bash", pattern: "*", action: "deny" },
            { permission: "bash", pattern: "git*", action: "allow" },
          ],
        })

        const childSession = await Session.create({
          parentID: parentSession.id,
          title: "Child session",
          permission: [
            { permission: "bash", pattern: "*", action: "allow" }, // Should override parent's deny
            { permission: "bash", pattern: "rm*", action: "deny" },
          ],
        })

        // Child's wildcard allow should override parent's wildcard deny
        expect(PermissionNext.evaluate("bash", "git-status", childSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("bash", "ls", childSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("bash", "rm-file", childSession.permission!).action).toBe("deny")
        
        // SessionPrompt should maintain this order
        await SessionPrompt.prompt({
          sessionID: childSession.id,
          agent: "developer",
          parts: [{ type: "text", text: "Test" }],
          tools: { deploy: true },
        })

        const updatedSession = await Session.get(childSession.id)
        expect(PermissionNext.evaluate("bash", "git-status", updatedSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("bash", "ls", updatedSession.permission!).action).toBe("allow")
        expect(PermissionNext.evaluate("bash", "rm-file", updatedSession.permission!).action).toBe("deny")
        expect(PermissionNext.evaluate("deploy", "*", updatedSession.permission!).action).toBe("allow")
      },
    })
  })
})