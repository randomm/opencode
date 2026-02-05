import type { CommandContext } from "../types"

const MAX_PROVIDER_LENGTH = 64
const MAX_MODEL_LENGTH = 128
const MAX_TOTAL_LENGTH = MAX_PROVIDER_LENGTH + MAX_MODEL_LENGTH + 1

const VALID_MODEL_PATTERN = /^[a-zA-Z](?:[a-zA-Z0-9]+-)*[a-zA-Z0-9]+\/[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])+$/

export async function submodelHandler(args: string[], context: CommandContext): Promise<void> {
  if (args.length === 0) {
    context.dispatch({ type: "STREAM_TEXT", payload: "Invalid model format. Use: /submodel provider/model-name\n" })
    return
  }

  const modelName = args[0]

  if (modelName.length > MAX_TOTAL_LENGTH) {
    context.dispatch({ type: "STREAM_TEXT", payload: "Invalid model format. Model name too long.\n" })
    return
  }

  if (!VALID_MODEL_PATTERN.test(modelName)) {
    context.dispatch({ type: "STREAM_TEXT", payload: "Invalid model format. Use: /submodel provider/model-name\n" })
    return
  }

  const parts = modelName.split("/")
  const provider = parts[0]
  const model = parts[1]

  if (!provider || !model || provider.length > MAX_PROVIDER_LENGTH || model.length > MAX_MODEL_LENGTH) {
    context.dispatch({ type: "STREAM_TEXT", payload: "Invalid model format. Provider or model name invalid.\n" })
    return
  }

  try {
    context.dispatch({
      type: "SET_SUBAGENT_MODEL",
      payload: modelName,
    })
    context.dispatch({ type: "STREAM_TEXT", payload: `Subagent model set to: ${modelName}\n` })
  } catch (error) {
    console.error("Failed to set subagent model:", error)
    context.dispatch({ type: "STREAM_TEXT", payload: "Failed to set subagent model\n" })
  }
}
