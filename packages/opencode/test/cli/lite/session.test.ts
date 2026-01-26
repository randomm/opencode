import { describe, it, expect, mock } from "bun:test"
import { Session } from "../../../src/session"
import { SessionPrompt } from "../../../src/session/prompt"
import { Agent } from "../../../src/agent/agent"
import { Provider } from "../../../src/provider/provider"
import { chat, getOrCreateSession, getSession, listSessions } from "../../../src/cli/lite/session"

describe("session", () => {
  it("exports ChatChunk interface types", () => {
    const chunk: any = { type: "text", content: "hello" }
    expect(chunk.type).toBe("text")
    expect(chunk.content).toBe("hello")
  })

  it("exports chat async generator function", () => {
    expect(typeof chat).toBe("function")
  })

  it("exports getOrCreateSession function", () => {
    expect(typeof getOrCreateSession).toBe("function")
  })

  it("exports getSession function", () => {
    expect(typeof getSession).toBe("function")
  })

  it("exports listSessions function", () => {
    expect(typeof listSessions).toBe("function")
  })
})
