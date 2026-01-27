#!/usr/bin/env bun
import { cursor, clear, fg, style, write, screen } from "./terminal"
import { parseKey, LineEditor } from "./input"
import { Spinner } from "./spinner"
import { chat, command } from "./session"
import { createMarkdownRenderer } from "./markdown"
import { createLayout } from "./layout"
import { formatTokens, formatDuration } from "../metrics"
import { Icons } from "../cmd/tui/util/icons"
import { type Task, type AgentStatus } from "./taskpanel"
import { renderStatusLine, type StatusLineState } from "./statusline"
import { renderPrompt, type BottomBarState } from "./bottombar"
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
let tasks: Task[] = []
let agents: AgentStatus[] = []
let statusLine: StatusLineState = {
  activity: "Idle",
  duration: 0,
  tokens: 0,
  tasksVisible: false,
}
let bottomBar: BottomBarState = {
  permissionMode: "ask",
  fileChanges: {
    total: 0,
    added: 0,
    removed: 0,
  },
}
let isOperationInProgress = false
let currentSessionID: string | null = null
let currentModel: string | null = null
let currentAgent: string | undefined
let layout = createLayout()
let resizePending = false

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
    layout.cleanup()
    process.stdin.setRawMode(false)
  }

  // Register cleanup before bootstrap
  process.on("exit", cleanup)
  process.on("SIGINT", () => {
    cleanup()
    process.exit(0)
  })

  process.on("SIGWINCH", () => {
    resizePending = true
  })

  // Bootstrap with Instance context for current directory
  await bootstrap(process.cwd(), async () => {
    // Initialize default agent
    currentAgent = await Agent.defaultAgent()
    const agentList = await Agent.list()

    // Setup
    layout.setup()

    // Header
    layout.write(`${fg.brightCyan}${style.bold}oclite${style.reset} ${fg.gray}v0.1.0${style.reset}\n`)
    layout.write(`${fg.gray}Type /help for commands, Shift+Tab to cycle agents, Ctrl+C to exit${style.reset}\n\n`)

    // Input setup
    const editor = new LineEditor()
    process.stdin.setRawMode(true)
    process.stdin.resume()

    layout.setHint("Esc cancel · Shift+Tab agents · /help commands")
    layout.focusInput(renderPrompt(currentAgent))

    // Handle input
    process.stdin.on("data", async (data: Buffer) => {
      if (resizePending) {
        resizePending = false
        layout.resize()
      }

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
        layout.focusInput(renderPrompt(currentAgent))
        return
      }

      // Escape to cancel ongoing operation
      if (key.name === "escape" && isOperationInProgress && currentSessionID) {
        SessionPrompt.cancel(currentSessionID)
        isOperationInProgress = false
        currentSessionID = null
        layout.write("\n")
        editor.line = ""
        editor.cursor = 0
        layout.focusInput(renderPrompt(currentAgent))
        return
      }

      // Block further input during operation (except Escape and Ctrl+C which are handled above)
      if (isOperationInProgress) {
        return
      }

      // Ctrl+T to toggle task panel
      if (key.ctrl && key.name === "t") {
        tasksVisible = !tasksVisible
        statusLine.tasksVisible = tasksVisible
        layout.focusInput(renderPrompt(currentAgent))
      }

      const result = editor.handle(key)

      if (result !== null) {
        layout.write("\n")

        if (result.startsWith("/")) {
          await handleCommand(result)
        } else if (result.trim()) {
          await handleMessage(result)
        }

        layout.focusInput(renderPrompt(currentAgent))
      } else {
        layout.focusInput(renderPrompt(currentAgent))
      }
    })
  })
}

