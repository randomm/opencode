#!/usr/bin/env bun
import { cursor, clear, fg, style, write } from "./terminal"
import { parseKey, LineEditor } from "./input"
import { Spinner } from "./spinner"
import { chat, command } from "./session"
import { createMarkdownRenderer } from "./markdown"
import { formatTokens, formatDuration } from "../metrics"
import { renderPrompt } from "./bottombar"
import { bootstrap } from "../bootstrap"
import { Log } from "../../util/log"
import { Global } from "../../global"
import { SessionPrompt } from "../../session/prompt"
import { Session } from "../../session"
import { Provider } from "../../provider/provider"
import { Instance } from "../../project/instance"
import { Agent } from "../../agent/agent"
import { Command } from "../../command"
import { select } from "./select"
import type { ChatChunk } from "./session"
import { createLiveBlock } from "./liveblock"

export function summarizeInput(tool: string, input?: Record<string, unknown>): string {
  if (!input) return ""
  const str = (key: string) => String(input[key] || "")

  if (tool === "bash") return str("command").slice(0, 60)
  if (tool === "read") return str("filePath").split("/").slice(-2).join("/")
  if (tool === "write" || tool === "edit") return str("filePath").split("/").slice(-2).join("/")
  if (tool === "rg" || tool === "grep") {
    const pattern = str("pattern").slice(0, 30)
    const include = str("include")
    return include ? `"${pattern}" in ${include}` : `"${pattern}"`
  }
  if (tool === "glob") return str("pattern").slice(0, 60)
  if (tool === "task") {
    const agent = str("subagent_type")
    const desc = str("description").slice(0, 40)
    return agent ? `@${agent}: ${desc}` : desc
  }
  if (tool === "todowrite" || tool === "todoread") return "todo list"

  const first = Object.values(input).find((v) => typeof v === "string")
  return first ? String(first).slice(0, 60) : ""
}

// UI State
let tasksVisible = false
let isOperationInProgress = false
let currentSessionID: string | null = null
let currentModel: string | null = null
let currentAgent: string | undefined

// Live block for tool/task display
const block = createLiveBlock()

async function main() {
  // Check TTY
  if (!process.stdin.isTTY) {
    console.error("oclite requires a TTY")
    process.exit(1)
  }

  // Initialize logging to ERROR level to suppress debug/info logs
  // Must be done before bootstrap to prevent Log.Default.info() from being printed
  await Global.init()
  await Log.init({
    print: false,
    dev: false,
    level: "ERROR",
  })

  // Cleanup function
  function cleanup() {
    block.freeze()
    write(cursor.show)
    process.stdin.setRawMode(false)
  }

  // Register cleanup before bootstrap
  process.on("exit", cleanup)
  process.on("SIGINT", () => {
    cleanup()
    process.exit(0)
  })

  // Bootstrap with Instance context for current directory
  await bootstrap(process.cwd(), async () => {
    // Initialize default agent
    currentAgent = await Agent.defaultAgent()
    const agentList = await Agent.list()

    // Setup

    // Header
    write(`${fg.brightCyan}${style.bold}oclite${style.reset} ${fg.gray}v0.1.0${style.reset}\n`)
    write(`${fg.gray}Type /help for commands, Shift+Tab to cycle agents, Ctrl+C to exit${style.reset}\n\n`)

    // Input setup
    const editor = new LineEditor()
    process.stdin.setRawMode(true)
    process.stdin.resume()

    // Render prompt
    editor.render(renderPrompt(currentAgent))

    // Handle input
    process.stdin.on("data", async (data: Buffer) => {
      const key = parseKey(data)

      // Ctrl+C to exit
      if (key.ctrl && key.name === "c") {
        cleanup()
        process.exit(0)
      }

      // Shift+Tab to cycle agents
      if (key.name === "shift_tab") {
        const available = agentList.filter((a) => a.mode !== "subagent" && !a.hidden)
        const index = available.findIndex((a) => a.name === currentAgent)
        const next = index === -1 ? 0 : (index + 1) % available.length
        currentAgent = available[next].name
        write(`\r${clear.line}`)
        editor.render(renderPrompt(currentAgent))
        return
      }

      // Escape to cancel ongoing operation
      if (key.name === "escape" && isOperationInProgress && currentSessionID) {
        block.freeze()
        SessionPrompt.cancel(currentSessionID)
        isOperationInProgress = false
        currentSessionID = null
        write("\n")
        editor.line = ""
        editor.cursor = 0
        editor.render(renderPrompt(currentAgent))
        return
      }

      // Block further input during operation (except Escape and Ctrl+C which are handled above)
      if (isOperationInProgress) {
        return
      }

      // Ctrl+T to toggle task panel
      if (key.ctrl && key.name === "t") {
        tasksVisible = !tasksVisible
        editor.render(renderPrompt(currentAgent))
      }

      const result = editor.handle(key)

      if (result !== null) {
        write("\n")

        if (result.startsWith("/")) {
          await handleCommand(result)
        } else if (result.trim()) {
          await handleMessage(result)
        }

        editor.render(renderPrompt(currentAgent))
      } else {
        editor.render(renderPrompt(currentAgent))
      }
    })
  })
}

