import type { CommandContext } from "../types"

const VALID_MODEL_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]{1,}\/[a-zA-Z0-9][a-zA-Z0-9-_.]{1,}$/

export async function submodelHandler(args: string[], context: CommandContext): Promise<void> {
  if (args.length === 0) {
    return
  }

  const modelName = args[0]

  if (!VALID_MODEL_PATTERN.test(modelName)) {
    return
  }

  context.dispatch({
    type: "SET_SUBAGENT_MODEL",
    payload: modelName,
  })
}
