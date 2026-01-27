import { Session } from "../../session"
import { SessionPrompt } from "../../session/prompt"
import { Agent } from "../../agent/agent"
import { Provider } from "../../provider/provider"
import { Instance } from "../../project/instance"
import { Log } from "../../util/log"
import { Bus } from "../../bus"
import { MessageV2 } from "../../session/message-v2"

const log = Log.create({ service: "lite.session" })

export interface ChatChunk {
  type: "text" | "tool_start" | "tool_end" | "error" | "done" | "start"
  content?: string
  tool?: string
  input?: Record<string, unknown>
  output?: string
  tokens?: number
  sessionID?: string
}

interface ChatOptions {
  model?: string
  agent?: string
  sessionID?: string
  signal?: AbortSignal
}

export async function* chat(message: string, options?: ChatOptions): AsyncGenerator<ChatChunk> {
  const sessionID = await (async () => {
    if (options?.sessionID) return options.sessionID
    const session = await Session.createNext({ directory: Instance.directory })
    return session.id
  })()

  const agent = options?.agent || (await Agent.defaultAgent())
  const modelParam = options?.model ? Provider.parseModel(options.model) : undefined

  const chunks: ChatChunk[] = []
  let stepTokens = 0
  let promptDone = false
  let cancelled = false
  let error: unknown = null
  let waiting: (() => void) | null = null

  function wake() {
    if (waiting) {
      const fn = waiting
      waiting = null
      fn()
    }
  }

  // Subscribe to Bus events BEFORE starting prompt
  const unsubscribe = Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
    const part = event.properties.part
    if (part.sessionID !== sessionID) {
      return
    }

    if (part.type === "text" && event.properties.delta) {
      chunks.push({ type: "text", content: event.properties.delta, sessionID })
      wake()
    } else if (part.type === "tool") {
      if (part.state.status === "running") {
        chunks.push({ type: "tool_start", tool: part.tool, input: part.state.input, sessionID })
      } else if (part.state.status === "completed") {
        chunks.push({ type: "tool_end", tool: part.tool, output: part.state.output, sessionID })
      }
      wake()
    } else if (part.type === "step-finish") {
      stepTokens +=
        part.tokens.input +
        part.tokens.output +
        part.tokens.reasoning +
        part.tokens.cache.read +
        part.tokens.cache.write
    }
  })

  try {
    const parts = [{ type: "text" as const, text: message }]
    yield { type: "start" as const, sessionID }

    // Start prompt - this triggers events via Bus
    const promptPromise = SessionPrompt.prompt({
      sessionID,
      agent,
      model: modelParam,
      parts,
    })
      .then(() => {
        promptDone = true
        wake()
      })
      .catch((err) => {
        error = err
        cancelled = true
        wake()
      })

    // Yield chunks as they arrive
    while (!promptDone && !cancelled) {
      while (chunks.length > 0) {
        const chunk = chunks.shift()!
        yield chunk
      }
      if (cancelled) break

      await new Promise<void>((resolve) => {
        waiting = resolve
        if (chunks.length > 0 || promptDone || cancelled) {
          waiting = null
          resolve()
        }
      })
    }

    while (chunks.length > 0) {
      const chunk = chunks.shift()!
      yield chunk
    }

    if (!cancelled && !error) {
      yield { type: "done", tokens: stepTokens, sessionID }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log.error("chat error", { error: errorMessage, sessionID })
    yield { type: "error", content: errorMessage, sessionID }
  } finally {
    unsubscribe()
  }
}

export async function getOrCreateSession(title?: string): Promise<string> {
  const session = await Session.createNext({
    directory: Instance.directory,
    title,
  })
  return session.id
}

export async function getSession(sessionID: string): Promise<Session.Info | null> {
  try {
    return await Session.get(sessionID)
  } catch {
    return null
  }
}

export async function listSessions(): Promise<Session.Info[]> {
  const sessions: Session.Info[] = []
  for await (const session of Session.list()) {
    sessions.push(session)
    if (sessions.length >= 10) break
  }
  return sessions.reverse()
}

export async function* command(cmd: string, args: string, options?: ChatOptions): AsyncGenerator<ChatChunk> {
  const sessionID = await (async () => {
    if (options?.sessionID) return options.sessionID
    const session = await Session.createNext({ directory: Instance.directory })
    return session.id
  })()

  const agent = options?.agent || (await Agent.defaultAgent())
  const modelParam = options?.model ? Provider.parseModel(options.model) : undefined

  const chunks: ChatChunk[] = []
  let stepTokens = 0
  let promptDone = false
  let cancelled = false
  let error: unknown = null
  let waiting: (() => void) | null = null
  let promptPromise: Promise<void> | null = null

  function wake() {
    if (waiting) {
      const fn = waiting
      waiting = null
      fn()
    }
  }

  const unsubscribe = Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
    const part = event.properties.part
    if (part.sessionID !== sessionID) {
      return
    }

    if (part.type === "text" && event.properties.delta) {
      chunks.push({ type: "text", content: event.properties.delta, sessionID })
      wake()
    } else if (part.type === "tool") {
      if (part.state.status === "running") {
        chunks.push({ type: "tool_start", tool: part.tool, input: part.state.input, sessionID })
      } else if (part.state.status === "completed") {
        chunks.push({ type: "tool_end", tool: part.tool, output: part.state.output, sessionID })
      }
      wake()
    } else if (part.type === "step-finish") {
      stepTokens +=
        part.tokens.input +
        part.tokens.output +
        part.tokens.reasoning +
        part.tokens.cache.read +
        part.tokens.cache.write
    }
  })

  try {
    yield { type: "start" as const, sessionID }

    promptPromise = SessionPrompt.command({
      sessionID,
      agent,
      model: modelParam?.modelID ? `${modelParam.providerID}/${modelParam.modelID}` : undefined,
      command: cmd,
      arguments: args,
    })
      .then(() => {
        promptDone = true
        wake()
      })
      .catch((err) => {
        error = err
        promptDone = true
        cancelled = true
        wake()
      })

    while (!promptDone && !cancelled) {
      while (chunks.length > 0) {
        const chunk = chunks.shift()!
        yield chunk
      }
      if (cancelled) break

      await new Promise<void>((resolve) => {
        waiting = resolve
        if (chunks.length > 0 || promptDone || cancelled) {
          waiting = null
          resolve()
        }
      })
    }

    await promptPromise

    while (chunks.length > 0) {
      const chunk = chunks.shift()!
      yield chunk
    }

    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      yield { type: "error", content: errorMessage, sessionID }
    } else if (!cancelled) {
      yield { type: "done", tokens: stepTokens, sessionID }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log.error("command error", { error: errorMessage, sessionID })
    yield { type: "error", content: errorMessage, sessionID }
  } finally {
    unsubscribe()
  }
}
