import type { CommandContext } from "../types"

export async function quitHandler(_args: string[], _context: CommandContext): Promise<void> {
  process.exit(0)
}
