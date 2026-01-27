import { Session } from "../../session"
import { SessionPrompt } from "../../session/prompt"
import { Agent } from "../../agent/agent"
import { Provider } from "../../provider/provider"
import { Instance } from "../../project/instance"
import { Log } from "../../util/log"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { Server } from "../../server/server"

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

  const abortController = new AbortController()
  const signal = options?.signal || abortController.signal

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    return Server.App().fetch(request)
  }) as typeof globalThis.fetch

  const sdk = createOpencodeClient({
    baseUrl: "http://opencode.internal",
    directory: Instance.directory,
    fetch: fetchFn,
    signal,
  })

  const chunks: ChatChunk[] = []
  let stepTokens = 0
  let done = false
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

  try {
    const parts = [{ type: "text" as const, text: message }]

    // Yield sessionID for cancellation tracking
    yield { type: "start" as const, sessionID }

    // Start prompt (triggers LLM, emits events)
    const promptPromise = SessionPrompt.prompt({
      sessionID,
      agent,
      model: modelParam,
      parts,
    }).catch((err) => {
      error = err
      cancelled = true
      wake()
    })

    // Subscribe to SDK events and push to chunks array
    sdk.event
      .subscribe({}, { signal })
      .then(async (events) => {
        for await (const event of events.stream) {
          if (signal.aborted || cancelled) break

          if (event.type === "message.part.updated") {
            const part = event.properties.part
            if (part.sessionID !== sessionID) continue

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
          }
        }
      })
      .catch(() => {})

    // Wait for prompt to complete, yielding chunks as they arrive
    while (!done && !signal.aborted && !cancelled) {
      // Yield any buffered chunks
      while (chunks.length > 0) {
        yield chunks.shift()!
      }

      if (cancelled) break

      // Wait for either prompt completion or new chunks
      await Promise.race([
        promptPromise.then(() => {
          done = true
        }),
        new Promise<void>((resolve) => {
          waiting = resolve
          if (chunks.length > 0) {
            waiting = null
            resolve()
          }
        }),
      ])
    }

    // Yield remaining chunks
    while (chunks.length > 0) {
      yield chunks.shift()!
    }

    if (!signal.aborted && !cancelled && !error) {
      yield { type: "done", tokens: stepTokens, sessionID }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    log.error("chat error", { error: errorMessage, stack, sessionID })
    yield { type: "error", content: errorMessage, sessionID }
  } finally {
    abortController.abort()
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
