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

import * as Panel from "./panel"
import * as Commands from "./commands"
import { setBlockFreeze } from "./select"
import { Bus } from "../../bus"
import { MessageV2 } from "../../session/message-v2"
import { SessionStatus } from "../../session/status"
import { theme } from "./theme"
import { createOpencodeClient, type Event } from "@opencode-ai/sdk/v2"
import { Server } from "../../server/server"

const log = Log.create({ service: "lite.run" })
export { summarizeInput }

// UI Constants
const PAD = "  "
const PERMISSION_DENIED_PATTERN = /permission\s*(denied|required|error)/i

interface TaskInput {
  subagent_type?: string
  description?: string
}
// Left margin: 2 chars (PAD)
// Right margin: 4 chars
// Total: 6 chars reserved for margins
const MAX_WIDTH = Math.max(60, (process.stdout.columns || 80) - 6)

function padLines(text: string): string {
  const lines = text.split("\n")
  const PAD = "  "
  let result = ""
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line) result += PAD + line
    if (i < lines.length - 1) result += "\n"
  }
  return result
}

// UI State
let isOperationInProgress = false
let currentSessionID: string | null = null
let currentModel: string | null = null
let currentAgent: string | undefined
let autoWakeupSessionID: string | null = null
let isAutoWakeupStreaming = false

// Live block for tool/task display
const block = createLiveBlock()

// Set block freeze function for select
setBlockFreeze(() => block.freeze())

// Track task callID to child session ID mapping (for Panel and cleanup)
const taskToChildSession = new Map<string, string>()

// Reverse mapping: child session ID → parent task callID
const childSessionToTask = new Map<string, string>()

// Buffer for child session events that arrive before mapping is established
// Trade-off: We accept the risk that entries may never be cleaned up if mapping is lost
// Timeout cleanup would add complexity without clear benefit in practice
const pendingChildEvents = new Map<string, Array<unknown>>()

// Store Bus subscription cleanup functions
let busUnsubscribe: (() => void) | undefined
let taskCompletionUnsubscribe: (() => void) | undefined
let sessionIdleUnsubscribe: (() => void) | undefined

// SDK event stream
const eventStream = {
  abort: undefined as AbortController | undefined,
}

function getAuthorizationHeader(): string | undefined {
  const password = process.env.OPENCODE_SERVER_PASSWORD
  if (!password) return undefined
  const username = process.env.OPENCODE_SERVER_USERNAME ?? "opencode"
  return `Basic ${btoa(`${username}:${password}`)}`
}

