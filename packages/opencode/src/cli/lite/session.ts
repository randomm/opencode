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
}

interface ChatOptions {
  model?: string
  agent?: string
  sessionID?: string
}

export async function* chat(message: string, options?: ChatOptions): AsyncGenerator<ChatChunk> {
  const sessionID = await (async () => {
    if (options?.sessionID) return options.sessionID
    const session = await Session.createNext({ directory: Instance.directory })
    return session.id
  })()

  const agent = options?.agent || (await Agent.defaultAgent())
  const modelParam = options?.model ? Provider.parseModel(options.model) : undefined

  const buffer: ChatChunk[] = []
  let lastTextBuffer = ""

  const unsubscribe = Bus.subscribe(MessageV2.Event.PartUpdated, (event) => {
    const part = event.properties.part
    const sessionMatch = part.sessionID === sessionID

    if (!sessionMatch) return

    if (part.type === "text" && event.properties.delta) {
      lastTextBuffer += event.properties.delta
      buffer.push({ type: "text", content: event.properties.delta })
    } else if (part.type === "tool") {
      if (part.state.status === "running") {
        buffer.push({
          type: "tool_start",
          tool: part.tool,
          input: part.state.input,
        })
      } else if (part.state.status === "completed") {
        const output = part.state.output
        buffer.push({
          type: "tool_end",
          tool: part.tool,
          output,
        })
      }
    }
  })

  try {
    const parts = [{ type: "text" as const, text: message }]
    await SessionPrompt.prompt({
      sessionID,
      agent,
      model: modelParam,
      parts,
    })

    for (const chunk of buffer) {
      yield chunk
    }

    yield { type: "done" }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    log.error("chat error", { error: errorMessage, stack, sessionID })
    yield { type: "error", content: errorMessage }
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
