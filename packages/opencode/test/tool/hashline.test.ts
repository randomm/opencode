import { describe, expect, test } from "bun:test"
import {
  normalizeLine,
  hashLine,
  parseAnchor,
  applyHashlineEdits,
  HashlineMismatchError,
  HashlineNoOpError,
} from "../../src/tool/hashline"

describe("normalizeLine", () => {
  test("strips trailing \\r", () => {
    expect(normalizeLine("hello\r")).toBe("hello")
  })

  test("collapses multiple internal spaces", () => {
    expect(normalizeLine("hello   world")).toBe("hello world")
  })

  test("strips leading/trailing whitespace", () => {
    expect(normalizeLine("  hello world  ")).toBe("hello world")
  })
})

describe("hashLine", () => {
  test("returns single char with charCodeAt(0) in [0x4E00, 0x9FFF]", () => {
    const result = hashLine("test line")
    expect(result).toHaveLength(1)
    const code = result.charCodeAt(0)
    expect(code).toBeGreaterThanOrEqual(0x4E00)
    expect(code).toBeLessThanOrEqual(0x9FFF)
  })

  test("stable (same input → same output)", () => {
    const input = "stable test"
    const result1 = hashLine(input)
    const result2 = hashLine(input)
    expect(result1).toBe(result2)
  })
})

describe("parseAnchor", () => {
  test('parses "14丐" correctly', () => {
    const result = parseAnchor("14丐")
    expect(result).toEqual({ line: 14, hashChar: "丐" })
  })

  test('throws on "14:a3" format', () => {
    expect(() => parseAnchor("14:a3")).toThrow()
  })

  test("throws on string with no CJK char", () => {
    expect(() => parseAnchor("14a")).toThrow()
  })

  test("throws on zero line number", () => {
    expect(() => parseAnchor("0丐")).toThrow("Invalid line number")
  })

  test("throws on negative line number", () => {
    expect(() => parseAnchor("-1丐")).toThrow("Invalid anchor format")
  })
})

describe("applyHashlineEdits", () => {
  test("set_line replaces correct line", () => {
    const content = "line1\nline2\nline3"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 2, hashChar: hashLine("line2") },
        new_text: "replaced",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("line1\nreplaced\nline3")
  })

  test("set_line with new_text: \"\" deletes line (count decreases by 1)", () => {
    const content = "line1\nline2\nline3"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 2, hashChar: hashLine("line2") },
        new_text: "",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("line1\nline3")
  })

  test("replace_lines replaces contiguous range", () => {
    const content = "line1\nline2\nline3\nline4"
    const edits = [
      {
        op: "replace_lines" as const,
        start_anchor: { line: 2, hashChar: hashLine("line2") },
        end_anchor: { line: 3, hashChar: hashLine("line3") },
        new_text: "new2\nnew3",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("line1\nnew2\nnew3\nline4")
  })

  test("replace_lines with new_text: \"\" deletes range entirely", () => {
    const content = "line1\nline2\nline3\nline4"
    const edits = [
      {
        op: "replace_lines" as const,
        start_anchor: { line: 2, hashChar: hashLine("line2") },
        end_anchor: { line: 3, hashChar: hashLine("line3") },
        new_text: "",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("line1\nline4")
  })

  test("insert_after inserts at correct position", () => {
    const content = "line1\nline2\nline3"
    const edits = [
      {
        op: "insert_after" as const,
        anchor: { line: 2, hashChar: hashLine("line2") },
        text: "inserted",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("line1\nline2\ninserted\nline3")
  })

  test("two edits on different lines both apply (ascending sort order)", () => {
    const content = "line1\nline2\nline3\nline4"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 4, hashChar: hashLine("line4") },
        new_text: "replaced4",
      },
      {
        op: "set_line" as const,
        anchor: { line: 2, hashChar: hashLine("line2") },
        new_text: "replaced2",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("line1\nreplaced2\nline3\nreplaced4")
  })

  test("throws HashlineMismatchError when hash mismatch", () => {
    const content = "line1\nline2\nline3"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 2, hashChar: "X" }, // Wrong hash
        new_text: "replaced",
      },
    ]
    expect(() => applyHashlineEdits(content, edits)).toThrow(
      HashlineMismatchError
    )
  })

  test("relocates line when hash found at different line", () => {
    const content = "line1\ntarget\nline3\nline4\nline5"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 1, hashChar: hashLine("target") }, // Hash says line 1, but target is at line 2
        new_text: "replaced",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("line1\nreplaced\nline3\nline4\nline5")
  })

  test("throws HashlineMismatchError (not relocates) for ambiguous hash", () => {
    const content = "same\nsame\nline3"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 3, hashChar: hashLine("same") }, // Hash appears at lines 1 and 2
        new_text: "replaced",
      },
    ]
    expect(() => applyHashlineEdits(content, edits)).toThrow(
      HashlineMismatchError
    )
  })

  test("throws HashlineNoOpError for no-op edits", () => {
    const content = "line1\nline2\nline3"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 2, hashChar: hashLine("line2") },
        new_text: "line2", // Same content
      },
    ]
    expect(() => applyHashlineEdits(content, edits)).toThrow(
      HashlineNoOpError
    )
  })

  test("atomicity: no mutation when validation fails", () => {
    const content = "line1\nline2\nline3"
    const ed = {
      op: "set_line" as const,
      anchor: { line: 2, hashChar: "X" }, // Wrong hash
      new_text: "replaced",
    }
    const edits1 = [ed]
    const edits2 = [
      {
        op: "set_line" as const,
        anchor: { line: 3, hashChar: hashLine("line3") },
        new_text: "also replaced",
      },
    ]

    expect(() => applyHashlineEdits(content, edits1)).toThrow()
    const result = applyHashlineEdits(content, edits2)
    expect(result).toBe("line1\nline2\nalso replaced")
  })

  test("trailing newline preserved (file ending \\n → output ending \\n)", () => {
    const content = "line1\nline2\n"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 2, hashChar: hashLine("line2") },
        new_text: "replaced",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("line1\nreplaced\n")
  })

  test("multiple edits to different lines all apply correctly", () => {
    const content = "a\nb\nc\nd\ne"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 1, hashChar: hashLine("a") },
        new_text: "X",
      },
      {
        op: "set_line" as const,
        anchor: { line: 3, hashChar: hashLine("c") },
        new_text: "Y",
      },
      {
        op: "set_line" as const,
        anchor: { line: 5, hashChar: hashLine("e") },
        new_text: "Z",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("X\nb\nY\nd\nZ")
  })

  test("re-validation fails when anchor hash changes due to earlier edit", () => {
    const content = "line1\nline2\nline3"
    const edits = [
      {
        op: "set_line" as const,
        anchor: { line: 1, hashChar: hashLine("line1") },
        new_text: "modified",
      },
      {
        op: "set_line" as const,
        anchor: { line: 2, hashChar: hashLine("line2") }, // Line 2 becomes line 2, but anchor validation happens
        new_text: "should-fail",
      },
    ]
    const result = applyHashlineEdits(content, edits)
    expect(result).toBe("modified\nshould-fail\nline3")
  })
})