function startEventStream(directory: string) {
  if (eventStream.abort) eventStream.abort.abort()
  const abort = new AbortController()
  eventStream.abort = abort
  const signal = abort.signal

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    const auth = getAuthorizationHeader()
    if (auth) request.headers.set("Authorization", auth)
    return Server.App().fetch(request)
  }) as typeof globalThis.fetch

  const sdk = createOpencodeClient({
    baseUrl: "http://opencode.internal",
    directory,
    fetch: fetchFn,
    signal,
  })

  ;(async () => {
    while (!signal.aborted) {
      const events = await Promise.resolve(
        sdk.event.subscribe(
          {},
          {
            signal,
          },
        ),
      ).catch(() => undefined)

      if (!events) {
        await Bun.sleep(250)
        continue
      }

      for await (const event of events.stream) {
        const e = event as Event

        if (e.type === "message.part.updated") {
          const part = e.properties.part
          const callID = part.type === "tool" ? part.callID : "none"

          // Handle task tool metadata updates
          if (part.type === "tool" && part.tool === "task" && part.callID) {
            const partMetadata =
              part.state.status === "pending"
                ? undefined
                : (() => {
                    if (typeof part.state.metadata !== "object" || part.state.metadata === null) return undefined
                    return part.state.metadata as
                      | {
                          childSessionId?: string
                          summary?: Array<{ id: string; tool: string; state: { status: string } }>
                        }
                      | undefined
                  })()

            const childSessionId = partMetadata?.childSessionId

            // Track child session for Panel and cleanup
            if (childSessionId && !taskToChildSession.has(part.callID)) {
              Panel.addChild(childSessionId)
              taskToChildSession.set(part.callID, childSessionId)
              childSessionToTask.set(childSessionId, part.callID)

              // Process any buffered events for this child session
              const buffered = pendingChildEvents.get(childSessionId)
              if (buffered) {
                for (const bufferedItem of buffered) {
                  const bufferedPart = bufferedItem as {
                    type: string
                    tool: string
                    state: { status: string; title?: string }
                  }
                  if (bufferedPart.type === "tool") {
                    const title =
                      bufferedPart.state.status === "running" || bufferedPart.state.status === "completed"
                        ? bufferedPart.state.title || "running"
                        : ""

                    if (bufferedPart.state.status === "running") {
                      block.setTaskChildTool(part.callID, bufferedPart.tool, title)
                    } else if (bufferedPart.state.status === "completed" || bufferedPart.state.status === "error") {
                      block.clearTaskChildTool(part.callID)
                    }
                  }
                }
                pendingChildEvents.delete(childSessionId)
              }
            }
          }

          // Handle parts from child sessions
          if (part.type === "tool" && part.sessionID) {
            if (!part.state) continue
            // Skip events from parent session
            if (part.sessionID === currentSessionID) continue

            const taskCallID = childSessionToTask.get(part.sessionID)

            if (!taskCallID) {
              const buffer = pendingChildEvents.get(part.sessionID) || []
              buffer.push(part)
              pendingChildEvents.set(part.sessionID, buffer)
              continue
            }
            const title =
              part.state.status === "running" || part.state.status === "completed" ? part.state.title || "running" : ""

            if (part.state.status === "running") {
              block.setTaskChildTool(taskCallID, part.tool, title)
            } else if (part.state.status === "completed" || part.state.status === "error") {
              block.clearTaskChildTool(taskCallID)
            }
          }
        }
      }

      if (!signal.aborted) {
        await Bun.sleep(250)
      }
    }
  })().catch((error) => {
    log.error("event stream error", {
      error: error instanceof Error ? error.message : error,
    })
  })
}

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
    if (autoWakeupSessionID) Session.disableAutoWakeup(autoWakeupSessionID)
    if (eventStream.abort) eventStream.abort.abort()
    if (busUnsubscribe) busUnsubscribe()
    if (taskCompletionUnsubscribe) taskCompletionUnsubscribe()
    if (sessionIdleUnsubscribe) sessionIdleUnsubscribe()
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
  write(`${PAD}${fg.brightCyan}${style.bold}oclite${style.reset} ${fg.gray}v0.1.0${style.reset}\n`)

  const setup = new Spinner("Setting up environment")
  setup.start()

  try {
    await bootstrap(
      process.cwd(),
      async () => {
        // Start SDK event stream for task metadata updates
        startEventStream(process.cwd())

        // Subscribe to Bus events for auto-wakeup streaming text deltas
        // SDK event stream doesn't provide delta stream, so we keep this for text rendering
        busUnsubscribe = Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
          const part = event.properties.part

          // Handle auto-wakeup text streaming when not actively in a user-initiated operation
          if (!isOperationInProgress && isAutoWakeupStreaming && part.sessionID === currentSessionID) {
            if (part.type === "text" && event.properties.delta) {
              write(event.properties.delta)
            }
          }
        })

        // Subscribe to task completion events to render auto-wakeup responses
        // When a background task completes, the auto-wakeup mechanism triggers SessionPrompt.prompt()
        // We need to listen for the resulting MessageV2.Event.PartUpdated events and render them
        taskCompletionUnsubscribe = Bus.subscribe(Session.BackgroundTaskEvent.Completed, async (event) => {
          // Only handle tasks for our current session
          if (event.properties.parentSessionID !== currentSessionID) return

          // Don't start if user is typing or another operation is in progress
          if (isOperationInProgress || isAutoWakeupStreaming) return

          // Check if there are undelivered results that will trigger auto-wakeup
          if (!Session.hasUndeliveredCompletedTasks(currentSessionID)) return

          // Enable auto-wakeup streaming mode so the Bus subscriber renders the response
          isAutoWakeupStreaming = true

          // Show notification that task completed and response is streaming
          write(`\n${PAD}${fg.cyan}●${style.reset} Background task completed\n`)
          const rule = `${PAD}${style.dim}${"─".repeat(Math.min(process.stdout.columns || 80, 80))}${style.reset}\n`
          write(rule)
        })

        // Subscribe to session idle events to detect when auto-wakeup streaming ends
        sessionIdleUnsubscribe = Bus.subscribe(SessionStatus.Event.Idle, (event) => {
          // Only handle idle events for our current session
          if (event.properties.sessionID !== currentSessionID) return

          // If we were streaming auto-wakeup response, mark it as complete
          if (isAutoWakeupStreaming) {
            isAutoWakeupStreaming = false
            const rule = `\n${PAD}${style.dim}${"─".repeat(Math.min(process.stdout.columns || 80, 80))}${style.reset}\n`
            write(rule)
            write("\n")
          }
        })

        setup.update("Loading providers")
        await Provider.list()
        setup.update("Loading agents")
        await Agent.list()
        setup.update("Connecting to MCP servers")
        await MCP.clients()
        setup.update("Loading commands")
        await Command.list()

        setup.stop(true)
        write(`${PAD}${fg.green}✓${style.reset} Ready\n\n`)

        currentAgent = await Agent.defaultAgent()
        const agentList = await Agent.list()

        write(`${PAD}${fg.gray}Type /help for commands, Shift+Tab to cycle agents, Ctrl+C to exit${style.reset}\n\n`)

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
            taskToChildSession.clear()
            childSessionToTask.clear()
            pendingChildEvents.clear()
            isOperationInProgress = false
            isAutoWakeupStreaming = false
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
                  write(`\n${PAD}${hint}\n`)
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
            block.toggleTasksVisible()
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
      },
      (step) => setup.update(step),
    )
  } catch (err) {
    setup.stop(false)
    write(cursor.show)
    const msg = err instanceof Error ? err.message : String(err)
    write(`\n${PAD}${fg.red}Error: ${msg}${style.reset}\n`)
    process.exit(1)
  }
}

