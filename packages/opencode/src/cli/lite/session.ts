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
    console.error("[DEBUG] Wake called, chunks:", chunks.length)
    if (waiting) {
      const fn = waiting
      waiting = null
      fn()
    }
  }

  // Subscribe to Bus events BEFORE starting prompt
  console.error("[DEBUG] Bus subscription active for", sessionID)
  const unsubscribe = Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
    console.error("[DEBUG] Bus event received:", event.properties.part.type)
    const part = event.properties.part
    if (part.sessionID !== sessionID) {
      console.error("[DEBUG] Event for different session, skipping:", part.sessionID)
      return
    }

    console.error("[DEBUG] Processing part type:", part.type)
    if (part.type === "text" && event.properties.delta) {
      console.error("[DEBUG] Adding text chunk:", event.properties.delta.substring(0, 50))
      chunks.push({ type: "text", content: event.properties.delta, sessionID })
      wake()
    } else if (part.type === "tool") {
      if (part.state.status === "running") {
        console.error("[DEBUG] Tool started:", part.tool)
        chunks.push({ type: "tool_start", tool: part.tool, input: part.state.input, sessionID })
      } else if (part.state.status === "completed") {
        console.error("[DEBUG] Tool completed:", part.tool)
        chunks.push({ type: "tool_end", tool: part.tool, output: part.state.output, sessionID })
      }
      wake()
    } else if (part.type === "step-finish") {
      console.error("[DEBUG] Step finished, tokens:", part.tokens)
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

    console.error("[DEBUG] Starting prompt...")
    // Start prompt - this triggers events via Bus
    const promptPromise = SessionPrompt.prompt({
      sessionID,
      agent,
      model: modelParam,
      parts,
    })
      .then(() => {
        console.error("[DEBUG] Prompt completed")
        promptDone = true
        wake()
      })
      .catch((err) => {
        console.error("[DEBUG] Prompt error:", err)
        error = err
        cancelled = true
        wake()
      })

    console.error("[DEBUG] Prompt started, waiting for chunks...")

    // Yield chunks as they arrive
    while (!promptDone && !cancelled) {
      while (chunks.length > 0) {
        const chunk = chunks.shift()!
        console.error("[DEBUG] Yielding chunk:", chunk.type, chunk.content?.slice(0, 50))
        yield chunk
      }
      if (cancelled) break

      console.error("[DEBUG] PromptDone:", promptDone, "cancelled:", cancelled)
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
      console.error("[DEBUG] Yielding final chunk:", chunk.type, chunk.content?.slice(0, 50))
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
