import type { CommandContext } from "../types"

export async function clearHandler(_args: string[], context: CommandContext): Promise<void> {
  context.dispatch({ type: "CLEAR_STREAMING" })
}
