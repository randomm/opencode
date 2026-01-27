#!/usr/bin/env bun
import { cursor, clear, fg, style, write, screen } from "./terminal"
import { parseKey, LineEditor } from "./input"
import { Spinner } from "./spinner"
import { chat, command } from "./session"
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
        statusLine.tasksVisible = tasksVisible
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
    write(`${fg.yellow}No models available${style.reset}\n\n`)
    return
  }

  const selected = await select(allModels, `${fg.cyan}Select a model:${style.reset}`)
  if (selected) {
    currentModel = selected
    write(`${fg.green}Model switched to ${selected}${style.reset}\n\n`)
  } else {
    write("\n")
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
    write(`${fg.yellow}No models available${style.reset}\n\n`)
    return
  }

  const selected = await select(allModels, `${fg.cyan}Select model for subagents:${style.reset}`)
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

async function handleCustomCommand(name: string, args: string) {
  const spinner = new Spinner("Thinking")
  spinner.start()

  let first = true
  let totalTokens = 0
  const startTime = Date.now()
  isOperationInProgress = true

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
          write(`${fg.gray}(Esc to cancel)${style.reset}\n`)
        }

        if (chunk.type === "text" && chunk.content) {
          write(chunk.content)
        }

        if (chunk.type === "tool_start" && chunk.tool?.trim()) {
          write(`${fg.gray}${chunk.tool?.trim()} ${style.reset}`)
        }

        if (chunk.type === "tool_end" && chunk.tool?.trim()) {
          write(`${fg.gray}✓${style.reset} `)
        }

        if (chunk.type === "error" && chunk.content) {
          const safeContent = chunk.content.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x1f\x7f]/g, "")
          write(`\n${fg.red}Error: ${safeContent}${style.reset}\n`)
        }

        if (chunk.tokens !== undefined) {
          totalTokens += chunk.tokens
        }
      }

      const duration = Date.now() - startTime
      write(`\n${fg.gray}${formatDuration(duration)} · ${formatTokens(totalTokens)}${style.reset}\n`)
    } finally {
      write(cursor.show)
    }
  } catch (err) {
    if (first) spinner.stop(false)
    const msg = err instanceof Error ? err.message : String(err)
    write(`\n${fg.red}Error: ${msg}${style.reset}\n`)
  } finally {
    isOperationInProgress = false
    currentSessionID = null
  }

  write("\n")
}

async function handleMessage(message: string) {
  const spinner = new Spinner("Thinking")
  spinner.start()

  let first = true
  let totalTokens = 0
  const startTime = Date.now()
  isOperationInProgress = true

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
          write(`${fg.gray}(Esc to cancel)${style.reset}\n`)
        }

        if (chunk.type === "text" && chunk.content) {
          write(chunk.content)
        }

        if (chunk.type === "tool_start" && chunk.tool?.trim()) {
          write(`${fg.gray}${chunk.tool?.trim()} ${style.reset}`)
        }

        if (chunk.type === "tool_end" && chunk.tool?.trim()) {
          write(`${fg.gray}✓${style.reset} `)
        }

        if (chunk.type === "error" && chunk.content) {
          const safeContent = chunk.content.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x1f\x7f]/g, "")
          write(`\n${fg.red}Error: ${safeContent}${style.reset}\n`)
        }

        if (chunk.tokens !== undefined) {
          totalTokens += chunk.tokens
        }
      }

      const duration = Date.now() - startTime
      write(`\n${fg.gray}${formatDuration(duration)} · ${formatTokens(totalTokens)}${style.reset}\n`)
    } finally {
      write(cursor.show)
    }
  } catch (err) {
    if (first) spinner.stop(false)
    const msg = err instanceof Error ? err.message : String(err)
    write(`\n${fg.red}Error: ${msg}${style.reset}\n`)
  } finally {
    isOperationInProgress = false
    currentSessionID = null
  }

  write("\n")
}

main().catch(console.error)
