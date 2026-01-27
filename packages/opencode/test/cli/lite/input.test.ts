import { describe, test, expect } from "bun:test"
import { parseKey, LineEditor } from "../../../src/cli/lite/input"

describe("parseKey", () => {
  describe("control characters", () => {
    test("parses ctrl+c", () => {
      const key = parseKey(Buffer.from("\x03"))
      expect(key.name).toBe("c")
      expect(key.ctrl).toBe(true)
    })

    test("parses ctrl+d", () => {
      const key = parseKey(Buffer.from("\x04"))
      expect(key.name).toBe("d")
      expect(key.ctrl).toBe(true)
    })

    test("parses ctrl+l", () => {
      const key = parseKey(Buffer.from("\x0c"))
      expect(key.name).toBe("l")
      expect(key.ctrl).toBe(true)
    })

    test("parses ctrl+x", () => {
      const key = parseKey(Buffer.from("\x18"))
      expect(key.name).toBe("x")
      expect(key.ctrl).toBe(true)
    })
  })

  describe("special keys", () => {
    test("parses return key (carriage return)", () => {
      const key = parseKey(Buffer.from("\r"))
      expect(key.name).toBe("return")
      expect(key.ctrl).toBe(undefined)
    })

    test("parses return key (newline)", () => {
      const key = parseKey(Buffer.from("\n"))
      expect(key.name).toBe("return")
      expect(key.ctrl).toBe(undefined)
    })

    test("parses backspace (DEL)", () => {
      const key = parseKey(Buffer.from("\x7f"))
      expect(key.name).toBe("backspace")
    })

    test("parses backspace (BS)", () => {
      const key = parseKey(Buffer.from("\b"))
      expect(key.name).toBe("backspace")
    })

    test("parses tab", () => {
      const key = parseKey(Buffer.from("\t"))
      expect(key.name).toBe("tab")
    })

    test("parses shift+tab", () => {
      const key = parseKey(Buffer.from("\x1b[Z"))
      expect(key.name).toBe("shift_tab")
    })

    test("parses escape", () => {
      const key = parseKey(Buffer.from("\x1b"))
      expect(key.name).toBe("escape")
    })
  })

  describe("arrow keys", () => {
    test("parses up arrow", () => {
      const key = parseKey(Buffer.from("\x1b[A"))
      expect(key.name).toBe("up")
    })

    test("parses down arrow", () => {
      const key = parseKey(Buffer.from("\x1b[B"))
      expect(key.name).toBe("down")
    })

    test("parses right arrow", () => {
      const key = parseKey(Buffer.from("\x1b[C"))
      expect(key.name).toBe("right")
    })

    test("parses left arrow", () => {
      const key = parseKey(Buffer.from("\x1b[D"))
      expect(key.name).toBe("left")
    })
  })

  describe("navigation keys", () => {
    test("parses home (H sequence)", () => {
      const key = parseKey(Buffer.from("\x1b[H"))
      expect(key.name).toBe("home")
    })

    test("parses home (1~ sequence)", () => {
      const key = parseKey(Buffer.from("\x1b[1~"))
      expect(key.name).toBe("home")
    })

    test("parses end (F sequence)", () => {
      const key = parseKey(Buffer.from("\x1b[F"))
      expect(key.name).toBe("end")
    })

    test("parses end (4~ sequence)", () => {
      const key = parseKey(Buffer.from("\x1b[4~"))
      expect(key.name).toBe("end")
    })

    test("parses delete", () => {
      const key = parseKey(Buffer.from("\x1b[3~"))
      expect(key.name).toBe("delete")
    })
  })

  describe("regular characters", () => {
    test("parses single letter", () => {
      const key = parseKey(Buffer.from("a"))
      expect(key.name).toBe("char")
      expect(key.char).toBe("a")
    })

    test("parses uppercase letter", () => {
      const key = parseKey(Buffer.from("Z"))
      expect(key.name).toBe("char")
      expect(key.char).toBe("Z")
    })

    test("parses digit", () => {
      const key = parseKey(Buffer.from("5"))
      expect(key.name).toBe("char")
      expect(key.char).toBe("5")
    })

    test("parses space", () => {
      const key = parseKey(Buffer.from(" "))
      expect(key.name).toBe("char")
      expect(key.char).toBe(" ")
    })

    test("parses special character", () => {
      const key = parseKey(Buffer.from("@"))
      expect(key.name).toBe("char")
      expect(key.char).toBe("@")
    })

    test("parses punctuation", () => {
      const key = parseKey(Buffer.from("."))
      expect(key.name).toBe("char")
      expect(key.char).toBe(".")
    })
  })

  describe("unknown sequences", () => {
    test("returns unknown for unrecognized escape sequence", () => {
      const key = parseKey(Buffer.from("\x1b[99~"))
      expect(key.name).toBe("unknown")
      expect(key.char).toBe("\x1b[99~")
    })

    test("returns unknown for multi-byte unrecognized sequence", () => {
      const key = parseKey(Buffer.from("\x1b\x1b\x1b"))
      expect(key.name).toBe("unknown")
    })

    test("returns unknown for control character below space", () => {
      const key = parseKey(Buffer.from("\x01"))
      expect(key.name).toBe("unknown")
    })
  })
})

