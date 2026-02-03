import type { CommandContext } from "../types"

const VALID_AGENTS = ["build", "debug", "test", "general", "default"]

export async function agentHandler(args: string[], context: CommandContext): Promise<void> {
  if (args.length === 0 || !args[0]) {
    return
  }

  const agentName = args[0]

  if (!VALID_AGENTS.includes(agentName)) {
    return
  }

  context.dispatch({
    type: "SET_SESSION",
    payload: {
      id: context.session.id ?? "default",
      agent: agentName,
      model: context.session.model,
    },
  })
}
