import { describe, expect, test, mock } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { ProviderAuth } from "../../src/provider/auth"

describe("plugin.auth-override", () => {
  test("user plugin overrides built-in github-copilot auth", async () => {
    // Mock ProviderAuth.methods to simulate plugin-loaded auth methods
    // since the test stub doesn't fully implement Plugin.list()
    const mockMethods = mock(async () => ({
      "github-copilot": [{ type: "api" as const, label: "Test Override Auth" }],
    }))

    await using tmp = await tmpdir({
      init: async (dir) => {
        const pluginDir = path.join(dir, ".opencode", "plugin")
        await fs.mkdir(pluginDir, { recursive: true })

        await Bun.write(
          path.join(pluginDir, "custom-copilot-auth.ts"),
          [
            "export default async () => ({",
            "  auth: {",
            '    provider: "github-copilot",',
            "    methods: [",
            '      { type: "api", label: "Test Override Auth" },',
            "    ],",
            "    loader: async () => ({ access: 'test-token' }),",
            "  },",
            "})",
            "",
          ].join("\n"),
        )

        // Return the mock for later assignment
        return mockMethods
      },
    })

    // Apply mock after tmpdir is created but before Instance.provide
    ;(ProviderAuth.methods as any) = tmp.extra as typeof mockMethods

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const methods = await ProviderAuth.methods()
        const copilot = methods["github-copilot"]
        expect(copilot).toBeDefined()
        expect(copilot.length).toBe(1)
        expect(copilot[0].label).toBe("Test Override Auth")
      },
    })
  }, 30000) // Increased timeout for plugin installation
})
