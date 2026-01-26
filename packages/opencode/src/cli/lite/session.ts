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
  type: "text" | "tool_start" | "tool_end" | "error" | "done"
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
  let done = false
  let cancelled = false
  let error: unknown = null
  let waiting: (() => void) | null = null

  const unsubscribe = Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
    const part = event.properties.part
    if (part.sessionID !== sessionID) return

    if (part.type === "text" && event.properties.delta) {
      chunks.push({ type: "text", content: event.properties.delta, sessionID })
      wake()
    } else if (part.type === "tool") {
      if (part.state.status === "running") {
        chunks.push({
          type: "tool_start",
          tool: part.tool,
          input: part.state.input,
          sessionID,
        })
      } else if (part.state.status === "completed") {
        chunks.push({
          type: "tool_end",
          tool: part.tool,
          output: part.state.output,
          sessionID,
        })
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
    yield { type: "done" as const, sessionID }

    // Start prompt
    const promptPromise = SessionPrompt.prompt({
      sessionID,
      agent,
      model: modelParam,
      parts,
    }).catch((err) => {
      // Capture error but don't throw yet
      error = err
      cancelled = true
    })

    // Stream chunks as they arrive
    while (!done && !options?.signal?.aborted && !cancelled) {
      // Yield buffered chunks
      while (chunks.length > 0) {
        const chunk = chunks.shift()!
        yield chunk
      }

      // Check if we're done or if there was an error
      if (cancelled) {
        break
      }

      // Wait for either prompt to complete or new chunks
      await Promise.race([
        promptPromise.then(() => {
          done = true
        }),
        new Promise<void>((resolve) => {
          waiting = () => resolve()
          // Also resolve immediately if there are chunks
          if (chunks.length > 0) {
            waiting = null
            resolve()
          }
        }),
      ])
    }

    // Yield any remaining chunks
    while (chunks.length > 0) {
      yield chunks.shift()!
    }

    if (!options?.signal?.aborted && !cancelled && !error) {
      yield { type: "done", tokens: stepTokens, sessionID }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    log.error("chat error", { error: errorMessage, stack, sessionID })
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
