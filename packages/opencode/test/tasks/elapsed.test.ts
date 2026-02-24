import { describe, expect, test } from "bun:test"
import { formatElapsed } from "../../src/tasks/elapsed"

describe("formatElapsed", () => {
  test("0ms returns '0s'", () => {
    expect(formatElapsed(0)).toBe("0s")
  })

  test("5000ms returns '5s'", () => {
    expect(formatElapsed(5000)).toBe("5s")
  })

  test("59000ms returns '59s'", () => {
    expect(formatElapsed(59000)).toBe("59s")
  })

  test("exact minute boundary: 60000ms returns '1m 0s'", () => {
    expect(formatElapsed(60000)).toBe("1m 0s")
  })

  test("272000ms returns '4m 32s'", () => {
    expect(formatElapsed(272000)).toBe("4m 32s")
  })

  test("exact hour boundary: 3600000ms returns '1h 0m'", () => {
    expect(formatElapsed(3600000)).toBe("1h 0m")
  })

  test("3900000ms returns '1h 5m'", () => {
    expect(formatElapsed(3900000)).toBe("1h 5m")
  })

  test("large value: 7322000ms returns '2h 2m'", () => {
    expect(formatElapsed(7322000)).toBe("2h 2m")
  })
})