describe("LineEditor", () => {
  describe("initialization", () => {
    test("starts with empty line", () => {
      const editor = new LineEditor()
      expect(editor.line).toBe("")
    })

    test("starts with cursor at position 0", () => {
      const editor = new LineEditor()
      expect(editor.cursor).toBe(0)
    })

    test("starts with empty history", () => {
      const editor = new LineEditor()
      expect(editor.history).toEqual([])
    })

    test("starts with historyIndex at -1", () => {
      const editor = new LineEditor()
      expect(editor.historyIndex).toBe(-1)
    })
  })

  describe("character insertion", () => {
    test("inserts character at cursor position", () => {
      const editor = new LineEditor()
      editor.handle({ name: "char", char: "a" })
      expect(editor.line).toBe("a")
      expect(editor.cursor).toBe(1)
    })

    test("inserts multiple characters", () => {
      const editor = new LineEditor()
      editor.handle({ name: "char", char: "h" })
      editor.handle({ name: "char", char: "i" })
      expect(editor.line).toBe("hi")
      expect(editor.cursor).toBe(2)
    })

    test("inserts character in middle of text", () => {
      const editor = new LineEditor()
      editor.line = "ac"
      editor.cursor = 1
      editor.handle({ name: "char", char: "b" })
      expect(editor.line).toBe("abc")
      expect(editor.cursor).toBe(2)
    })

    test("inserts character at beginning of text", () => {
      const editor = new LineEditor()
      editor.line = "bc"
      editor.cursor = 0
      editor.handle({ name: "char", char: "a" })
      expect(editor.line).toBe("abc")
      expect(editor.cursor).toBe(1)
    })

    test("ignores character event without char property", () => {
      const editor = new LineEditor()
      editor.handle({ name: "char" })
      expect(editor.line).toBe("")
      expect(editor.cursor).toBe(0)
    })
  })

  describe("backspace", () => {
    test("deletes character before cursor", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 3
      editor.handle({ name: "backspace" })
      expect(editor.line).toBe("ab")
      expect(editor.cursor).toBe(2)
    })

    test("deletes character from middle", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 2
      editor.handle({ name: "backspace" })
      expect(editor.line).toBe("ac")
      expect(editor.cursor).toBe(1)
    })

    test("does nothing at beginning of line", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 0
      editor.handle({ name: "backspace" })
      expect(editor.line).toBe("abc")
      expect(editor.cursor).toBe(0)
    })

    test("handles backspace on empty line", () => {
      const editor = new LineEditor()
      editor.handle({ name: "backspace" })
      expect(editor.line).toBe("")
      expect(editor.cursor).toBe(0)
    })
  })

  describe("delete key", () => {
    test("deletes character at cursor position", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 0
      editor.handle({ name: "delete" })
      expect(editor.line).toBe("bc")
      expect(editor.cursor).toBe(0)
    })

    test("deletes character from middle", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 1
      editor.handle({ name: "delete" })
      expect(editor.line).toBe("ac")
      expect(editor.cursor).toBe(1)
    })

    test("does nothing at end of line", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 3
      editor.handle({ name: "delete" })
      expect(editor.line).toBe("abc")
      expect(editor.cursor).toBe(3)
    })

    test("handles delete on empty line", () => {
      const editor = new LineEditor()
      editor.handle({ name: "delete" })
      expect(editor.line).toBe("")
      expect(editor.cursor).toBe(0)
    })
  })

  describe("cursor movement", () => {
    test("moves cursor left", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 3
      editor.handle({ name: "left" })
      expect(editor.cursor).toBe(2)
    })

    test("does not move cursor left past beginning", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 0
      editor.handle({ name: "left" })
      expect(editor.cursor).toBe(0)
    })

    test("moves cursor right", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 0
      editor.handle({ name: "right" })
      expect(editor.cursor).toBe(1)
    })

    test("does not move cursor right past end", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 3
      editor.handle({ name: "right" })
      expect(editor.cursor).toBe(3)
    })

    test("home moves cursor to beginning", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 3
      editor.handle({ name: "home" })
      expect(editor.cursor).toBe(0)
    })

    test("home on empty line keeps cursor at 0", () => {
      const editor = new LineEditor()
      editor.handle({ name: "home" })
      expect(editor.cursor).toBe(0)
    })

    test("end moves cursor to end", () => {
      const editor = new LineEditor()
      editor.line = "abc"
      editor.cursor = 0
      editor.handle({ name: "end" })
      expect(editor.cursor).toBe(3)
    })

    test("end on empty line keeps cursor at 0", () => {
      const editor = new LineEditor()
      editor.handle({ name: "end" })
      expect(editor.cursor).toBe(0)
    })
  })

  describe("return key", () => {
    test("returns current line", () => {
      const editor = new LineEditor()
      editor.line = "hello"
      const result = editor.handle({ name: "return" })
      expect(result).toBe("hello")
    })

    test("clears line after return", () => {
      const editor = new LineEditor()
      editor.line = "hello"
      editor.handle({ name: "return" })
      expect(editor.line).toBe("")
    })

    test("resets cursor after return", () => {
      const editor = new LineEditor()
      editor.line = "hello"
      editor.cursor = 5
      editor.handle({ name: "return" })
      expect(editor.cursor).toBe(0)
    })

    test("adds non-empty line to history", () => {
      const editor = new LineEditor()
      editor.line = "hello"
      editor.handle({ name: "return" })
      expect(editor.history).toEqual(["hello"])
    })

    test("does not add empty line to history", () => {
      const editor = new LineEditor()
      editor.line = ""
      editor.handle({ name: "return" })
      expect(editor.history).toEqual([])
    })

    test("does not add whitespace-only line to history", () => {
      const editor = new LineEditor()
      editor.line = "   "
      editor.handle({ name: "return" })
      expect(editor.history).toEqual([])
    })

    test("resets historyIndex after return", () => {
      const editor = new LineEditor()
      editor.line = "test"
      editor.historyIndex = 5
      editor.handle({ name: "return" })
      expect(editor.historyIndex).toBe(-1)
    })

    test("builds history with multiple commands", () => {
      const editor = new LineEditor()
      editor.line = "first"
      editor.handle({ name: "return" })
      editor.line = "second"
      editor.handle({ name: "return" })
      expect(editor.history).toEqual(["first", "second"])
    })
  })

  describe("history navigation", () => {
    test("up arrow shows last command", () => {
      const editor = new LineEditor()
      editor.line = "first"
      editor.handle({ name: "return" })
      editor.handle({ name: "up" })
      expect(editor.line).toBe("first")
      expect(editor.cursor).toBe(5)
    })

    test("up arrow does nothing with empty history", () => {
      const editor = new LineEditor()
      editor.line = "current"
      editor.handle({ name: "up" })
      expect(editor.line).toBe("current")
    })

    test("up arrow navigates through history", () => {
      const editor = new LineEditor()
      editor.line = "first"
      editor.handle({ name: "return" })
      editor.line = "second"
      editor.handle({ name: "return" })

      editor.handle({ name: "up" })
      expect(editor.line).toBe("second")

      editor.handle({ name: "up" })
      expect(editor.line).toBe("first")
    })

    test("up arrow stops at oldest history entry", () => {
      const editor = new LineEditor()
      editor.line = "only"
      editor.handle({ name: "return" })

      editor.handle({ name: "up" })
      editor.handle({ name: "up" })
      expect(editor.line).toBe("only")
    })

    test("down arrow moves forward in history", () => {
      const editor = new LineEditor()
      editor.line = "first"
      editor.handle({ name: "return" })
      editor.line = "second"
      editor.handle({ name: "return" })

      editor.handle({ name: "up" })
      editor.handle({ name: "up" })
      editor.handle({ name: "down" })
      expect(editor.line).toBe("second")
    })

    test("down arrow clears line when at newest entry", () => {
      const editor = new LineEditor()
      editor.line = "first"
      editor.handle({ name: "return" })

      editor.handle({ name: "up" })
      editor.handle({ name: "down" })
      expect(editor.line).toBe("")
      expect(editor.cursor).toBe(0)
    })

    test("down arrow does nothing when not in history", () => {
      const editor = new LineEditor()
      editor.line = "current"
      editor.cursor = 7
      editor.handle({ name: "down" })
      expect(editor.line).toBe("current")
      expect(editor.cursor).toBe(7)
    })

    test("history navigation sets cursor to end", () => {
      const editor = new LineEditor()
      editor.line = "longcommand"
      editor.handle({ name: "return" })
      editor.cursor = 0

      editor.handle({ name: "up" })
      expect(editor.cursor).toBe(11)
    })
  })

  describe("ctrl+l clear", () => {
    test("returns /clear command", () => {
      const editor = new LineEditor()
      const result = editor.handle({ name: "l", ctrl: true })
      expect(result).toBe("/clear")
    })

    test("ctrl+l preserves current line", () => {
      const editor = new LineEditor()
      editor.line = "hello"
      editor.handle({ name: "l", ctrl: true })
      expect(editor.line).toBe("hello")
    })
  })

  describe("unrecognized keys", () => {
    test("ignores unknown key", () => {
      const editor = new LineEditor()
      editor.line = "test"
      editor.cursor = 4
      const result = editor.handle({ name: "unknown" })
      expect(result).toBe(null)
      expect(editor.line).toBe("test")
      expect(editor.cursor).toBe(4)
    })

    test("ignores ctrl+c", () => {
      const editor = new LineEditor()
      editor.line = "test"
      const result = editor.handle({ name: "c", ctrl: true })
      expect(result).toBe(null)
      expect(editor.line).toBe("test")
    })
  })

  describe("edge cases", () => {
    test("handles rapid character insertion", () => {
      const editor = new LineEditor()
      const chars = "rapid"
      for (const char of chars) {
        editor.handle({ name: "char", char: char })
      }
      expect(editor.line).toBe("rapid")
      expect(editor.cursor).toBe(5)
    })

    test("handles mixed operations", () => {
      const editor = new LineEditor()
      editor.handle({ name: "char", char: "a" })
      editor.handle({ name: "char", char: "b" })
      editor.handle({ name: "char", char: "c" })
      editor.handle({ name: "left" })
      editor.handle({ name: "backspace" })
      editor.handle({ name: "char", char: "x" })
      expect(editor.line).toBe("axc")
      expect(editor.cursor).toBe(2)
    })

    test("handles cursor at various positions with delete", () => {
      const editor = new LineEditor()
      editor.line = "abcdef"
      editor.cursor = 0
      editor.handle({ name: "delete" })
      expect(editor.line).toBe("bcdef")

      editor.cursor = 2
      editor.handle({ name: "delete" })
      expect(editor.line).toBe("bcef")
    })

    test("handles empty operations", () => {
      const editor = new LineEditor()
      editor.handle({ name: "left" })
      editor.handle({ name: "right" })
      editor.handle({ name: "backspace" })
      editor.handle({ name: "delete" })
      editor.handle({ name: "home" })
      editor.handle({ name: "end" })
      expect(editor.line).toBe("")
      expect(editor.cursor).toBe(0)
    })
  })

  describe("render", () => {
    test("renders without throwing error", () => {
      const editor = new LineEditor()
      editor.line = "test"
      editor.cursor = 2
      expect(() => editor.render("> ")).not.toThrow()
    })

    test("renders empty line", () => {
      const editor = new LineEditor()
      expect(() => editor.render("$ ")).not.toThrow()
    })

    test("renders with cursor at end", () => {
      const editor = new LineEditor()
      editor.line = "hello"
      editor.cursor = 5
      expect(() => editor.render("> ")).not.toThrow()
    })

    test("renders with cursor at beginning", () => {
      const editor = new LineEditor()
      editor.line = "hello"
      editor.cursor = 0
      expect(() => editor.render("> ")).not.toThrow()
    })
  })
})