async function handleCommand(cmd: string) {
  const parts = cmd.slice(1).split(/\s+/)
  const name = parts[0].toLowerCase()

  if (name === "help") {
    layout.write(`${fg.yellow}Commands:${style.reset}\n`)
    layout.write(`  /help             - Show this help\n`)
    layout.write(`  /clear            - Clear screen\n`)
    layout.write(`  /sessions         - List and switch sessions\n`)
    layout.write(`  /new              - Create a new session\n`)
    layout.write(`  /agents           - List and select agents\n`)
    layout.write(`  /models           - List and select models\n`)
    layout.write(`  /subagent-model   - Select model for subagents\n`)
    layout.write(`  /quit             - Exit oclite\n`)
    layout.write(`  /<command>        - Run custom command\n`)
    layout.write("\n")
    return
  }

  if (name === "clear") {
    write(clear.screen)
    write(cursor.home)
    layout.setup()
    layout.write(`${fg.brightCyan}${style.bold}oclite${style.reset} ${fg.gray}v0.1.0${style.reset}\n\n`)
    layout.setHint("Esc cancel · Shift+Tab agents · /help commands")
    layout.focusInput(renderPrompt(currentAgent))
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

  layout.write(`${fg.red}Unknown command: ${cmd}${style.reset}\n\n`)
}

async function handleSessions() {
  const sessions = await listSessions()
  if (sessions.length === 0) {
    layout.write(`${fg.yellow}No sessions found${style.reset}\n\n`)
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
    layout.write(`${fg.green}Session switched${style.reset}\n\n`)
  } else {
    layout.write("\n")
  }
}

async function handleNew() {
  const session = await Session.createNext({
    directory: Instance.directory,
  })
  currentSessionID = session.id
  currentModel = null
  layout.write(`${fg.green}New session started${style.reset}\n\n`)
}

async function handleAgents() {
  const all = await Agent.list()
  const filtered = all.filter((a) => a.mode !== "subagent" && !a.hidden)

  if (filtered.length === 0) {
    layout.write(`${fg.red}No agents available${style.reset}\n\n`)
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
    layout.write(`${fg.green}Agent switched to ${selected}${style.reset}\n\n`)
  } else {
    layout.write("\n")
  }
}

async function handleModels() {
  const providers = await Provider.list()
  const allModels: Array<{
    label: string
    value: string
    description?: string
  }> = []

  for (const [providerID, provider] of Object.entries(providers)) {
    for (const [modelID, model] of Object.entries(provider.models)) {
      allModels.push({
        label: `${model.name} (${providerID})`,
        value: `${providerID}/${modelID}`,
        description: `${model.family || ""}${model.cost.input > 0 ? " • Paid" : " • Free"}`.trim(),
      })
    }
  }

  if (allModels.length === 0) {
    layout.write(`${fg.yellow}No models available${style.reset}\n\n`)
    return
  }

  const selected = await select(allModels, `${fg.cyan}Select a model:${style.reset}`)
  if (selected) {
    currentModel = selected
    layout.write(`${fg.green}Model switched to ${selected}${style.reset}\n\n`)
  } else {
    layout.write("\n")
  }
}

async function handleSubagentModel() {
  const providers = await Provider.list()
  const allModels: Array<{
    label: string
    value: string
    description?: string
  }> = []

  for (const [providerID, provider] of Object.entries(providers)) {
    for (const [modelID, model] of Object.entries(provider.models)) {
      allModels.push({
        label: `${model.name} (${providerID})`,
        value: `${providerID}/${modelID}`,
        description: `${model.family || ""}${model.cost.input > 0 ? " • Paid" : " • Free"}`.trim(),
      })
    }
  }

  if (allModels.length === 0) {
    layout.write(`${fg.yellow}No models available${style.reset}\n\n`)
    return
  }

  const selected = await select(allModels, `${fg.cyan}Select model for subagents:${style.reset}`)
  if (selected) {
    process.env.SUBAGENT_MODEL = selected
    layout.write(`${fg.green}Subagent model set to ${selected}${style.reset}\n\n`)
  } else {
    layout.write("\n")
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

async function handleCustomCommand(name: string, args: string) {
  const spinner = new Spinner("Thinking")
  spinner.start((text) => {
    layout.setStatus(text)
  })

  let first = true
  let totalTokens = 0
  const startTime = Date.now()
  isOperationInProgress = true
  let lastChunkWasToolStart = false
  let lastToolSummary = ""
  const md = createMarkdownRenderer()

  try {
    const options = {
      model: currentModel || undefined,
      agent: currentAgent,
      sessionID: currentSessionID || undefined,
    }

    try {
      for await (const chunk of command(name, args, options)) {
        if (chunk.type === "start" && chunk.sessionID && !currentSessionID) {
          currentSessionID = chunk.sessionID
        }

        if (first && chunk.type !== "done" && chunk.type !== "start") {
          spinner.stop(true)
          first = false
          layout.setMode("scroll")
          layout.write(`${fg.gray}(Esc to cancel)${style.reset}\n`)
          layout.setHint("Esc to cancel")
        }

        if (chunk.type === "text" && chunk.content) {
          lastChunkWasToolStart = false
          layout.write(md.render(chunk.content))
        }

        if (chunk.type === "tool_start" && chunk.tool?.trim()) {
          const tool = chunk.tool.trim()
          lastToolSummary = summarizeInput(tool, chunk.input)
          const summary = lastToolSummary ? ` ${lastToolSummary}` : ""
          layout.write(`${fg.gray}◇ ${style.reset}${fg.cyan}${tool}${style.reset}${fg.gray}${summary}${style.reset}\n`)
          lastChunkWasToolStart = true
        }

        if (chunk.type === "tool_end" && chunk.tool?.trim()) {
          const tool = chunk.tool.trim()
          if (lastChunkWasToolStart && lastToolSummary === summarizeInput(tool, chunk.input)) {
            layout.write(
              `\x1b[1A\r\x1b[2K${fg.green}✓${style.reset} ${fg.cyan}${tool}${style.reset}${fg.gray}${lastToolSummary ? ` ${lastToolSummary}` : ""}${style.reset}\n`,
            )
          } else {
            layout.write(`${fg.green}✓${style.reset} ${fg.cyan}${tool}${style.reset}\n`)
          }
          lastChunkWasToolStart = false
        }

        if (chunk.type === "error" && chunk.content) {
          lastChunkWasToolStart = false
          const safeContent = chunk.content.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x1f\x7f]/g, "")
          layout.write(`\n${fg.red}Error: ${safeContent}${style.reset}\n`)
        }

        if (chunk.tokens !== undefined) {
          totalTokens += chunk.tokens
        }
      }

      if (resizePending) {
        resizePending = false
        layout.resize()
      }

      layout.write(md.flush())
      const duration = Date.now() - startTime
      layout.write(`\n${fg.gray}${formatDuration(duration)} · ${formatTokens(totalTokens)}${style.reset}\n`)
    } finally {
      layout.setStatus("")
    }
  } catch (err) {
    if (first) spinner.stop(false)
    const msg = err instanceof Error ? err.message : String(err)
    layout.write(`\n${fg.red}Error: ${msg}${style.reset}\n`)
  } finally {
    isOperationInProgress = false
    currentSessionID = null
    layout.setHint("Esc cancel · Shift+Tab agents · /help commands")
  }

  layout.write("\n")
}

async function handleMessage(message: string) {
  const spinner = new Spinner("Thinking")
  spinner.start((text) => {
    layout.setStatus(text)
  })

  let first = true
  let totalTokens = 0
  const startTime = Date.now()
  isOperationInProgress = true
  let lastChunkWasToolStart = false
  let lastToolSummary = ""
  const md = createMarkdownRenderer()

  try {
    const options = {
      model: currentModel || undefined,
      agent: currentAgent,
      sessionID: currentSessionID || undefined,
    }

    try {
      for await (const chunk of chat(message, options)) {
        if (chunk.type === "start" && chunk.sessionID && !currentSessionID) {
          currentSessionID = chunk.sessionID
        }

        if (first && chunk.type !== "done" && chunk.type !== "start") {
          spinner.stop(true)
          first = false
          layout.setMode("scroll")
          layout.write(`${fg.gray}(Esc to cancel)${style.reset}\n`)
          layout.setHint("Esc to cancel")
        }

        if (chunk.type === "text" && chunk.content) {
          lastChunkWasToolStart = false
          layout.write(md.render(chunk.content))
        }

        if (chunk.type === "tool_start" && chunk.tool?.trim()) {
          const tool = chunk.tool.trim()
          lastToolSummary = summarizeInput(tool, chunk.input)
          const summary = lastToolSummary ? ` ${lastToolSummary}` : ""
          layout.write(`${fg.gray}◇ ${style.reset}${fg.cyan}${tool}${style.reset}${fg.gray}${summary}${style.reset}\n`)
          lastChunkWasToolStart = true
        }

        if (chunk.type === "tool_end" && chunk.tool?.trim()) {
          const tool = chunk.tool.trim()
          if (lastChunkWasToolStart && lastToolSummary === summarizeInput(tool, chunk.input)) {
            layout.write(
              `\x1b[1A\r\x1b[2K${fg.green}✓${style.reset} ${fg.cyan}${tool}${style.reset}${fg.gray}${lastToolSummary ? ` ${lastToolSummary}` : ""}${style.reset}\n`,
            )
          } else {
            layout.write(`${fg.green}✓${style.reset} ${fg.cyan}${tool}${style.reset}\n`)
          }
          lastChunkWasToolStart = false
        }

        if (chunk.type === "error" && chunk.content) {
          lastChunkWasToolStart = false
          const safeContent = chunk.content.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x1f\x7f]/g, "")
          layout.write(`\n${fg.red}Error: ${safeContent}${style.reset}\n`)
        }

        if (chunk.tokens !== undefined) {
          totalTokens += chunk.tokens
        }
      }

      if (resizePending) {
        resizePending = false
        layout.resize()
      }

      layout.write(md.flush())
      const duration = Date.now() - startTime
      layout.write(`\n${fg.gray}${formatDuration(duration)} · ${formatTokens(totalTokens)}${style.reset}\n`)
    } finally {
      layout.setStatus("")
    }
  } catch (err) {
    if (first) spinner.stop(false)
    const msg = err instanceof Error ? err.message : String(err)
    layout.write(`\n${fg.red}Error: ${msg}${style.reset}\n`)
  } finally {
    isOperationInProgress = false
    currentSessionID = null
    layout.setHint("Esc cancel · Shift+Tab agents · /help commands")
  }

  layout.write("\n")
}

main().catch(console.error)