async function handleCommand(cmd: string) {
  const parts = cmd.slice(1).split(/\s+/)
  const name = parts[0].toLowerCase()

  if (name === "help") {
    write(`${fg.yellow}Commands:${style.reset}\n`)
    write(`  /help             - Show this help\n`)
    write(`  /clear            - Clear screen\n`)
    write(`  /sessions         - List and switch sessions\n`)
    write(`  /new              - Create a new session\n`)
    write(`  /agents           - List and select agents\n`)
    write(`  /models           - List and select models\n`)
    write(`  /subagent-model   - Select model for subagents\n`)
    write(`  /quit             - Exit oclite\n`)
    write(`  /<command>        - Run custom command\n`)
    write("\n")
    return
  }

  if (name === "clear") {
    write(clear.screen)
    write(cursor.home)
    write(`${fg.brightCyan}${style.bold}oclite${style.reset} ${fg.gray}v0.1.0${style.reset}\n\n`)
    return
  }

  if (name === "quit" || name === "exit") {
    process.exit(0)
  }

  if (name === "sessions") {
    await handleSessions()
    return
  }

  if (name === "new") {
    await handleNew()
    return
  }

  if (name === "agents") {
    await handleAgents()
    return
  }

  if (name === "models") {
    await handleModels()
    return
  }

  if (name === "subagent-model") {
    await handleSubagentModel()
    return
  }

  const custom = await Command.get(name)
  if (custom) {
    const args = cmd.slice(1 + name.length).trim()
    await handleCustomCommand(custom.name, args)
    return
  }

  write(`${fg.red}Unknown command: ${cmd}${style.reset}\n\n`)
}

async function handleSessions() {
  const sessions = await listSessions()
  if (sessions.length === 0) {
    write(`${fg.yellow}No sessions found${style.reset}\n\n`)
    return
  }

  const options = sessions.map((session) => ({
    label: session.title,
    value: session.id,
    description: new Date(session.time.created).toLocaleDateString(),
  }))

  const selected = await select(options, `${fg.cyan}Select a session:${style.reset}`)
  if (selected) {
    currentSessionID = selected
    write(`${fg.green}Session switched${style.reset}\n\n`)
  } else {
    write("\n")
  }
}

async function handleNew() {
  const session = await Session.createNext({
    directory: Instance.directory,
  })
  currentSessionID = session.id
  currentModel = null
  write(`${fg.green}New session started${style.reset}\n\n`)
}

async function handleAgents() {
  const all = await Agent.list()
  const filtered = all.filter((a) => a.mode !== "subagent" && !a.hidden)

  if (filtered.length === 0) {
    write(`${fg.red}No agents available${style.reset}\n\n`)
    return
  }

  const options = filtered.map((agent) => ({
    label: `${agent.name} — ${agent.description ?? ""}`,
    value: agent.name,
    current: agent.name === currentAgent,
  }))

  const selected = await select(options, `${fg.cyan}Select an agent:${style.reset}`)
  if (selected) {
    currentAgent = selected
    write(`${fg.green}Agent switched to ${selected}${style.reset}\n\n`)
  } else {
    write("\n")
  }
}

async function handleModels() {
  const models = await getAllModels()
  if (models.length === 0) {
    write(`${fg.yellow}No models available${style.reset}\n\n`)
    return
  }
  const selected = await select(models, `${fg.cyan}Select a model:${style.reset}`)
  if (selected) {
    currentModel = selected
    write(`${fg.green}Model switched to ${selected}${style.reset}\n\n`)
  } else {
    write("\n")
  }
}

async function handleSubagentModel() {
  const models = await getAllModels()
  if (models.length === 0) {
    write(`${fg.yellow}No models available${style.reset}\n\n`)
    return
  }
  const selected = await select(models, `${fg.cyan}Select model for subagents:${style.reset}`)
  if (selected) {
    process.env.SUBAGENT_MODEL = selected
    write(`${fg.green}Subagent model set to ${selected}${style.reset}\n\n`)
  } else {
    write("\n")
  }
}

