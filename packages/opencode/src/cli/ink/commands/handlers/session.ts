import type { CommandContext } from "../types"

const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-_]{2,63}$/

export async function sessionHandler(args: string[], context: CommandContext): Promise<void> {
  if (args.length === 0 || !args[0]) {
    context.dispatch({ type: "STREAM_TEXT", payload: "Invalid session ID. Use: /session <id>\n" })
    return
  }

  const sessionId = args[0]

  if (!SESSION_ID_PATTERN.test(sessionId)) {
    context.dispatch({
      type: "STREAM_TEXT",
      payload: "Invalid session ID format. Must be 3-64 alphanumeric characters, hyphens, or underscores.\n",
    })
    return
  }

  try {
    context.dispatch({
      type: "SET_SESSION",
      payload: {
        id: sessionId,
        agent: context.session.agent,
        model: context.session.model,
      },
    })
    context.dispatch({ type: "STREAM_TEXT", payload: `Session switched to: ${sessionId}\n` })
  } catch (error) {
    console.error("Failed to set session:", error)
    context.dispatch({ type: "STREAM_TEXT", payload: "Failed to switch session\n" })
  }
}

export async function sessionsHandler(_args: string[], context: CommandContext): Promise<void> {
  const currentId = context.session.id || "(no session)"
  const helpText = `\nCurrent session: ${currentId}\n\nSession commands:\n  /session <id>  - Switch to session\n  /new           - Create new session\n\n`

  try {
    context.dispatch({
      type: "STREAM_TEXT",
      payload: helpText,
    })
  } catch (error) {
    console.error("Failed to dispatch session info:", error)
  }
}

export async function newSessionHandler(_args: string[], context: CommandContext): Promise<void> {
  let sessionId: string
  try {
    sessionId = crypto.randomUUID()
  } catch (error) {
    console.error("Failed to generate session ID:", error)
    try {
      context.dispatch({
        type: "STREAM_TEXT",
        payload: "\nFailed to create session: crypto.randomUUID() unavailable\n\n",
      })
    } catch (dispatchError) {
      console.error("Failed to dispatch error message:", dispatchError)
    }
    return
  }

  try {
    context.dispatch({
      type: "SET_SESSION",
      payload: {
        id: sessionId,
        agent: context.session.agent,
        model: context.session.model,
      },
    })
    context.dispatch({ type: "STREAM_TEXT", payload: `New session created: ${sessionId}\n` })
  } catch (error) {
    console.error("Failed to set new session:", error)
    context.dispatch({ type: "STREAM_TEXT", payload: "Failed to create new session\n" })
  }
}