async function handleCommand(cmd: string) {
  const parts = cmd.slice(1).split(/\s+/)
  const name = parts[0].toLowerCase()

  if (name === "help") {
    write(`${PAD}${fg.yellow}Commands:${style.reset}\n`)
    write(`${PAD}  /help             - Show this help\n`)
    write(`${PAD}  /clear            - Clear screen\n`)
    write(`${PAD}  /sessions         - List and switch sessions\n`)
    write(`${PAD}  /new              - Create a new session\n`)
    write(`${PAD}  /agents           - List and select agents\n`)
    write(`${PAD}  /models           - List and select models\n`)
    write(`${PAD}  /subagent-model   - Select model for subagents\n`)
    write(`${PAD}  /mcp              - Manage MCP servers\n`)
    write(`${PAD}  /quit             - Exit oclite\n`)
    write(`${PAD}  /<command>        - Run custom command\n`)
    write("\n")
    return
  }

  if (name === "clear") {
    write(clear.screen)
    write(cursor.home)
    write(`${PAD}${fg.brightCyan}${style.bold}oclite${style.reset} ${fg.gray}v0.1.0${style.reset}\n\n`)
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

  if (name === "mcp") {
    await Commands.handleMcp()
    return
  }

  const spinner = new Spinner(`Processing /${name}`)
  spinner.start()

  try {
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
        spinner,
      )
      return
    }

    spinner.stop(true)
  } catch (err) {
    spinner.stop(false)
    throw err
  }

  write(`${PAD}${fg.red}Unknown command: ${cmd}${style.reset}\n\n`)
}

interface StreamOptions {
  model?: string
  agent?: string
  sessionID?: string
}