async function listSessions(): Promise<Session.Info[]> {
  const sessions: Session.Info[] = []
  for await (const session of Session.list()) {
    sessions.push(session)
    if (sessions.length >= 10) break
  }
  return sessions.reverse()
}

async function getAllModels() {
  const providers = await Provider.list()
  const models: Array<{ label: string; value: string; description?: string }> = []
  for (const [providerID, provider] of Object.entries(providers)) {
    for (const [modelID, model] of Object.entries(provider.models)) {
      models.push({
        label: `${model.name} (${providerID})`,
        value: `${providerID}/${modelID}`,
        description: `${model.family || ""}${model.cost.input > 0 ? " • Paid" : " • Free"}`.trim(),
      })
    }
  }
  return models
}

interface StreamOptions {
  model?: string
  agent?: string
  sessionID?: string
}

async function streamResponse(source: AsyncIterable<ChatChunk>, options: StreamOptions) {
  block.reset()
  const spinner = new Spinner("Thinking")
  spinner.start()

  let first = true
  let totalTokens = 0
  const startTime = Date.now()
  let lastChunkType: string | null = null
  let toolCounter = 0
  const md = createMarkdownRenderer()

  try {
    for await (const chunk of source) {
      if (chunk.type === "start" && chunk.sessionID && !currentSessionID) {
        currentSessionID = chunk.sessionID
      }

      if (first && chunk.type !== "done" && chunk.type !== "start") {
        spinner.stop(true)
        first = false
        write(`${fg.gray}(Esc to cancel)${style.reset}\n`)
        const rule = `${style.dim}${"─".repeat(Math.min(process.stdout.columns || 80, 80))}${style.reset}\n`
        write(rule)
      }

      if (chunk.type === "text" && chunk.content) {
        block.freeze()
        lastChunkType = "text"
        write(md.render(chunk.content))
      }

      if (chunk.type === "tool_start" && chunk.tool?.trim()) {
        const tool = chunk.tool.trim()
        const arg = summarizeInput(tool, chunk.input)
        const id = chunk.callID || `${tool}-${++toolCounter}`
        const summary = arg ? `${tool}  ${arg}` : tool
        block.toolStart(id, tool, summary)
        lastChunkType = "tool"
      }

      if (chunk.type === "tool_end" && chunk.tool?.trim()) {
        const tool = chunk.tool.trim()
        const arg = summarizeInput(tool, chunk.input)
        const id = chunk.callID || `${tool}-${toolCounter}`
        const summary = arg ? `${tool}  ${arg}` : tool
        block.toolEnd(id, tool, summary)
        lastChunkType = "tool"
      }

      if (chunk.type === "error" && chunk.content) {
        block.freeze()
        lastChunkType = "error"
        const safeContent = chunk.content.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x1f\x7f]/g, "")
        write(`\n${fg.red}Error: ${safeContent}${style.reset}\n`)
      }

      if (chunk.tokens !== undefined) {
        totalTokens += chunk.tokens
      }
    }

    block.freeze()
    write(md.flush())
    const rule = `\n${style.dim}${"─".repeat(Math.min(process.stdout.columns || 80, 80))}${style.reset}\n`
    write(rule)
    const duration = Date.now() - startTime
    write(`${fg.gray}${formatDuration(duration)} · ${formatTokens(totalTokens)}${style.reset}\n`)
  } finally {
    spinner.stop(true)
  }

  write("\n")
}

async function handleCustomCommand(name: string, args: string) {
  const options = {
    model: currentModel || undefined,
    agent: currentAgent,
    sessionID: currentSessionID || undefined,
  }

  isOperationInProgress = true
  try {
    const source = command(name, args, options)
    await streamResponse(source, options)
  } catch (err) {
    block.freeze()
    const msg = err instanceof Error ? err.message : String(err)
    write(`\n${fg.red}Error: ${msg}${style.reset}\n\n`)
  } finally {
    isOperationInProgress = false
  }
}

async function handleMessage(message: string) {
  const options = {
    model: currentModel || undefined,
    agent: currentAgent,
    sessionID: currentSessionID || undefined,
  }

  isOperationInProgress = true
  try {
    const source = chat(message, options)
    await streamResponse(source, options)
  } catch (err) {
    block.freeze()
    const msg = err instanceof Error ? err.message : String(err)
    write(`\n${fg.red}Error: ${msg}${style.reset}\n\n`)
  } finally {
    isOperationInProgress = false
  }
}

main().catch(console.error)
