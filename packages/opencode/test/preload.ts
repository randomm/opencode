process.env["OPENCODE_DISABLE_GLOBAL_SKILLS"] = "true"
process.env["OPENCODE_DISABLE_DEFAULT_PLUGINS"] = "true"
process.env["OPENCODE_DISABLE_CLAUDE_CODE_SKILLS"] = "true"

// Set XDG dirs early to prevent real cache access
import os from "os"
import path from "path"
const dir = path.join(os.tmpdir(), "opencode-test-data-" + process.pid)
process.env["XDG_DATA_HOME"] = path.join(dir, "share")
process.env["XDG_CACHE_HOME"] = path.join(dir, "cache")
process.env["XDG_CONFIG_HOME"] = path.join(dir, "config")
process.env["XDG_STATE_HOME"] = path.join(dir, "state")

// Mock BunProc to prevent actual npm install during tests
// This MUST happen before any src/ imports
import { mock } from "bun:test"
mock.module("../src/bun/index", () => ({
  BunProc: {
    install: async (pkg: string, _version?: string) => {
      // Return the package name so import(pkg) resolves to the real module when
      // available (e.g. @aws-sdk/credential-providers in bedrock tests).
      // Plugin loading in plugin/index.ts skips empty strings via `if (!plugin) continue`,
      // but provider code does `import(await BunProc.install(...))` directly.
      return pkg
    },
    run: async () => {
      throw new Error("BunProc.run should not be called in tests")
    },
    which: () => process.execPath,
    InstallFailedError: class extends Error {},
  },
}))

// Mock builtin plugins to prevent import errors
const mockPlugin = () => ({})
mock.module("opencode-copilot-auth", () => ({ default: mockPlugin }))
mock.module("opencode-anthropic-auth", () => ({ default: mockPlugin }))
mock.module("@gitlab/opencode-gitlab-auth", () => ({ default: mockPlugin }))

// Mock optional SDK dependencies that aren't installed but are dynamically imported
mock.module("@aws-sdk/credential-providers", () => ({
  fromNodeProviderChain: (_opts?: Record<string, unknown>) => async () => ({
    accessKeyId: "test",
    secretAccessKey: "test",
  }),
}))

// Mock cowsay for tool registry tests that use it as an external dependency
mock.module("cowsay", () => ({
  say: ({ text }: { text: string }) => `< ${text} >`,
}))

// NOW load main preload (after env vars are set)
import "../preload"

// Rest of test setup
import fs from "fs/promises"
import fsSync from "fs"
import { afterAll } from "bun:test"

await fs.mkdir(dir, { recursive: true })
afterAll(() => {
  fsSync.rmSync(dir, { recursive: true, force: true })
})
// Set test home directory to isolate tests from user's actual home directory
// This prevents tests from picking up real user configs/skills from ~/.claude/skills
const testHome = path.join(dir, "home")
await fs.mkdir(testHome, { recursive: true })
process.env["OPENCODE_TEST_HOME"] = testHome

// Create the global config directory that Global.Path.config resolves to.
// Without this, Bun.Glob.scan() in Config.state() throws ENOENT (with a null byte
// appended to the path) when scanning for commands/agents/plugins in a missing directory.
await fs.mkdir(path.join(testHome, ".config", "opencode"), { recursive: true })

// Set test managed config directory to isolate tests from system managed settings
const testManagedConfigDir = path.join(dir, "managed")
process.env["OPENCODE_TEST_MANAGED_CONFIG_DIR"] = testManagedConfigDir
process.env["OPENCODE_MODELS_PATH"] = path.join(import.meta.dir, "tool", "fixtures", "models-api.json")

// Write the cache version file to prevent global/index.ts from clearing the cache
const cacheDir = path.join(dir, "cache", "opencode")
await fs.mkdir(cacheDir, { recursive: true })
await fs.writeFile(path.join(cacheDir, "version"), "18")

// Clear config env vars to prevent loading user's personal config during tests
delete process.env["OPENCODE_CONFIG"]
delete process.env["OPENCODE_CONFIG_CONTENT"]

// Clear provider env vars to ensure clean test state
delete process.env["ANTHROPIC_API_KEY"]
delete process.env["OPENAI_API_KEY"]
delete process.env["GOOGLE_API_KEY"]
delete process.env["GOOGLE_GENERATIVE_AI_API_KEY"]
delete process.env["AZURE_OPENAI_API_KEY"]
delete process.env["AWS_ACCESS_KEY_ID"]
delete process.env["AWS_PROFILE"]
delete process.env["AWS_REGION"]
delete process.env["AWS_BEARER_TOKEN_BEDROCK"]
delete process.env["OPENROUTER_API_KEY"]
delete process.env["GROQ_API_KEY"]
delete process.env["MISTRAL_API_KEY"]
delete process.env["PERPLEXITY_API_KEY"]
delete process.env["TOGETHER_API_KEY"]
delete process.env["XAI_API_KEY"]
delete process.env["DEEPSEEK_API_KEY"]
delete process.env["FIREWORKS_API_KEY"]
delete process.env["CEREBRAS_API_KEY"]
delete process.env["SAMBANOVA_API_KEY"]

// Now safe to import from src/
const { Log } = await import("../src/util/log")

Log.init({
  print: false,
  dev: true,
  level: "DEBUG",
})
