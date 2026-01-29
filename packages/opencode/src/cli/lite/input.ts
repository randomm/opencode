import { cursor, write } from "./terminal"

export interface Key {
  name: string
  char?: string
  ctrl?: boolean
  meta?: boolean
}

export function parseKey(data: Buffer): Key {
  const s = data.toString()

  // Control characters
  if (s === "\x03") return { name: "c", ctrl: true }
  if (s === "\x04") return { name: "d", ctrl: true }
  if (s === "\x0c") return { name: "l", ctrl: true }
  if (s === "\x18") return { name: "x", ctrl: true }

  // Special keys
  if (s === "\r" || s === "\n") return { name: "return" }
  if (s === "\x7f" || s === "\b") return { name: "backspace" }
  if (s === "\t") return { name: "tab" }
  if (s === "\x1b[Z") return { name: "shift_tab" }
  if (s === "\x1b") return { name: "escape" }

  // Arrow keys
  if (s === "\x1b[A") return { name: "up" }
  if (s === "\x1b[B") return { name: "down" }
  if (s === "\x1b[C") return { name: "right" }
  if (s === "\x1b[D") return { name: "left" }

  // Home/End
  if (s === "\x1b[H" || s === "\x1b[1~") return { name: "home" }
  if (s === "\x1b[F" || s === "\x1b[4~") return { name: "end" }

  // Delete
  if (s === "\x1b[3~") return { name: "delete" }

  // Regular character
  if (s.length === 1 && s >= " ") return { name: "char", char: s }

  return { name: "unknown", char: s }
}

export class LineEditor {
  line = ""
  cursor = 0
  history: string[] = []
  historyIndex = -1

  render(prompt: string) {
    write(`\r${prompt}${this.line}${" ".repeat(10)}\r${prompt}`)
    if (this.cursor > 0) {
      write(cursor.forward(this.cursor))
    }
  }

  handle(key: Key): string | null {
    if (key.name === "return") {
      const result = this.line
      if (result.trim()) {
        this.history.push(result)
      }
      this.line = ""
      this.cursor = 0
      this.historyIndex = -1
      return result
    }

    if (key.name === "backspace" && this.cursor > 0) {
      this.line = this.line.slice(0, this.cursor - 1) + this.line.slice(this.cursor)
      this.cursor--
    }

    if (key.name === "delete" && this.cursor < this.line.length) {
      this.line = this.line.slice(0, this.cursor) + this.line.slice(this.cursor + 1)
    }

    if (key.name === "left" && this.cursor > 0) {
      this.cursor--
    }

    if (key.name === "right" && this.cursor < this.line.length) {
      this.cursor++
    }

    if (key.name === "home") {
      this.cursor = 0
    }

    if (key.name === "end") {
      this.cursor = this.line.length
    }

    if (key.name === "up" && this.history.length > 0) {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++
        this.line = this.history[this.history.length - 1 - this.historyIndex]
        this.cursor = this.line.length
      }
    }

    if (key.name === "down") {
      if (this.historyIndex > 0) {
        this.historyIndex--
        this.line = this.history[this.history.length - 1 - this.historyIndex]
        this.cursor = this.line.length
      } else if (this.historyIndex === 0) {
        this.historyIndex = -1
        this.line = ""
        this.cursor = 0
      }
    }

    if (key.name === "char" && key.char) {
      this.line = this.line.slice(0, this.cursor) + key.char + this.line.slice(this.cursor)
      this.cursor++
    }

    // Ctrl+L to clear
    if (key.ctrl && key.name === "l") {
      return "/clear"
    }

    return null
  }
}
