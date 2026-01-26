#!/usr/bin/env bun
import { cursor, clear, fg, style, write, screen } from "./terminal"
import { parseKey, LineEditor } from "./input"
import { Spinner } from "./spinner"
import { chat } from "./session"
import { formatTokens, formatDuration } from "../metrics"
import { Icons } from "../cmd/tui/util/icons"
import { renderTaskPanel, type Task, type AgentStatus } from "./taskpanel"
import { renderStatusLine, type StatusLineState } from "./statusline"
import { renderBottomBar, renderPrompt, type BottomBarState } from "./bottombar"

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

async function main() {
  // Check TTY
  if (!process.stdin.isTTY) {
    console.error("oclite requires a TTY")
    process.exit(1)
  }

  // Setup
  write(screen.alt)
  write(clear.screen)
  write(cursor.home)

  // Header
  write(`${fg.brightCyan}${style.bold}oclite${style.reset} ${fg.gray}v0.1.0${style.reset}\n`)
  write(`${fg.gray}Type /help for commands, Ctrl+C to exit${style.reset}\n\n`)

  // Input setup
  const editor = new LineEditor()
  process.stdin.setRawMode(true)
  process.stdin.resume()

  // Render prompt
  editor.render(renderPrompt())

  // Handle input
  process.stdin.on("data", async (data: Buffer) => {
    const key = parseKey(data)

    // Ctrl+C to exit
    if (key.ctrl && key.name === "c") {
      cleanup()
      process.exit(0)
    }

    // Ctrl+T to toggle task panel
    if (key.ctrl && key.name === "t") {
      tasksVisible = !tasksVisible
      statusLine.tasksVisible = tasksVisible
      editor.render(renderPrompt())
    }

    const result = editor.handle(key)

    if (result !== null) {
      write("\n")

      if (result.startsWith("/")) {
        handleCommand(result)
      } else if (result.trim()) {
        await handleMessage(result)
      }

      editor.render(renderPrompt())
    } else {
      editor.render(renderPrompt())
    }
  })

  // Cleanup on exit
  function cleanup() {
    write(cursor.show)
    write(screen.main)
    process.stdin.setRawMode(false)
  }

  process.on("exit", cleanup)
  process.on("SIGINT", () => {
    cleanup()
    process.exit(0)
  })
}

function handleCommand(cmd: string) {
  const command = cmd.slice(1).toLowerCase().trim()

  if (command === "help") {
    write(`${fg.yellow}Commands:${style.reset}\n`)
    write(`  /help    - Show this help\n`)
    write(`  /clear   - Clear screen\n`)
    write(`  /quit    - Exit oclite\n`)
    write("\n")
    return
  }

  if (command === "clear") {
    write(clear.screen)
    write(cursor.home)
    write(`${fg.brightCyan}${style.bold}oclite${style.reset} ${fg.gray}v0.1.0${style.reset}\n\n`)
    return
  }

  if (command === "quit" || command === "exit") {
    process.exit(0)
  }

  write(`${fg.red}Unknown command: ${cmd}${style.reset}\n\n`)
}

async function handleMessage(message: string) {
  const spinner = new Spinner("Thinking")
  spinner.start()

  let first = true
  let totalTokens = 0
  const startTime = Date.now()

  try {
    for await (const chunk of chat(message)) {
      if (first) {
        spinner.stop(true)
        first = false
      }

      if (chunk.type === "text" && chunk.content) {
        write(chunk.content)
      }

      if (chunk.type === "tool_start" && chunk.tool?.trim()) {
        write(`\n${Icons.taskIcon("progress")} ${chunk.tool}\n`)
      }

      if (chunk.type === "tool_end" && chunk.tool?.trim()) {
        write(`${Icons.taskIcon("completed")} ${chunk.tool}\n`)
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
  } catch (err) {
    if (first) spinner.stop(false)
    const msg = err instanceof Error ? err.message : String(err)
    write(`\n${fg.red}Error: ${msg}${style.reset}\n`)
  }

  write("\n")
}

main().catch(console.error)
