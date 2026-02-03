import type { CommandContext } from "../types"

const VALID_MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,}\/[a-zA-Z0-9][a-zA-Z0-9-_.]{2,}$/

export async function modelHandler(args: string[], context: CommandContext): Promise<void> {
  if (args.length === 0 || !args[0]) {
    return
  }

  const modelName = args[0]

  if (!VALID_MODEL_PATTERN.test(modelName)) {
    return
  }

  context.dispatch({
    type: "SET_SESSION",
    payload: {
      id: context.session.id ?? "default",
      agent: context.session.agent,
      model: modelName,
    },
  })
}
