import type { CommandContext } from "../types"
import { getAllCommands } from "../registry"

const MAX_COMMANDS = 100

export async function helpHandler(_args: string[], context: CommandContext): Promise<void> {
  const allCommands = getAllCommands()
  const commands = allCommands.slice(0, MAX_COMMANDS)

  let helpText = "\nAvailable commands:\n\n"

  for (const cmd of commands) {
    helpText += `  /${cmd.name.padEnd(12)} - ${cmd.description}\n`
  }

  helpText += "\nKeyboard shortcuts:\n"
  helpText += "  Ctrl+C       - Exit\n"
  helpText += "  Enter        - Submit message\n"
  helpText += "\n"

  try {
    context.dispatch({
      type: "STREAM_TEXT",
      payload: helpText,
    })
  } catch (error) {
    console.error("Failed to dispatch help text:", error)
  }
}
