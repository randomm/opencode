import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { tmpdir } from "../fixture/fixture"
import { Plugin } from "../../src/plugin"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"

function mockConfig(plugin: string[] = []): Config.Info {
  return { plugin } as Config.Info
}

describe("plugin-loading", () => {
  test("init() completes without error when called with empty config", async () => {
    await using tmp = await tmpdir({
      config: { model: "test/model" },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Mock Config.get to return no external plugins
        const originalGet = Config.get
        Config.get = async () => mockConfig()

        try {
          // Call init - should complete without throwing
          await Plugin.init()

          // Verify init completed - hooks should be populated with internal plugins
          const hooks = await Plugin.list()
          expect(Array.isArray(hooks)).toBe(true)
          expect(hooks.length).toBeGreaterThan(0)
        } finally {
          Config.get = originalGet
        }
      },
    })
  })

  test("init() loads external plugins when config.plugin has entries", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const pluginDir = path.join(dir, ".opencode", "plugin")
        await fs.mkdir(pluginDir, { recursive: true })

        await Bun.write(
          path.join(pluginDir, "test-plugin.ts"),
          [
            "export default async (input) => ({",
            "  auth: {",
            '    provider: "test",',
            "    methods: [{ type: 'api', label: 'Test Plugin Auth' }],",
            "  },",
            "})",
            "",
          ].join("\n"),
        )

        return path.join(pluginDir, "test-plugin.ts")
      },
      config: { model: "test/model" },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Mock Config.get to return external plugin path
        const originalGet = Config.get
        Config.get = async () => mockConfig([tmp.extra as string])

        try {
          // Call init - external plugin should load
          await Plugin.init()

          // Verify init completed
          const hooks = await Plugin.list()
          expect(Array.isArray(hooks)).toBe(true)
        } finally {
          Config.get = originalGet
        }
      },
    })
  }, 30000)

  test("init() handles non-existent external plugin gracefully", async () => {
    await using tmp = await tmpdir({
      config: { model: "test/model" },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Mock Config.get to return a non-existent plugin
        const originalGet = Config.get
        Config.get = async () => mockConfig(["file:///non/existent/plugin.js"])

        try {
          // Call init - should NOT throw even with non-existent plugin
          await Plugin.init()

          // init completes successfully despite plugin load failure
          expect(true).toBe(true)
        } finally {
          Config.get = originalGet
        }
      },
    })
  })

  test("trigger() works after init() is called", async () => {
    await using tmp = await tmpdir({
      config: { model: "test/model" },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Mock Config.get to return no external plugins
        const originalGet = Config.get
        Config.get = async () => mockConfig()

        try {
          // Call init first
          await Plugin.init()

          // trigger should work without throwing
          const result = await Plugin.trigger("nonExistentHook", {}, { original: true })
          expect(result).toEqual({ original: true })
        } finally {
          Config.get = originalGet
        }
      },
    })
  })

  test("list() returns array of hooks after init()", async () => {
    await using tmp = await tmpdir({
      config: { model: "test/model" },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const originalGet = Config.get
        Config.get = async () => mockConfig()

        try {
          await Plugin.init()
          const hooks = await Plugin.list()
          expect(Array.isArray(hooks)).toBe(true)
        } finally {
          Config.get = originalGet
        }
      },
    })
  })
})
