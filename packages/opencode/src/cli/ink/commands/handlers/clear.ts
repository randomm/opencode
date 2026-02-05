import type { CommandContext } from "../types"
import { clear, cursor } from "../../../lite/terminal"

export async function clearHandler(_args: string[], context: CommandContext): Promise<void> {
  // Clear terminal screen using ANSI codes (only in TTY environments)
  // Guard against non-TTY contexts (CI/CD, pipes, redirects)
  if (process.stdout.isTTY) {
    process.stdout.write(clear.screen + cursor.home)
  }

  // Clear all messages and streaming state in Ink's React state
  // This prevents old content from reappearing when Ink re-renders
  context.dispatch({ type: "CLEAR_ALL" })
}
