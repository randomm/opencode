import { describe, test, expect } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { Identifier } from "../../src/id/id"
import { tmpdir } from "../fixture/fixture"

describe("session worktree directory in messages", () => {
  test("messages should use session.directory not Instance.directory", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        // Create a session with a specific directory (simulating worktree)
        const session = await Session.create({})

        // Verify we use session.directory, not Instance.directory
        const expectedCwd = session.directory
        const expectedRoot = Instance.worktree

        // Create a user message
        const userMessage: MessageV2.User = {
          id: Identifier.ascending("message"),
          sessionID: session.id,
          time: { created: Date.now() },
          role: "user",
          agent: "general",
          model: {
            providerID: "test",
            modelID: "test-model",
          },
        }
        await Session.updateMessage(userMessage)

        const userPart: MessageV2.Part = {
          type: "text",
          id: Identifier.ascending("part"),
          messageID: userMessage.id,
          sessionID: session.id,
          text: "test message",
        }
        await Session.updatePart(userPart)

        // Verify that when creating assistant messages, we use session.directory
        // This simulates what prompt.ts should do (and what the fix addresses)
        const assistantMessage: MessageV2.Assistant = {
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: userMessage.id,
          role: "assistant",
          mode: "general",
          agent: "general",
          variant: undefined,
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          modelID: "test-model",
          providerID: "test",
          time: { created: Date.now() },
          path: {
            cwd: expectedCwd, // FIXED: should be session.directory, not Instance.directory
            root: expectedRoot,
          },
        }
        await Session.updateMessage(assistantMessage)

        // Fetch the message back from the database (stream is an async generator)
        const messages = []
        for await (const msg of MessageV2.stream(session.id)) {
          messages.push(msg)
        }
        const createdAssistant = messages.find((m: MessageV2.WithParts) => m.info.id === assistantMessage.id)

        // Verify the directory is correct - it should match session.directory
        expect((createdAssistant.info as MessageV2.Assistant)?.path.cwd).toBe(expectedCwd)
        expect((createdAssistant.info as MessageV2.Assistant)?.path.root).toBe(expectedRoot)
      },
    })
  })

  test("subtask messages should use session.directory", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        // Verify session directory
        const expectedCwd = session.directory
        const expectedRoot = Instance.worktree

        // Create a user message
        const userMessage: MessageV2.User = {
          id: Identifier.ascending("message"),
          sessionID: session.id,
          time: { created: Date.now() },
          role: "user",
          agent: "general",
          model: {
            providerID: "test",
            modelID: "test-model",
          },
        }
        await Session.updateMessage(userMessage)

        const userPart: MessageV2.Part = {
          type: "text",
          id: Identifier.ascending("part"),
          messageID: userMessage.id,
          sessionID: session.id,
          text: "run subtask",
        }
        await Session.updatePart(userPart)

        // Create assistant message for subtask
        const assistantMessage: MessageV2.Assistant = {
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: userMessage.id,
          role: "assistant",
          mode: "general",
          agent: "general",
          variant: undefined,
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          modelID: "test-model",
          providerID: "test",
          time: { created: Date.now() },
          path: {
            cwd: expectedCwd,
            root: expectedRoot,
          },
        }
        await Session.updateMessage(assistantMessage)

        // Fetch the message back
        const messages = []
        for await (const msg of MessageV2.stream(session.id)) {
          messages.push(msg)
        }
        const createdAssistant = messages.find((m: MessageV2.WithParts) => m.info.id === assistantMessage.id)

        // Verify the directory is session.directory, not Instance.directory
        expect((createdAssistant.info as MessageV2.Assistant)?.path.cwd).toBe(expectedCwd)
        expect((createdAssistant.info as MessageV2.Assistant)?.path.root).toBe(expectedRoot)
      },
    })
  })

  test("compaction messages should use session.directory", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        const expectedCwd = session.directory
        const expectedRoot = Instance.worktree

        // Create user and assistant messages
        const userMessage: MessageV2.User = {
          id: Identifier.ascending("message"),
          sessionID: session.id,
          time: { created: Date.now() },
          role: "user",
          agent: "general",
          model: {
            providerID: "test",
            modelID: "test-model",
          },
        }
        await Session.updateMessage(userMessage)

        const userPart: MessageV2.Part = {
          type: "text",
          id: Identifier.ascending("part"),
          messageID: userMessage.id,
          sessionID: session.id,
          text: "original message",
        }
        await Session.updatePart(userPart)

        // Create assistant message
        const assistantMessage: MessageV2.Assistant = {
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: userMessage.id,
          role: "assistant",
          mode: "general",
          agent: "general",
          variant: undefined,
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          modelID: "test-model",
          providerID: "test",
          time: { created: Date.now() },
          path: {
            cwd: expectedCwd,
            root: expectedRoot,
          },
        }
        await Session.updateMessage(assistantMessage)

        // Create a compaction message (simulating compaction.ts)
        const compactionMessage: MessageV2.Assistant = {
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: assistantMessage.id,
          role: "assistant",
          mode: "compaction",
          agent: "compaction",
          variant: undefined,
          summary: true,
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: { read: 0, write: 0 },
          },
          modelID: "test-model",
          providerID: "test",
          time: { created: Date.now() },
          path: {
            cwd: expectedCwd,
            root: expectedRoot,
          },
        }
        await Session.updateMessage(compactionMessage)

        // Fetch the message back
        const messages = []
        for await (const msg of MessageV2.stream(session.id)) {
          messages.push(msg)
        }
        const createdCompaction = messages.find((m: MessageV2.WithParts) => m.info.id === compactionMessage.id)

        // Verify the directory is session.directory, not Instance.directory
        expect((createdCompaction.info as MessageV2.Assistant)?.path.cwd).toBe(expectedCwd)
        expect((createdCompaction.info as MessageV2.Assistant)?.path.root).toBe(expectedRoot)
      },
    })
  })
})