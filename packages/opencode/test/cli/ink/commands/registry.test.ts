import { describe, expect, test } from "bun:test"
import { commandRegistry, getCommand, getAllCommands } from "../../../../src/cli/ink/commands/registry"

describe("cli.ink.commands.registry", () => {
  describe("getCommand", () => {
    test("returns command for valid name", () => {
      const helpCmd = getCommand("help")
      expect(helpCmd).toBeDefined()
      expect(helpCmd?.name).toBe("help")
      expect(helpCmd?.description).toBeDefined()
      expect(helpCmd?.handler).toBeInstanceOf(Function)
    })

    test("returns undefined for invalid name", () => {
      const invalidCmd = getCommand("nonexistent")
      expect(invalidCmd).toBeUndefined()
    })

    test("is case-sensitive", () => {
      const helpCmd = getCommand("help")
      const invalidCmd = getCommand("HELP")
      expect(helpCmd).toBeDefined()
      expect(invalidCmd).toBeUndefined()
    })
  })

  describe("getAllCommands", () => {
    test("returns all registered commands", () => {
      const commands = getAllCommands()
      expect(commands.length).toBeGreaterThan(0)
    })

    test("includes expected commands", () => {
      const commands = getAllCommands()
      const names = commands.map((c) => c.name)
      expect(names).toContain("help")
      expect(names).toContain("clear")
      expect(names).toContain("agent")
      expect(names).toContain("model")
      expect(names).toContain("submodel")
      expect(names).toContain("session")
      expect(names).toContain("sessions")
      expect(names).toContain("new")
      expect(names).toContain("compact")
      expect(names).toContain("quit")
    })

    test("each command has required fields", () => {
      const commands = getAllCommands()
      for (const cmd of commands) {
        expect(cmd.name).toBeDefined()
        expect(cmd.name.length).toBeGreaterThan(0)
        expect(cmd.description).toBeDefined()
        expect(cmd.handler).toBeInstanceOf(Function)
      }
    })
  })

  describe("commandRegistry", () => {
    test("contains all expected commands", () => {
      expect(commandRegistry.help).toBeDefined()
      expect(commandRegistry.clear).toBeDefined()
      expect(commandRegistry.agent).toBeDefined()
      expect(commandRegistry.model).toBeDefined()
      expect(commandRegistry.submodel).toBeDefined()
      expect(commandRegistry.session).toBeDefined()
      expect(commandRegistry.sessions).toBeDefined()
      expect(commandRegistry.new).toBeDefined()
      expect(commandRegistry.compact).toBeDefined()
      expect(commandRegistry.quit).toBeDefined()
    })
  })
})
