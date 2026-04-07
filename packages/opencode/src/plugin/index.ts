import type { Hooks, PluginInput, Plugin as PluginInstance } from "@opencode-ai/plugin"
import { Log } from "../util/log"
import { Flag } from "../flag/flag"
import { CodexAuthPlugin } from "./codex"
import { Session } from "../session"
import { NamedError } from "@opencode-ai/util/error"
import { CopilotAuthPlugin } from "./github-copilot/copilot"
import { PluginLoader } from "./loader"
import { errorMessage } from "@/util/error"

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
    if (!isServerPlugin((value as any).server)) return
    return (value as any).server
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
    log.info("plugin system stub - init called")
  }

  export async function trigger<Output>(name: string, input: unknown, output: Output): Promise<Output> {
    for (const hook of hooks) {
      const fn = (hook as any)[name]
      if (fn) await fn(input, output)
    }
    return output
  }

  export async function list(): Promise<Hooks[]> {
    return hooks
  }
}
