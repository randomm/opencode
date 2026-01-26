import { describe, expect, test } from "bun:test"
import { formatTokens, formatDuration, formatAgentMetrics, type AgentMetrics } from "../../src/cli/metrics"

describe("cli.metrics", () => {
  describe("formatTokens", () => {
    test("returns zero tokens string for zero", () => {
      expect(formatTokens(0)).toBe("0 tokens")
    })

    test("handles negative token counts", () => {
      expect(formatTokens(-1)).toBe("0 tokens")
      expect(formatTokens(-100)).toBe("0 tokens")
      expect(formatTokens(-1000000)).toBe("0 tokens")
    })

    test("formats singular token correctly", () => {
      expect(formatTokens(1)).toBe("1 token")
    })

    test("formats tokens under 1000 without scaling", () => {
      expect(formatTokens(2)).toBe("2 tokens")
      expect(formatTokens(100)).toBe("100 tokens")
      expect(formatTokens(999)).toBe("999 tokens")
    })

    test("formats thousands with k suffix", () => {
      expect(formatTokens(1000)).toBe("1k tokens")
      expect(formatTokens(1500)).toBe("1.5k tokens")
      expect(formatTokens(10000)).toBe("10k tokens")
    })

    test("formats large numbers with k suffix", () => {
      expect(formatTokens(93700)).toBe("93.7k tokens")
      expect(formatTokens(99999)).toBe("100k tokens")
      expect(formatTokens(100000)).toBe("100k tokens")
    })

    test("rounds to one decimal place", () => {
      expect(formatTokens(1234)).toBe("1.2k tokens")
      expect(formatTokens(1567)).toBe("1.6k tokens")
      expect(formatTokens(1999)).toBe("2k tokens")
    })

    test("formats millions with m suffix", () => {
      expect(formatTokens(1000000)).toBe("1m tokens")
      expect(formatTokens(1500000)).toBe("1.5m tokens")
      expect(formatTokens(5000000)).toBe("5m tokens")
      expect(formatTokens(10000000)).toBe("10m tokens")
      expect(formatTokens(99999999)).toBe("100m tokens")
    })
  })

  describe("formatDuration", () => {
    test("handles future timestamps gracefully", () => {
      expect(formatDuration(-1000)).toBe("just started")
      expect(formatDuration(-500)).toBe("just started")
      expect(formatDuration(-1)).toBe("just started")
    })

    test("returns just started for zero and near-zero milliseconds", () => {
      expect(formatDuration(0)).toBe("just started")
      expect(formatDuration(500)).toBe("just started")
    })

    test("formats seconds under 60", () => {
      expect(formatDuration(1000)).toBe("~1s")
      expect(formatDuration(30000)).toBe("~30s")
      expect(formatDuration(59000)).toBe("~59s")
    })

    test("formats minutes", () => {
      expect(formatDuration(60000)).toBe("~1m")
      expect(formatDuration(90000)).toBe("~1m")
      expect(formatDuration(120000)).toBe("~2m")
      expect(formatDuration(300000)).toBe("~5m")
    })

    test("formats longer durations in minutes", () => {
      expect(formatDuration(600000)).toBe("~10m")
      expect(formatDuration(3600000)).toBe("~60m")
    })

    test("handles boundary values", () => {
      expect(formatDuration(999)).toBe("just started")
      expect(formatDuration(1000)).toBe("~1s")
      expect(formatDuration(59999)).toBe("~59s")
      expect(formatDuration(60000)).toBe("~1m")
    })
  })

  describe("formatAgentMetrics", () => {
    test("formats agent metrics with all components", () => {
      const now = Date.now()
      const agent: AgentMetrics = {
        name: "developer",
        activity: "Thinking",
        toolUses: 68,
        tokens: 93700,
        startedAt: now - 60000,
      }

      const result = formatAgentMetrics(agent)

      expect(result).toContain("developer:")
      expect(result).toContain("◇")
      expect(result).toContain("Thinking…")
      expect(result).toContain("68 tool uses")
      expect(result).toContain("93.7k tokens")
    })

    test("formats with same duration calculation regardless of time elapsed", () => {
      const now = Date.now()
      const agent: AgentMetrics = {
        name: "explore",
        activity: "Searching",
        toolUses: 5,
        tokens: 5000,
        startedAt: now - 120000,
      }

      const result = formatAgentMetrics(agent)
      expect(result).toContain("explore:")
      expect(result).toContain("Searching…")
      expect(result).toContain("5 tool uses")
      expect(result).toContain("5k tokens")
    })

    test("uses standard format with diamond symbol", () => {
      const now = Date.now()
      const agent: AgentMetrics = {
        name: "test-agent",
        activity: "Running",
        toolUses: 42,
        tokens: 12500,
        startedAt: now - 30000,
      }

      const result = formatAgentMetrics(agent)
      const expected = "test-agent: ◇ Running… · 42 tool uses · 12.5k tokens"

      expect(result).toContain("test-agent:")
      expect(result).toContain("◇")
      expect(result).toContain("Running…")
      expect(result).toContain("42 tool uses")
      expect(result).toContain("12.5k tokens")
    })

    test("handles just started duration correctly", () => {
      const now = Date.now()
      const agent: AgentMetrics = {
        name: "fresh",
        activity: "Initializing",
        toolUses: 0,
        tokens: 0,
        startedAt: now - 100,
      }

      const result = formatAgentMetrics(agent)
      expect(result).toContain("fresh:")
      expect(result).toContain("Initializing…")
      expect(result).toContain("0 tool uses")
      expect(result).toContain("0 tokens")
    })

    test("formats multiple agents independently", () => {
      const now = Date.now()
      const agents: AgentMetrics[] = [
        {
          name: "developer",
          activity: "Writing",
          toolUses: 10,
          tokens: 5000,
          startedAt: now - 30000,
        },
        {
          name: "explore",
          activity: "Searching",
          toolUses: 25,
          tokens: 15000,
          startedAt: now - 60000,
        },
      ]

      const results = agents.map(formatAgentMetrics)

      expect(results[0]).toContain("developer:")
      expect(results[0]).toContain("Writing…")
      expect(results[1]).toContain("explore:")
      expect(results[1]).toContain("Searching…")
    })

    test("strips ANSI escape sequences from activity", () => {
      const now = Date.now()
      const agent: AgentMetrics = {
        name: "test",
        activity: "Write\x1b[31mRed\x1b[0m Text",
        toolUses: 5,
        tokens: 1000,
        startedAt: now - 10000,
      }

      const result = formatAgentMetrics(agent)

      expect(result).not.toContain("\x1b")
      expect(result).toContain("WriteRed Text…")
    })

    test("handles null bytes and control characters", () => {
      const now = Date.now()
      const agent: AgentMetrics = {
        name: "test",
        activity: "Safe\x00Activity\x7fNow",
        toolUses: 3,
        tokens: 500,
        startedAt: now - 5000,
      }

      const result = formatAgentMetrics(agent)

      expect(result).not.toContain("\x00")
      expect(result).not.toContain("\x7f")
      expect(result).toContain("SafeActivityNow…")
    })
  })
})
