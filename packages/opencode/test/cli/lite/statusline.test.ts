import { describe, it, expect } from "bun:test"
import type { StatusLineState } from "../../../src/cli/lite/statusline"
import { renderStatusLine } from "../../../src/cli/lite/statusline"

describe("statusline", () => {
  it("renders status line with default state", () => {
    const state: StatusLineState = {
      activity: "Ruminating…",
      duration: 15000,
      tokens: 342,
      tasksVisible: false,
    }

    const result = renderStatusLine(state)
    expect(result).toContain("Ruminating…")
    expect(result).toContain("Esc to interrupt")
    expect(result).toContain("ctrl+t to show tasks")
    expect(result).toContain("15s")
    expect(result).toContain("342 tokens")
  })

  it("shows hide hint when tasks are visible", () => {
    const state: StatusLineState = {
      activity: "Thinking…",
      duration: 5000,
      tokens: 100,
      tasksVisible: true,
    }

    const result = renderStatusLine(state)
    expect(result).toContain("ctrl+t to hide tasks")
  })

  it("formats tokens correctly for large numbers", () => {
    const state: StatusLineState = {
      activity: "Working…",
      duration: 30000,
      tokens: 5000,
      tasksVisible: false,
    }

    const result = renderStatusLine(state)
    expect(result).toContain("5k tokens")
  })

  it("exports StatusLineState interface", () => {
    const state: StatusLineState = {
      activity: "Test",
      duration: 1000,
      tokens: 10,
      tasksVisible: false,
    }
    expect(state.activity).toBe("Test")
  })

  it("uses cyan color for symbol", () => {
    const state: StatusLineState = {
      activity: "Test…",
      duration: 0,
      tokens: 0,
      tasksVisible: false,
    }

    const result = renderStatusLine(state)
    expect(result).toContain("\x1b[96m")
  })
})
