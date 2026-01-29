import { style, fg } from "./terminal"

const BOLD_MARK = "**"
const CODE_MARK = "`"
const CODE_FENCE = "```"
const RESET = style.reset

interface MarkdownState {
  buffer: string
  inBold: boolean
  inCode: boolean
  inCodeBlock: boolean
  codeBlockLang: string
}

export function createMarkdownRenderer() {
  const state: MarkdownState = {
    buffer: "",
    inBold: false,
    inCode: false,
    inCodeBlock: false,
    codeBlockLang: "",
  }

  function render(chunk: string): string {
    state.buffer += chunk
    let output = ""
    let i = 0

    while (i < state.buffer.length) {
      // Check for code block fence (must be at line start)
      if (isLineStart(state.buffer, i) && state.buffer.slice(i).startsWith(CODE_FENCE)) {
        const endFence = state.buffer.indexOf("\n", i + CODE_FENCE.length)
        const fence = endFence === -1 ? state.buffer.slice(i) : state.buffer.slice(i, endFence)

        // Incomplete fence line
        if (endFence === -1) {
          state.buffer = state.buffer.slice(i)
          return output
        }

        if (state.inCodeBlock) {
          // Closing fence
          output += `${fg.gray}${fence}${RESET}\n`
          state.inCodeBlock = false
          state.codeBlockLang = ""
          i = endFence + 1
        } else {
          // Opening fence
          const lang = fence.slice(CODE_FENCE.length).trim()
          state.codeBlockLang = lang
          state.inCodeBlock = true
          output += `${fg.gray}${fence}${RESET}\n`
          i = endFence + 1
        }
        continue
      }

      // Inside code block—pass through with styling
      if (state.inCodeBlock) {
        const lineEnd = state.buffer.indexOf("\n", i)
        const line = lineEnd === -1 ? state.buffer.slice(i) : state.buffer.slice(i, lineEnd + 1)

        if (lineEnd === -1) {
          state.buffer = state.buffer.slice(i)
          return output
        }

        output += `${fg.cyan}${line}${RESET}`
        i = lineEnd + 1
        continue
      }

      // Check for inline code (single backtick)
      if (state.buffer[i] === CODE_MARK && !state.inBold) {
        // Need at least one more backtick to form a pair
        if (i + 1 >= state.buffer.length) {
          state.buffer = state.buffer.slice(i)
          return output
        }

        // Find closing backtick
        const nextTick = state.buffer.indexOf(CODE_MARK, i + 1)
        if (nextTick === -1) {
          // Incomplete code span
          state.buffer = state.buffer.slice(i)
          return output
        }

        const code = state.buffer.slice(i + 1, nextTick)
        output += `${fg.cyan}${code}${RESET}`
        i = nextTick + 1
        continue
      }

      // Check for bold (double asterisk)
      if (state.buffer.slice(i, i + 2) === BOLD_MARK && !state.inCode) {
        state.inBold = !state.inBold
        output += state.inBold ? style.bold : RESET
        i += 2
        continue
      }

      // Check for header (at line start with #)
      if (isLineStart(state.buffer, i) && state.buffer[i] === "#") {
        const lineEnd = state.buffer.indexOf("\n", i)
        const line = lineEnd === -1 ? state.buffer.slice(i) : state.buffer.slice(i, lineEnd)

        if (lineEnd === -1) {
          state.buffer = state.buffer.slice(i)
          return output
        }

        const match = line.match(/^(#{1,6})\s+(.+)/)
        if (match) {
          const header = match[2]
          output += `${style.bold}${fg.cyan}${header}${RESET}\n`
          i = lineEnd + 1
          continue
        }
      }

      // Check for horizontal rule (--- at line start)
      if (isLineStart(state.buffer, i) && state.buffer.slice(i, i + 3) === "---") {
        const lineEnd = state.buffer.indexOf("\n", i)
        const line = lineEnd === -1 ? state.buffer.slice(i) : state.buffer.slice(i, lineEnd)

        if (lineEnd === -1) {
          state.buffer = state.buffer.slice(i)
          return output
        }

        if (/^-{3,}(\s|$)/.test(line)) {
          output += `${fg.gray}${line}${RESET}\n`
          i = lineEnd + 1
          continue
        }
      }

      // Regular character
      output += state.buffer[i]
      i++
    }

    state.buffer = ""
    return output
  }

  function flush(): string {
    let output = state.buffer
    state.buffer = ""

    // Close any open ANSI sequences
    if (state.inBold || state.inCode || state.inCodeBlock) {
      output += RESET
    }

    // Reset state for safety
    state.inBold = false
    state.inCode = false
    state.inCodeBlock = false
    state.codeBlockLang = ""

    return output
  }

  return { render, flush }
}

function isLineStart(text: string, pos: number): boolean {
  if (pos === 0) return true
  return text[pos - 1] === "\n"
}