async function streamResponse(source: AsyncIterable<ChatChunk>, options: StreamOptions) {
  block.reset()
  taskToChildSession.clear()
  const spinner = new Spinner("Thinking")
  spinner.start()

  let first = true
  let totalTokens = 0
  const startTime = Date.now()
  let lastWasProse = false
  let toolCounter = 0
  let lastToolId = ""
  let lastToolKey = ""
  let dedupCount = 0
  const idMap = new Map<string, string>()
  const md = createMarkdownRenderer()
  let lineBuffer = ""

  function flushLineBuffer(addNewline = false) {
    if (!lineBuffer) return
    const rendered = md.render(lineBuffer)
    if (rendered) write(padLines(rendered))
    if (addNewline) write("\n")
    lineBuffer = ""
  }

  try {
    for await (const chunk of source) {
      if (chunk.type === "start" && chunk.sessionID && !currentSessionID) {
        currentSessionID = chunk.sessionID
        if (autoWakeupSessionID && autoWakeupSessionID !== currentSessionID) {
          Session.disableAutoWakeup(autoWakeupSessionID)
        }
        Session.enableAutoWakeup(currentSessionID)
        autoWakeupSessionID = currentSessionID
      }

      if (first && chunk.type !== "done" && chunk.type !== "start") {
        spinner.stop(true)
        first = false
        write(`${PAD}${fg.gray}(Esc to cancel)${style.reset}\n`)
        const rule = `${PAD}${style.dim}${"─".repeat(Math.min(process.stdout.columns || 80, 80))}${style.reset}\n`
        write(rule)
      }

      if (chunk.type === "text" && chunk.content) {
        // Pause block if no running tasks - they need live updates
        if (!block.hasRunningTasks()) {
          block.pause()
        }
        lastToolKey = ""
        dedupCount = 0

        // Add spacing when switching from tool to prose
        if (!lastWasProse) write("\n")
        lastWasProse = true

        lineBuffer += chunk.content

        const parts = lineBuffer.split("\n")

        for (const line of parts.slice(0, -1)) {
          const rendered = md.render(line + "\n")
          if (rendered) write(padLines(rendered))
        }

        lineBuffer = parts[parts.length - 1]

        if (lineBuffer.length > MAX_WIDTH) {
          flushLineBuffer()
        }
      }

      if (chunk.type === "tool_start" && chunk.tool?.trim()) {
        flushLineBuffer(true)
        block.resume()
        const tool = chunk.tool.trim()
        const arg = summarizeInput(tool, chunk.input)
        const summary = arg || ""
        const key = `${tool}:${summary}`

        if (key === lastToolKey) {
          dedupCount++
        } else {
          dedupCount = 1
          lastToolKey = key
          lastToolId = chunk.callID || `${tool}-${++toolCounter}`
        }

        if (chunk.callID) {
          idMap.set(chunk.callID, lastToolId)
        }

        // Render tool start (child session tools never appear here - streaming only yields parent session events)
        // Skip toolStart for task tools - they are handled by taskStart separately
        if (tool !== "task") {
          const label = dedupCount > 1 ? `${summary} (×${dedupCount})` : summary
          block.toolStart(lastToolId, tool, label)
        }

        // For task tools, register the task in the block
        // Use callID as the canonical ID since that's what the Bus subscription uses
        if (tool === "task" && chunk.input && typeof chunk.input === "object") {
          const input = chunk.input as TaskInput
          const agent = typeof input.subagent_type === "string" ? input.subagent_type : ""
          const description = typeof input.description === "string" ? input.description : ""
          if (agent && description && chunk.callID) {
            block.taskStart(chunk.callID, agent, description)
          }
        }
        lastWasProse = false
      }

      if (chunk.type === "tool_end" && chunk.tool?.trim()) {
        flushLineBuffer()
        const tool = chunk.tool.trim()
        const arg = summarizeInput(tool, chunk.input)
        const summary = arg || ""
        const key = `${tool}:${summary}`

        const id = (chunk.callID && idMap.get(chunk.callID)) || lastToolId

        const isPermissionDenied = typeof chunk.error === "string" && PERMISSION_DENIED_PATTERN.test(chunk.error)

        // Render tool end (child session tools never appear here - streaming only yields parent session events)
        const toolLabel = key === lastToolKey && dedupCount > 1 ? `${summary} (×${dedupCount})` : summary
        if (isPermissionDenied) {
          block.toolDenied(id, tool, toolLabel)
        } else {
          block.toolEnd(id, tool, toolLabel)
        }
        lastWasProse = false

        if (chunk.input && tool === "todowrite") {
          if (!Array.isArray(chunk.input.todos)) continue

          const valid = ["pending", "in_progress", "completed", "cancelled"]
          const priorities = ["high", "medium", "low"]

          const todos = chunk.input.todos
            .filter(
              (item): item is { id: string; content: string; status: string; priority: string } =>
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
              status: item.status as "pending" | "in_progress" | "completed" | "cancelled",
              priority: item.priority as "high" | "medium" | "low",
            }))

          if (todos.length > 0) block.setTodos(todos)
        }

        // Task tool returns immediately after dispatching background task.
        // Don't end the task here - let it stay "running" so child status can be displayed.
        // Task will be ended in the finally block when parent session completes.
      }

      // Handle tool metadata updates (e.g., task child tool changes)
      if (chunk.type === "tool_update") {
        log.debug(
          `STREAM tool_update: tool=${chunk.tool}, callID=${chunk.callID}, metadata=${JSON.stringify(chunk.metadata)}`,
        )
      }

      if (chunk.type === "tool_update" && chunk.tool === "task" && chunk.callID) {
        const metadata = chunk.metadata as
          | {
              childSessionId?: string
              summary?: Array<{ id: string; tool: string; state: { status: string } }>
            }
          | undefined
        const childSessionId = metadata?.childSessionId

        // Track child session for Panel and cleanup if not already tracked
        if (childSessionId && !taskToChildSession.has(chunk.callID)) {
          Panel.addChild(childSessionId)
          taskToChildSession.set(chunk.callID, childSessionId)
          childSessionToTask.set(childSessionId, chunk.callID)

          const pending = pendingChildEvents.get(childSessionId)
          if (pending) {
            for (const p of pending) {
              const pendingPart = p as {
                type: string
                tool: string
                state: { status: string; title?: string }
              }
              if (pendingPart.type === "tool" && pendingPart.state.status === "running") {
                const title = pendingPart.state.title || "running"
                block.setTaskChildTool(chunk.callID, pendingPart.tool, title)
              }
            }
            pendingChildEvents.delete(childSessionId)
          }
        }

        // Note: Child tool status is now handled by SDK event stream
        // Stream path here only provides empty titles, so we skip setTaskChildTool
        const summary = metadata?.summary
        if (summary && summary.length > 0) {
          const running = summary.find((t) => t.state.status === "running")
          log.debug(`STREAM task summary: length=${summary?.length || 0}, running=${running?.tool || "none"}`)
        }
      }

      if (chunk.type === "error" && chunk.content) {
        flushLineBuffer()
        block.resume()
        block.freeze()
        lastToolKey = ""
        dedupCount = 0
        lastWasProse = true
        const safeContent = chunk.content
          .replace(/\x1b\][^\x07]*\x07/g, "")
          .replace(/\x1b[\[\]()#?*]*[0-9;]*[A-Za-z]/g, "")
          .replace(/[\x00-\x1f\x7f]/g, "")
        write(`\n${PAD}${fg.red}Error: ${safeContent}${style.reset}\n`)
      }

      if (chunk.tokens !== undefined) {
        totalTokens += chunk.tokens
      }
    }
  } finally {
    spinner.stop(true)
    flushLineBuffer()
    // End any tasks that still have active child sessions
    for (const taskCallId of taskToChildSession.keys()) {
      block.taskEnd(taskCallId)
    }
    block.freeze()
    taskToChildSession.clear()
    childSessionToTask.clear()
    pendingChildEvents.clear()
    const flushed = md.flush()
    if (flushed) {
      // Plain text output, no bullets
      for (const line of flushed.split("\n")) {
        if (line) write(`${PAD}${line}\n`)
      }
    }
    const rule = `\n${PAD}${style.dim}${"─".repeat(Math.min(process.stdout.columns || 80, 80))}${style.reset}\n`
    write(rule)
    const duration = Date.now() - startTime
    write(`${PAD}${fg.gray}${formatDuration(duration)} · ${formatTokens(totalTokens)}${style.reset}\n`)
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
    write(`\n${PAD}${fg.red}Error: ${msg}${style.reset}\n\n`)
  } finally {
    isOperationInProgress = false
  }
}

main().catch(console.error)
