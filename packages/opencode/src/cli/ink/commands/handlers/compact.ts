import type { CommandContext } from "../types"

export async function compactHandler(_args: string[], context: CommandContext): Promise<void> {
  try {
    context.dispatch({
      type: "STREAM_TEXT",
      payload: "\nCompact mode not yet implemented.\n\n",
    })
  } catch (error) {
    console.error("Failed to dispatch compact message:", error)
  }
}
