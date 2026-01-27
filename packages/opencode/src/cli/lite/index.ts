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
import { MCP } from "../../mcp"
import { Command } from "../../command"
import type { ChatChunk } from "./session"
import { createLiveBlock } from "./liveblock"
import { summarizeInput } from "./summary"
import { wrap } from "./wrap"
import * as Panel from "./panel"
import * as Commands from "./commands"
import { setBlockFreeze } from "./select"
export { summarizeInput }

// UI Constants
const PAD = "  "
const MAX_WIDTH = Math.min(100, (process.stdout.columns || 80) - 4)

function padLines(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `${PAD}${line}` : line))
    .join("\n")
}

// UI State
let tasksVisible = false
let isOperationInProgress = false
let currentSessionID: string | null = null
let currentModel: string | null = null
let currentAgent: string | undefined

// Live block for tool/task display
const block = createLiveBlock()

// Set block freeze function for select
setBlockFreeze(() => block.freeze())

async function main() {
  if (!process.stdin.isTTY) {
    console.error("oclite requires a TTY")
    process.exit(1)
  }

  await Global.init()
  await Log.init({
    print: false,
    dev: false,
    level: "ERROR",
  })

  function cleanup() {
    block.freeze()
    write(cursor.show)
    process.stdin.setRawMode(false)
  }

  process.on("exit", cleanup)
  process.on("SIGINT", () => {
    cleanup()
    process.exit(0)
  })

  write("\x1b[2J\x1b[H")
  write(`${fg.brightCyan}${style.bold}oclite${style.reset} ${fg.gray}v0.1.0${style.reset}\n`)

  const setup = new Spinner("Setting up environment")
  setup.start()

  try {
    await bootstrap(process.cwd(), async () => {
      await Promise.all([Provider.list(), Agent.list(), MCP.clients()])

      setup.stop(true)
      write(`${fg.green}✓${style.reset} Ready\n\n`)

      currentAgent = await Agent.defaultAgent()
      const agentList = await Agent.list()

      write(`${fg.gray}Type /help for commands, Shift+Tab to cycle agents, Ctrl+C to exit${style.reset}\n\n`)

      const editor = new LineEditor()
      process.stdin.setRawMode(true)
      process.stdin.resume()

      editor.render(renderPrompt(currentAgent))

      process.stdin.on("data", async (data: Buffer) => {
        const key = parseKey(data)

        if (key.ctrl && key.name === "c") {
          cleanup()
          process.exit(0)
        }

        if (key.name === "shift_tab") {
          const available = agentList.filter((a) => a.mode !== "subagent" && !a.hidden)
          const index = available.findIndex((a) => a.name === currentAgent)
          const next = index === -1 ? 0 : (index + 1) % available.length
          currentAgent = available[next].name
          write(`\r${clear.line}`)
          editor.render(renderPrompt(currentAgent))
          return
        }

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

        if (isOperationInProgress) {
          return
        }

        if (key.ctrl && key.name === "x") {
          Panel.enterNavigationMode()
          return
        }

        if (Panel.isInNavigationMode()) {
          if (key.name === "escape") {
            Panel.exitNavigationMode()
            editor.render(renderPrompt(currentAgent))
            return
          }

          let direction: "left" | "right" | "up" | null = null

          if (key.name === "left" || key.name === "h") {
            direction = "left"
          } else if (key.name === "right" || key.name === "l") {
            direction = "right"
          } else if (key.name === "up" || key.name === "k") {
            direction = "up"
          }

          if (direction) {
            const navigated = Panel.navigate(direction)

            if (navigated) {
              await Panel.renderPanel()
              const hint = Panel.getHint()
              if (hint) {
                write(`\n${hint}\n`)
              }
              write(clear.screen)
              write(cursor.home)
            }
          }

          Panel.exitNavigationMode()
          editor.render(renderPrompt(currentAgent))
          return
        }

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
  } catch (err) {
    setup.stop(false)
    write(cursor.show)
    const msg = err instanceof Error ? err.message : String(err)
    write(`\n${fg.red}Error: ${msg}${style.reset}\n`)
    process.exit(1)
  }
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
    const state = { currentSessionID, currentModel, currentAgent }
    const setState = {
      setSessionID: (id: string | null) => {
        currentSessionID = id
      },
      setModel: (model: string | null) => {
        currentModel = model
      },
      setAgent: (agent: string | undefined) => {
        currentAgent = agent
      },
    }
    await Commands.handleSessions(state, setState, Panel.setParentSession)
    return
  }

  if (name === "new") {
    const setState = {
      setSessionID: (id: string | null) => {
        currentSessionID = id
      },
      setModel: (model: string | null) => {
        currentModel = model
      },
      setAgent: (agent: string | undefined) => {
        currentAgent = agent
      },
    }
    await Commands.handleNew(setState, Panel.setParentSession)
    return
  }

  if (name === "agents") {
    const state = { currentSessionID, currentModel, currentAgent }
    const setState = {
      setSessionID: (id: string | null) => {
        currentSessionID = id
      },
      setModel: (model: string | null) => {
        currentModel = model
      },
      setAgent: (agent: string | undefined) => {
        currentAgent = agent
      },
    }
    await Commands.handleAgents(state, setState)
    return
  }

  if (name === "models") {
    const setState = {
      setSessionID: (id: string | null) => {
        currentSessionID = id
      },
      setModel: (model: string | null) => {
        currentModel = model
      },
      setAgent: (agent: string | undefined) => {
        currentAgent = agent
      },
    }
    await Commands.handleModels(setState)
    return
  }

  if (name === "subagent-model") {
    await Commands.handleSubagentModel()
    return
  }

  const custom = await Command.get(name)
  if (custom) {
    const args = cmd.slice(1 + name.length).trim()
    await Commands.handleCustomCommand(
      custom.name,
      args,
      command,
      streamResponse,
      { currentSessionID, currentModel, currentAgent },
      (inProgress: boolean) => {
        isOperationInProgress = inProgress
      },
      () => block.freeze(),
    )
    return
  }

  write(`${fg.red}Unknown command: ${cmd}${style.reset}\n\n`)
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
  let lastToolId = ""
  let lastToolKey = ""
  let dedupCount = 0
  const idMap = new Map<string, string>()
  const md = createMarkdownRenderer()

  try {
    for await (const chunk of source) {
      if (chunk.type === "start" && chunk.sessionID && !currentSessionID) {
        currentSessionID = chunk.sessionID
      }

      if (first && chunk.type !== "done" && chunk.type !== "start") {
        spinner.stop(true)
        first = false
        write(`${PAD}${fg.gray}(Esc to cancel)${style.reset}\n`)
        const rule = `${PAD}${style.dim}${"─".repeat(Math.min(process.stdout.columns || 80, 80))}${style.reset}\n`
        write(rule)
      }

      if (chunk.type === "text" && chunk.content) {
        block.freeze()
        lastToolKey = ""
        dedupCount = 0
        lastChunkType = "text"
        const rendered = md.render(chunk.content)
        const wrapped = wrap(rendered, MAX_WIDTH)
        write(padLines(wrapped))
      }

      if (chunk.type === "tool_start" && chunk.tool?.trim()) {
        const tool = chunk.tool.trim()
        const arg = summarizeInput(tool, chunk.input)
        const summary = arg || ""
        const key = `${tool}:${summary}`

        if (key === lastToolKey) {
          dedupCount++
          const label = dedupCount > 1 ? `${summary} (×${dedupCount})` : summary
          block.toolStart(lastToolId, tool, label)
          if (chunk.callID) idMap.set(chunk.callID, lastToolId)
        } else {
          const id = chunk.callID || `${tool}-${++toolCounter}`
          lastToolId = id
          lastToolKey = key
          dedupCount = 1
          block.toolStart(id, tool, summary)
          if (chunk.callID) idMap.set(chunk.callID, id)
        }
        lastChunkType = "tool"
      }

      if (chunk.type === "tool_end" && chunk.tool?.trim()) {
        const tool = chunk.tool.trim()
        const arg = summarizeInput(tool, chunk.input)
        const summary = arg || ""
        const key = `${tool}:${summary}`

        const id = (chunk.callID && idMap.get(chunk.callID)) || chunk.callID || `${tool}-${toolCounter}`

        if (key === lastToolKey) {
          const label = dedupCount > 1 ? `${summary} (×${dedupCount})` : summary
          block.toolEnd(id, tool, label)
        } else {
          block.toolEnd(id, tool, summary)
        }
        lastChunkType = "tool"

        if (chunk.input && tool === "todowrite") {
          if (!Array.isArray(chunk.input.todos)) continue

          const valid = ["pending", "in_progress", "completed", "cancelled"]
          const priorities = ["high", "medium", "low"]

          const todos = chunk.input.todos
            .filter(
              (item) =>
                item &&
                typeof item === "object" &&
                typeof item.id === "string" &&
                typeof item.content === "string" &&
                typeof item.status === "string" &&
                valid.includes(item.status) &&
                typeof item.priority === "string" &&
                priorities.includes(item.priority),
            )
            .map((item) => ({
              id: item.id,
              content: item.content,
              status: item.status,
              priority: item.priority,
            }))

          if (todos.length > 0) block.setTodos(todos)
        }

        if (tool === "task" && chunk.metadata) {
          const childSessionID = chunk.metadata.sessionId as string | undefined
          if (childSessionID && typeof childSessionID === "string") {
            Panel.addChild(childSessionID)
          }
        }
      }

      if (chunk.type === "error" && chunk.content) {
        block.freeze()
        lastToolKey = ""
        dedupCount = 0
        lastChunkType = "error"
        const safeContent = chunk.content
          .replace(/\x1b\][^\x07]*\x07/g, "")
          .replace(/\x1b[\[\]()#?]*[0-9;]*[A-Za-z]/g, "")
          .replace(/[\x00-\x1f\x7f]/g, "")
        write(`\n${PAD}${fg.red}Error: ${safeContent}${style.reset}\n`)
      }

      if (chunk.tokens !== undefined) {
        totalTokens += chunk.tokens
      }
    }

    block.freeze()
    write(md.flush())
    const rule = `\n${PAD}${style.dim}${"─".repeat(Math.min(process.stdout.columns || 80, 80))}${style.reset}\n`
    write(rule)
    const duration = Date.now() - startTime
    write(`${PAD}${fg.gray}${formatDuration(duration)} · ${formatTokens(totalTokens)}${style.reset}\n`)
  } finally {
    spinner.stop(true)
  }

  write("\n")
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
