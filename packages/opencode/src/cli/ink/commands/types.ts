import type { Action } from "../state/reducer"
import type { SessionState, UIMode } from "../state/types"

export interface CommandContext {
  dispatch: (action: Action) => void
  session: SessionState
  setUIMode: (mode: UIMode) => void
}

export interface Command {
  name: string
  description: string
  handler: (args: string[], context: CommandContext) => Promise<void>
}
