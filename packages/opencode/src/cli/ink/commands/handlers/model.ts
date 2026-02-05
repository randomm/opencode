import type { CommandContext } from "../types"

const VALID_MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,}\/[a-zA-Z0-9][a-zA-Z0-9-_.]{2,}$/

export async function modelHandler(args: string[], context: CommandContext): Promise<void> {
  if (args.length === 0 || !args[0]) {
    context.dispatch({ type: "STREAM_TEXT", payload: "Invalid model format. Use: /model provider/model-name\n" })
    return
  }

  const modelName = args[0]

  if (!VALID_MODEL_PATTERN.test(modelName)) {
    context.dispatch({ type: "STREAM_TEXT", payload: "Invalid model format. Use: /model provider/model-name\n" })
    return
  }

  try {
    context.dispatch({
      type: "SET_SESSION",
      payload: {
        id: context.session.id || "default",
        agent: context.session.agent,
        model: modelName,
      },
    })
    context.dispatch({ type: "STREAM_TEXT", payload: `Model set to: ${modelName}\n` })
  } catch (error) {
    console.error("Failed to set model:", error)
    context.dispatch({ type: "STREAM_TEXT", payload: "Failed to set model\n" })
  }
}
