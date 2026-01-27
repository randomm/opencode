import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { select, type SelectOption } from "../../../src/cli/lite/select"

describe("select", () => {
  let originalStdin: typeof process.stdin
  let originalStdout: typeof process.stdout

  beforeEach(() => {
    originalStdin = process.stdin
    originalStdout = process.stdout
  })

  afterEach(() => {
    process.stdin = originalStdin
    process.stdout = originalStdout
  })

  test("should return null when no options provided", async () => {
    const result = await select([], "Select:")
    expect(result).toBe(null)
  })

  test("should return null when ESC is pressed", async () => {
    const options: SelectOption<string>[] = [
      { label: "Option 1", value: "opt1" },
      { label: "Option 2", value: "opt2" },
    ]

    const promise = select(options, "Select:")

    process.nextTick(() => {
      process.stdin.push(new Uint8Array([0x1b]))
    })

    const result = await promise
    expect(result).toBe(null)
  })

  test("should return selected value when Enter is pressed", async () => {})
})
