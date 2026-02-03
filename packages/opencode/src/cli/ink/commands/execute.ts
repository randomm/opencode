import type { CommandContext } from "./types"
import { getCommand } from "./registry"

export function isCommand(input: string): boolean {
  return input.startsWith("/")
}

export function parseCommand(input: string): { name: string; args: string[] } {
  const trimmed = input.trim()
  const withoutSlash = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed
  const parts = withoutSlash.split(/\s+/).filter((part) => part.length > 0)
  const name = parts[0] ?? ""
  const args = parts.slice(1)
  return { name, args }
}

export async function executeCommand(input: string, context: CommandContext): Promise<boolean> {
  const { name, args } = parseCommand(input)

  if (name === "") {
    return false
  }

  const command = getCommand(name)

  if (!command) {
    return false
  }

  try {
    await command.handler(args, context)
    return true
  } catch (error) {
    return false
  }
}
