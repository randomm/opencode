export interface Anchor {
  line: number
  hashChar: string
}

export type HashlineEdit =
  | {
      op: "set_line"
      anchor: Anchor
      new_text: string
    }
  | {
      op: "replace_lines"
      start_anchor: Anchor
      end_anchor: Anchor
      new_text: string
    }
  | {
      op: "insert_after"
      anchor: Anchor
      text: string
    }
  | {
      op: "delete_file"
    }

export function normalizeLine(line: string): string {
  let result = line.replace(/\r$/, "")
  result = result.replace(/[ \t]+/g, " ")
  return result.trim()
}

export function hashLine(line: string): string {
  const normalized = normalizeLine(line)
  const hash = Bun.hash.xxHash32(normalized, 0)
  const codePoint = (hash % 20992) + 0x4e00
  return String.fromCharCode(codePoint)
}

export function parseAnchor(ref: string): Anchor {
  const match = ref.match(/^(\d+)([\u4e00-\u9fff])$/)
  if (!match) throw new Error(`Invalid anchor format: ${ref}`)
  const line = Number(match[1])
  if (line < 1) throw new Error(`Invalid line number: ${line} (must be >= 1)`)
  if (!Number.isSafeInteger(line)) throw new Error(`Invalid line number: ${line}`)
  return { line, hashChar: match[2] }
}

export class HashlineMismatchError extends Error {
  constructor(
    mismatches: { ref: string; error: string }[],
    currentLines: string
  ) {
    const mismatchedRefs = mismatches.map((m) => m.ref).join(", ")
    super(
      `${mismatches.length} line(s) have changed since last read. Use the updated LINE꜀ references shown below (→ marks changed lines):\n\n${currentLines}`
    )
    this.name = "HashlineMismatchError"
  }
}

export class HashlineNoOpError extends Error {
  constructor(detail: string) {
    super(`No-op edit detected: ${detail}`)
    this.name = "HashlineNoOpError"
  }
}

export function applyHashlineEdits(content: string, edits: HashlineEdit[]): string {
  if (edits.length === 0) return content

  const lines = content.split("\n")

  const lineMap = new Map<number, string>()
  lines.forEach((line, i) => {
    lineMap.set(i + 1, hashLine(line))
  })

  const mismatches: { ref: string; error: string }[] = []
  const relocatedMap: Map<number, number> = new Map()

  for (const edit of edits) {
    // Skip delete_file operations - they don't have anchors to validate
    if (edit.op === "delete_file") continue

    const anchors = [
      ...(edit.op === "set_line"
        ? [edit.anchor]
        : edit.op === "replace_lines"
        ? [edit.start_anchor, edit.end_anchor]
        : [edit.anchor]),
    ]

    for (const anchor of anchors) {
      const ref = `${anchor.line}${anchor.hashChar}`
      const expectedHash = anchor.hashChar
      const actualHash = lineMap.get(anchor.line)

      if (actualHash === expectedHash) continue

      const matchingLines: number[] = []
      lineMap.forEach((hash, line) => {
        if (hash === expectedHash) matchingLines.push(line)
      })

      if (matchingLines.length === 0) {
        mismatches.push({ ref, error: "hash not found" })
      } else if (matchingLines.length === 1) {
        const newLine = matchingLines[0]
        if (!relocatedMap.has(anchor.line)) {
          relocatedMap.set(anchor.line, newLine)
        }
      } else {
        mismatches.push({ ref, error: "ambiguous hash found at multiple lines" })
      }
    }
  }

  if (mismatches.length > 0) {
    const currentLinesWithMarkers = lines
      .map((line, i) => {
        const markers = mismatches
          .filter((m) => m.ref.startsWith(`${i + 1}`))
          .map(() => "→")
          .join("")
        return `${markers}${i + 1}${hashLine(line)}${line}`
      })
      .join("\n")
    throw new HashlineMismatchError(mismatches, currentLinesWithMarkers)
  }

  const sortedEdits = [...edits].sort((a, b) => {
    const getOriginalLine = (e: HashlineEdit): number => {
      if (e.op === "delete_file") return Infinity
      if (e.op === "replace_lines") return e.start_anchor.line
      return e.anchor.line
    }
    const lineA = getOriginalLine(a)
    const lineB = getOriginalLine(b)
    return lineA - lineB
  })

  const resultLines = [...lines]

  for (const edit of sortedEdits) {
    const getLine = (anchor: Anchor): number => {
      return relocatedMap.get(anchor.line) ?? anchor.line
    }

    if (edit.op === "set_line") {
      const line = getLine(edit.anchor)
      if (line < 1 || line > resultLines.length) {
        throw new Error(
          `Invalid line ${line}: must be between 1 and ${resultLines.length}`
        )
      }
      const currentHash = hashLine(resultLines[line - 1])
      if (currentHash !== edit.anchor.hashChar) {
        const currentLinesWithMarkers = resultLines
          .map((l, i) => `${i + 1}${hashLine(l)}${l}`)
          .join("\n")
        throw new HashlineMismatchError(
          [{ ref: `${edit.anchor.line}${edit.anchor.hashChar}`, error: "hash mismatch after editing" }],
          currentLinesWithMarkers
        )
      }
      if (edit.new_text === "") {
        resultLines.splice(line - 1, 1)
      } else {
        resultLines[line - 1] = edit.new_text
      }
    } else if (edit.op === "replace_lines") {
      const start = getLine(edit.start_anchor)
      const end = getLine(edit.end_anchor)
      if (start < 1 || start > resultLines.length || end < start || end > resultLines.length) {
        throw new Error(
          `Invalid range ${start}-${end}: must be between 1 and ${resultLines.length} with start <= end`
        )
      }
      if (edit.new_text === "") {
        resultLines.splice(start - 1, end - start + 1)
      } else {
        const newLines = edit.new_text.split("\n")
        resultLines.splice(start - 1, end - start + 1, ...newLines)
      }
    } else if (edit.op === "insert_after") {
      const line = getLine(edit.anchor)
      if (line < 1 || line > resultLines.length) {
        throw new Error(
          `Invalid line ${line}: must be between 1 and ${resultLines.length}`
        )
      }
      const currentHash = hashLine(resultLines[line - 1])
      if (currentHash !== edit.anchor.hashChar) {
        const currentLinesWithMarkers = resultLines
          .map((l, i) => `${i + 1}${hashLine(l)}${l}`)
          .join("\n")
        throw new HashlineMismatchError(
          [{ ref: `${edit.anchor.line}${edit.anchor.hashChar}`, error: "hash mismatch after editing" }],
          currentLinesWithMarkers
        )
      }
      const newLines = edit.text.split("\n")
      resultLines.splice(line, 0, ...newLines)
    }
  }

  const result = resultLines.join("\n")
  if (result === content) {
    throw new HashlineNoOpError("edits result in identical content")
  }

  return result
}
