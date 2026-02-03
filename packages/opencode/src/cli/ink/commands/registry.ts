import type { Command } from "./types"
import { helpHandler } from "./handlers/help"
import { clearHandler } from "./handlers/clear"
import { quitHandler } from "./handlers/quit"
import { compactHandler } from "./handlers/compact"
import { agentHandler } from "./handlers/agent"
import { modelHandler } from "./handlers/model"
import { submodelHandler } from "./handlers/submodel"
import { sessionHandler, sessionsHandler, newSessionHandler } from "./handlers/session"

export const commandRegistry: Record<string, Command> = {
  help: {
    name: "help",
    description: "Show available commands",
    handler: helpHandler,
  },
  clear: {
    name: "clear",
    description: "Clear screen",
    handler: clearHandler,
  },
  agent: {
    name: "agent",
    description: "Switch agent (show menu if no arg)",
    handler: agentHandler,
  },
  model: {
    name: "model",
    description: "Switch model (show menu if no arg)",
    handler: modelHandler,
  },
  submodel: {
    name: "submodel",
    description: "Switch model for subagents only",
    handler: submodelHandler,
  },
  session: {
    name: "session",
    description: "Switch session",
    handler: sessionHandler,
  },
  sessions: {
    name: "sessions",
    description: "List sessions",
    handler: sessionsHandler,
  },
  new: {
    name: "new",
    description: "New session",
    handler: newSessionHandler,
  },
  compact: {
    name: "compact",
    description: "Toggle compact mode",
    handler: compactHandler,
  },
  quit: {
    name: "quit",
    description: "Exit",
    handler: quitHandler,
  },
}

export function getCommand(name: string): Command | undefined {
  return commandRegistry[name]
}

export function getAllCommands(): Command[] {
  return Object.values(commandRegistry)
}
