import type { CommandContext } from "../types"

const VALID_AGENTS = ["build", "debug", "test", "general", "default"]

export async function agentHandler(args: string[], context: CommandContext): Promise<void> {
  if (args.length === 0 || !args[0]) {
    context.dispatch({ type: "STREAM_TEXT", payload: "Invalid agent. Use: build, debug, test, general, or default\n" })
    return
  }

  const agentName = args[0]

  if (!VALID_AGENTS.includes(agentName)) {
    context.dispatch({ type: "STREAM_TEXT", payload: "Invalid agent. Use: build, debug, test, general, or default\n" })
    return
  }

  try {
    context.dispatch({
      type: "SET_SESSION",
      payload: {
        id: context.session.id || "default",
        agent: agentName,
        model: context.session.model,
      },
    })
    context.dispatch({ type: "STREAM_TEXT", payload: `Agent switched to: ${agentName}\n` })
  } catch (error) {
    console.error("Failed to set agent:", error)
    context.dispatch({ type: "STREAM_TEXT", payload: "Failed to set agent\n" })
  }
}
