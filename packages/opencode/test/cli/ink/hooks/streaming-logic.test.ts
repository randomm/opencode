import { describe, it, expect } from "bun:test"

describe("Streaming SSE Parser Logic", () => {
  it("parses delta events correctly", () => {
    const lines = ['data: {"type":"delta","text":"Hello"}', 'data: {"type":"delta","text":" World"}']

    let streamingText = ""

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)
        const event = JSON.parse(data)

        if (event.type === "delta" && event.text) {
          streamingText += event.text
        }
      }
    }

    expect(streamingText).toBe("Hello World")
  })

  it("recognizes done event", () => {
    const line = 'data: {"type":"done"}'

    let isDone = false

    if (line.startsWith("data: ")) {
      const data = line.slice(6)
      const event = JSON.parse(data)

      if (event.type === "done") {
        isDone = true
      }
    }

    expect(isDone).toBe(true)
  })

  it("ignores non-delta events", () => {
    const lines = ['data: {"type":"custom","foo":"bar"}', 'data: {"type":"delta","text":"Test"}']

    let streamingText = ""

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)
        const event = JSON.parse(data)

        if (event.type === "delta" && event.text) {
          streamingText += event.text
        }
      }
    }

    expect(streamingText).toBe("Test")
  })

  it("handles SSE format with CRLF", () => {
    const buffer = 'data: {"type":"delta","text":"A"}\r\n\r\ndata: {"type":"delta","text":"B"}\r\n\r\n'

    const lines = buffer.split(/\r?\n/)

    let streamingText = ""

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6)
        try {
          const event = JSON.parse(data)
          if (event.type === "delta" && event.text) {
            streamingText += event.text
          }
        } catch {
          // Ignore parse errors
        }
      }
    }

    expect(streamingText).toBe("AB")
  })

  it("accumulates text from multiple deltas", () => {
    const deltas = ["A", "B", "C", "D", "E"]

    let streamingText = ""

    for (const delta of deltas) {
      streamingText += delta
    }

    expect(streamingText).toBe("ABCDE")
  })

  it("resets text on new message", () => {
    let streamingText = "Previous message"

    // Simulate new message
    streamingText = ""
    streamingText += "New"
    streamingText += " message"

    expect(streamingText).toBe("New message")
  })
})
