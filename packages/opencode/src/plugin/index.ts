import type { Hooks, PluginInput, Plugin as PluginInstance, PluginModule } from "@opencode-ai/plugin"
import { $ } from "bun"
import { Log } from "../util/log"
import { Flag } from "../flag/flag"
import { CodexAuthPlugin } from "./codex"
import { CopilotAuthPlugin } from "./github-copilot/copilot"
import { PluginLoader } from "./loader"
import { Config } from "../config/config"
import { Server } from "../server/server"
import { Instance } from "../project/instance"
import { createOpencodeClient } from "@opencode-ai/sdk"

export namespace Plugin {
  const log = Log.create({ service: "plugin" })

  // Built-in plugins that are directly imported (not installed from npm)
  const INTERNAL_PLUGINS: PluginInstance[] = [CodexAuthPlugin, CopilotAuthPlugin]

  function isServerPlugin(value: unknown): value is PluginInstance {
    return typeof value === "function"
  }

  function getServerPlugin(value: unknown) {
    if (isServerPlugin(value)) return value
    if (!value || typeof value !== "object" || !("server" in value)) return
    const server = (value as PluginModule).server
    if (!isServerPlugin(server)) return
    return server
  }

  function getLegacyPlugins(mod: Record<string, unknown>) {
    const seen = new Set<unknown>()
    const result: PluginInstance[] = []

    for (const entry of Object.values(mod)) {
      if (seen.has(entry)) continue
      seen.add(entry)
      const plugin = getServerPlugin(entry)
      if (!plugin) throw new TypeError("Plugin export is not a function")
      result.push(plugin)
    }

    return result
  }

  // Simple hook storage
  let hooks: Hooks[] = []

  async function applyPlugin(load: PluginLoader.Loaded, input: PluginInput) {
    const mod = load.mod
    for (const server of getLegacyPlugins(mod)) {
      const hook = await server(input)
      hooks.push(hook)
    }
  }

  export async function init() {
    log.info("plugin init called")
    hooks = [] // Reset hooks to prevent accumulation on re-init

    const config = await Config.get()
    const client = createOpencodeClient({
      baseUrl: Server.url().origin,
      directory: Instance.directory,
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(input, init)
        return Server.App().fetch(request)
      },
    })

    const input: PluginInput = {
      client,
      project: Instance.project,
      worktree: Instance.worktree,
      directory: Instance.directory,
      serverUrl: Server.url(),
      $: $,
    }

    // Load built-in plugins (unless disabled via flag)
    if (!Flag.OPENCODE_DISABLE_DEFAULT_PLUGINS) {
      for (const plugin of INTERNAL_PLUGINS) {
        log.info("loading internal plugin", { name: plugin.name })
        const hook = await plugin(input)
        hooks.push(hook)
      }
    }

    // Load external plugins from config directories (e.g. ~/.config/opencode/plugins/*.js)
    if (config.plugin && config.plugin.length > 0) {
      const origins = config.plugin.map((spec) => ({ spec }))
      await PluginLoader.loadExternal({
        items: origins,
        kind: "server",
        finish: async (loaded) => {
          log.info("loaded external plugin", { spec: loaded.spec })
          await applyPlugin(loaded, input)
          return loaded
        },
        report: {
          error: (candidate, _retry, stage, error) => {
            log.error("failed to load external plugin", { spec: candidate.plan.spec, stage, error })
          },
        },
      })
    }
  }

  export async function trigger<Output>(name: string, input: unknown, output: Output): Promise<Output> {
    for (const hook of hooks) {
      const fn = hook[name as keyof Hooks] as ((input: unknown, output: unknown) => Promise<void>) | undefined
      if (fn) await fn(input, output)
    }
    return output
  }

  export async function list(): Promise<Hooks[]> {
    return hooks
  }
}
