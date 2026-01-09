import { describe, it, expect } from "bun:test"
import { ToolRegistry } from "../src/tool/registry"
import { Config } from "../src/config/config"
import { PermissionNext } from "../src/permission/next"

describe("ToolRegistry permission filtering", () => {
  it("filters tools based on global permissions", async () => {
    // Mock config with permission rules
    const mockConfig = {
      permission: {
        bash: {
          "gh*": "allow",
          "git log*": "allow",
          "git add*": "deny",
          "*": "deny",
        },
      },
    } as any

    // Spy on Config.get
    const originalGet = Config.get
    Config.get = () => Promise.resolve(mockConfig)

    try {
      // Get tools for git-agent
      const mockAgent = {
        name: "git-agent",
        permission: [], // No agent-specific permissions
      } as any

      const tools = await ToolRegistry.tools("opencode", mockAgent)

      // All tools should be filtered out since bash permissions are denied globally
      const toolIds = tools.map((t) => t.id)
      expect(toolIds).not.toContain("bash")
      expect(toolIds).toContain("read") // read should be allowed
      expect(toolIds).toContain("glob") // glob should be allowed
      expect(toolIds).toContain("grep") // grep should be allowed
    } finally {
      // Restore original Config.get
      Config.get = originalGet
    }
  })

  it("respects agent permissions over global permissions", async () => {
    // Mock config with global deny for bash
    const mockConfig = {
      permission: {
        bash: {
          "*": "deny",
        },
      },
    } as any

    // Spy on Config.get
    const originalGet = Config.get
    Config.get = () => Promise.resolve(mockConfig)

    try {
      // Get tools for git-agent with specific bash permissions
      const mockAgent = {
        name: "git-agent",
        permission: [
          { permission: "bash", pattern: "gh*", action: "allow" },
          { permission: "bash", pattern: "git log*", action: "allow" },
        ],
      } as any

      const tools = await ToolRegistry.tools("opencode", mockAgent)

      // Bash should be allowed due to agent permissions
      const toolIds = tools.map((t) => t.id)
      expect(toolIds).toContain("bash")
    } finally {
      // Restore original Config.get
      Config.get = originalGet
    }
  })

  it("preserves non-privileged tools", async () => {
    // Mock config with restrictive permissions
    const mockConfig = {
      permission: {
        bash: { "*": "deny" },
        edit: { "*": "deny" },
        write: { "*": "deny" },
      },
    } as any

    // Spy on Config.get
    const originalGet = Config.get
    Config.get = () => Promise.resolve(mockConfig)

    try {
      // Get tools for any agent
      const tools = await ToolRegistry.tools("opencode")

      const toolIds = tools.map((t) => t.id)

      // Non-privileged tools should always be available
      expect(toolIds).toContain("read")
      expect(toolIds).toContain("glob")
      expect(toolIds).toContain("grep")
      expect(toolIds).toContain("webfetch")
      expect(toolIds).toContain("skill")
      expect(toolIds).toContain("task")

      // Privileged tools should be filtered out
      expect(toolIds).not.toContain("bash")
      expect(toolIds).not.toContain("edit")
      expect(toolIds).not.toContain("write")
    } finally {
      // Restore original Config.get
      Config.get = originalGet
    }
  })
})
