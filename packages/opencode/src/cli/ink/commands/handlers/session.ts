import type { CommandContext } from "../types"

const SESSION_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-_]{2,63}$/

export async function sessionHandler(args: string[], context: CommandContext): Promise<void> {
  if (args.length === 0 || !args[0]) {
    return
  }

  const sessionId = args[0]

  if (!SESSION_ID_PATTERN.test(sessionId)) {
    return
  }

  context.dispatch({
    type: "SET_SESSION",
    payload: {
      id: sessionId,
      agent: context.session.agent,
      model: context.session.model,
    },
  })
}

export async function sessionsHandler(_args: string[], _context: CommandContext): Promise<void> {
  // Sessions list implementation pending
}

export async function newSessionHandler(_args: string[], context: CommandContext): Promise<void> {
  const sessionId = crypto.randomUUID()
  context.dispatch({
    type: "SET_SESSION",
    payload: {
      id: sessionId,
      agent: context.session.agent,
      model: context.session.model,
    },
  })
}
