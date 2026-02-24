import { describe, expect, test } from "bun:test"
import { formatDuration, formatElapsed } from "../../src/util/format"

describe("util.format", () => {
  describe("formatDuration", () => {
    test("returns empty string for zero or negative values", () => {
      expect(formatDuration(0)).toBe("")
      expect(formatDuration(-1)).toBe("")
      expect(formatDuration(-100)).toBe("")
    })

    test("formats seconds under a minute", () => {
      expect(formatDuration(1)).toBe("1s")
      expect(formatDuration(30)).toBe("30s")
      expect(formatDuration(59)).toBe("59s")
    })

    test("formats minutes under an hour", () => {
      expect(formatDuration(60)).toBe("1m")
      expect(formatDuration(61)).toBe("1m 1s")
      expect(formatDuration(90)).toBe("1m 30s")
      expect(formatDuration(120)).toBe("2m")
      expect(formatDuration(330)).toBe("5m 30s")
      expect(formatDuration(3599)).toBe("59m 59s")
    })

    test("formats hours under a day", () => {
      expect(formatDuration(3600)).toBe("1h")
      expect(formatDuration(3660)).toBe("1h 1m")
      expect(formatDuration(7200)).toBe("2h")
      expect(formatDuration(8100)).toBe("2h 15m")
      expect(formatDuration(86399)).toBe("23h 59m")
    })

    test("formats days under a week", () => {
      expect(formatDuration(86400)).toBe("~1 day")
      expect(formatDuration(172800)).toBe("~2 days")
      expect(formatDuration(259200)).toBe("~3 days")
      expect(formatDuration(604799)).toBe("~6 days")
    })

    test("formats weeks", () => {
      expect(formatDuration(604800)).toBe("~1 week")
      expect(formatDuration(1209600)).toBe("~2 weeks")
      expect(formatDuration(1609200)).toBe("~2 weeks")
    })

    test("handles boundary values correctly", () => {
      expect(formatDuration(59)).toBe("59s")
      expect(formatDuration(60)).toBe("1m")
      expect(formatDuration(3599)).toBe("59m 59s")
      expect(formatDuration(3600)).toBe("1h")
      expect(formatDuration(86399)).toBe("23h 59m")
      expect(formatDuration(86400)).toBe("~1 day")
      expect(formatDuration(604799)).toBe("~6 days")
      expect(formatDuration(604800)).toBe("~1 week")
    })
  })

  describe("formatElapsed", () => {
    test("returns empty string for null", () => {
      expect(formatElapsed(null)).toBe("")
    })

    test("computes elapsed seconds from ISO timestamp", () => {
      const now = Date.now()
      const since = new Date(now - 272000).toISOString() // 4m 32s ago
      expect(formatElapsed(since, now)).toBe("4m 32s")
    })

    test("handles seconds elapsed", () => {
      const now = Date.now()
      const since = new Date(now - 30000).toISOString() // 30s ago
      expect(formatElapsed(since, now)).toBe("30s")
    })

    test("handles zero elapsed (rounds down to empty)", () => {
      const now = Date.now()
      const since = new Date(now).toISOString()
      expect(formatElapsed(since, now)).toBe("")
    })

    test("uses Date.now() when now not provided", () => {
      const since = new Date(Date.now() - 5000).toISOString() // ~5s ago
      const result = formatElapsed(since)
      // Should be "5s" but allow ±1s for test timing
      expect(["4s", "5s", "6s"]).toContain(result)
    })
  })
})
