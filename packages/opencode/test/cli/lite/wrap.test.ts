import { describe, test, expect } from "bun:test"
import { wrap } from "../../../src/cli/lite/wrap"

describe("wrap", () => {
  describe("basic text wrapping", () => {
    test("returns text unchanged when within width", () => {
      const text = "Hello world"
      const result = wrap(text, 20)
      expect(result).toBe("Hello world")
    })

    test("returns text unchanged when exactly at width", () => {
      const text = "Hello"
      const result = wrap(text, 5)
      expect(result).toBe("Hello")
    })

    test("wraps text that exceeds width", () => {
      const text = "Hello world this is long"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThan(1)
      expect(lines[0]).toBe("Hello")
      expect(lines[1]).toBe("world this")
    })

    test("wraps multiple words on same line when they fit", () => {
      const text = "a b c d e"
      const result = wrap(text, 10)
      expect(result).toBe("a b c d e")
    })

    test("wraps at word boundaries", () => {
      const text = "one two three four"
      const result = wrap(text, 8)
      const lines = result.split("\n")
      expect(lines[0]).toBe("one two")
      expect(lines[1]).toBe("three")
      expect(lines[2]).toBe("four")
    })

    test("handles single word longer than width", () => {
      const text = "verylongword"
      const result = wrap(text, 5)
      expect(result).toBe("verylongword")
    })

    test("handles single word exactly at width", () => {
      const text = "word"
      const result = wrap(text, 4)
      expect(result).toBe("word")
    })

    test("handles multiple long words", () => {
      const text = "superlongword anotherlongword"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines[0]).toBe("superlongword")
      expect(lines[1]).toBe("anotherlongword")
    })
  })

  describe("empty and edge cases", () => {
    test("handles empty string", () => {
      const result = wrap("", 10)
      expect(result).toBe("")
    })

    test("handles single character", () => {
      const result = wrap("a", 10)
      expect(result).toBe("a")
    })

    test("handles only whitespace", () => {
      const text = "   "
      const result = wrap(text, 10)
      expect(result).toBe("   ")
    })

    test("handles width of 1", () => {
      const text = "ab"
      const result = wrap(text, 1)
      expect(result).toBe("ab")
    })

    test("handles width of 0", () => {
      const text = "hello"
      const result = wrap(text, 0)
      expect(result).toBe("hello")
    })

    test("handles negative width", () => {
      const text = "hello world"
      const result = wrap(text, -1)
      const lines = result.split("\n")
      expect(lines[0]).toBe("hello")
      expect(lines[1]).toBe("world")
    })

    test("handles consecutive spaces", () => {
      const text = "word1    word2"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines[0]).toBe("word1")
      expect(lines[1]).toBe("word2")
    })
  })

  describe("ANSI escape sequences", () => {
    test("preserves ANSI codes without counting them in width", () => {
      const text = "\x1b[1mBold\x1b[0m text"
      const result = wrap(text, 9)
      expect(result).toBe("\x1b[1mBold\x1b[0m text")
      expect(result).toContain("\x1b[1m")
      expect(result).toContain("\x1b[0m")
    })

    test("wraps text with ANSI codes correctly", () => {
      const text = "\x1b[1mBold\x1b[0m text that is long"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines[0]).toContain("\x1b[1m")
      expect(lines[0]).toContain("\x1b[0m")
    })

    test("handles multiple ANSI codes", () => {
      const text = "\x1b[1m\x1b[36mBold cyan\x1b[0m normal"
      const result = wrap(text, 20)
      expect(result).toBe("\x1b[1m\x1b[36mBold cyan\x1b[0m normal")
    })

    test("wraps colored text at correct visual width", () => {
      const text = "\x1b[36mShort\x1b[0m verylongcoloredword"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines[0]).toContain("\x1b[36mShort\x1b[0m")
      expect(lines[1]).toBe("verylongcoloredword")
    })

    test("handles ANSI codes spanning multiple words", () => {
      const text = "\x1b[1mWord1 Word2 Word3\x1b[0m"
      const result = wrap(text, 12)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThan(1)
      expect(result).toContain("\x1b[1m")
      expect(result).toContain("\x1b[0m")
    })

    test("handles complex ANSI sequences", () => {
      const text = "\x1b[1;36mComplex\x1b[0m text"
      const result = wrap(text, 12)
      expect(result).toBe("\x1b[1;36mComplex\x1b[0m text")
    })

    test("handles text that appears longer due to ANSI codes", () => {
      const text = "\x1b[1m\x1b[36m\x1b[0m\x1b[1m\x1b[0mHi"
      const result = wrap(text, 5)
      expect(result).toBe("\x1b[1m\x1b[36m\x1b[0m\x1b[1m\x1b[0mHi")
    })

    test("handles cursor hide/show sequences", () => {
      const text = "\x1b[?25lHidden\x1b[?25h cursor"
      const result = wrap(text, 20)
      expect(result).toBe("\x1b[?25lHidden\x1b[?25h cursor")
    })

    test("handles clear line sequences", () => {
      const text = "\x1b[2KCleared line text"
      const result = wrap(text, 20)
      expect(result).toBe("\x1b[2KCleared line text")
    })

    test("handles cursor movement sequences", () => {
      const text = "\x1b[HHome\x1b[5AUp text"
      const result = wrap(text, 15)
      expect(result).toBe("\x1b[HHome\x1b[5AUp text")
    })

    test("handles OSC sequences (hyperlinks)", () => {
      const text = "\x1b]8;;http://example.com\x07Link\x1b]8;;\x07 text"
      const result = wrap(text, 10)
      expect(result).toBe("\x1b]8;;http://example.com\x07Link\x1b]8;;\x07 text")
    })

    test("wraps correctly with mixed control sequences", () => {
      const text = "\x1b[?25l\x1b[2K\x1b[1mBold\x1b[0m normal text that wraps"
      const result = wrap(text, 15)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThan(1)
      expect(result).toContain("\x1b[?25l")
      expect(result).toContain("\x1b[2K")
      expect(result).toContain("\x1b[1m")
    })
  })

  describe("newlines in input", () => {
    test("preserves single newline", () => {
      const text = "Line1\nLine2"
      const result = wrap(text, 10)
      expect(result).toBe("Line1\nLine2")
    })

    test("preserves multiple newlines", () => {
      const text = "Line1\nLine2\nLine3"
      const result = wrap(text, 10)
      expect(result).toBe("Line1\nLine2\nLine3")
    })

    test("wraps each paragraph independently", () => {
      const text = "Short line\nThis is a very long line that needs wrapping"
      const result = wrap(text, 15)
      const lines = result.split("\n")
      expect(lines[0]).toBe("Short line")
      expect(lines.length).toBeGreaterThan(2)
    })

    test("handles empty lines", () => {
      const text = "Line1\n\nLine3"
      const result = wrap(text, 10)
      expect(result).toBe("Line1\n\nLine3")
    })

    test("handles newline at start", () => {
      const text = "\nLine2"
      const result = wrap(text, 10)
      expect(result).toBe("\nLine2")
    })

    test("handles newline at end", () => {
      const text = "Line1\n"
      const result = wrap(text, 10)
      expect(result).toBe("Line1\n")
    })

    test("handles multiple consecutive newlines", () => {
      const text = "Line1\n\n\nLine4"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines.length).toBe(4)
      expect(lines[0]).toBe("Line1")
      expect(lines[1]).toBe("")
      expect(lines[2]).toBe("")
      expect(lines[3]).toBe("Line4")
    })

    test("wraps long paragraph after newline", () => {
      const text = "Short\nThis is a very long paragraph that needs to wrap"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines[0]).toBe("Short")
      expect(lines.length).toBeGreaterThan(2)
    })
  })

  describe("unicode characters", () => {
    test("handles basic emoji", () => {
      const text = "Hello 🌍"
      const result = wrap(text, 10)
      expect(result).toBe("Hello 🌍")
    })

    test("handles multiple emoji", () => {
      const text = "🎉 🎊 🎈"
      const result = wrap(text, 10)
      expect(result).toBe("🎉 🎊 🎈")
    })

    test("handles unicode text", () => {
      const text = "Héllo wörld"
      const result = wrap(text, 11)
      expect(result).toBe("Héllo wörld")
    })

    test("wraps unicode text", () => {
      const text = "Héllo wörld this is long"
      const result = wrap(text, 12)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThan(1)
    })

    test("handles mixed ASCII and unicode", () => {
      const text = "Hello 世界"
      const result = wrap(text, 10)
      expect(result).toBe("Hello 世界")
    })

    test("handles emoji in wrapped text", () => {
      const text = "Text with 🎉 emoji that needs wrapping"
      const result = wrap(text, 15)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThan(1)
      expect(result).toContain("🎉")
    })
  })

  describe("mixed scenarios", () => {
    test("handles ANSI codes with newlines", () => {
      const text = "\x1b[1mBold line\x1b[0m\nNormal line"
      const result = wrap(text, 15)
      expect(result).toBe("\x1b[1mBold line\x1b[0m\nNormal line")
    })

    test("wraps ANSI colored text across paragraphs", () => {
      const text = "\x1b[36mLong colored text\x1b[0m\nAnother paragraph"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThan(2)
    })

    test("handles unicode with ANSI codes", () => {
      const text = "\x1b[1mHéllo\x1b[0m wörld"
      const result = wrap(text, 12)
      expect(result).toBe("\x1b[1mHéllo\x1b[0m wörld")
    })

    test("handles emoji with ANSI codes", () => {
      const text = "\x1b[36m🎉 Party\x1b[0m time"
      const result = wrap(text, 15)
      expect(result).toBe("\x1b[36m🎉 Party\x1b[0m time")
    })

    test("complex real-world example", () => {
      const text =
        "\x1b[1m\x1b[36mHeader\x1b[0m\nThis is a long paragraph with \x1b[36mcolored\x1b[0m words that needs wrapping"
      const result = wrap(text, 20)
      const lines = result.split("\n")
      expect(lines[0]).toContain("\x1b[1m\x1b[36mHeader\x1b[0m")
      expect(lines.length).toBeGreaterThan(2)
    })

    test("handles tabs as whitespace", () => {
      const text = "word1\tword2\tword3"
      const result = wrap(text, 15)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThanOrEqual(1)
    })

    test("preserves word spacing after wrap", () => {
      const text = "one two three four five"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines[0]).toBe("one two")
      expect(lines[1]).toBe("three four")
      expect(lines[2]).toBe("five")
    })

    test("handles very wide width", () => {
      const text = "Short text"
      const result = wrap(text, 1000)
      expect(result).toBe("Short text")
    })

    test("handles multiple spaces between words", () => {
      const text = "word1  word2   word3"
      const result = wrap(text, 20)
      expect(result).toBe("word1  word2   word3")
    })
  })

  describe("stress tests", () => {
    test("handles many short words", () => {
      const text = "a b c d e f g h i j k l m n o p q r s t u v w x y z"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThan(1)
      expect(lines.every((line) => line.length <= 10)).toBe(true)
    })

    test("handles alternating short and long words", () => {
      const text = "short verylongword x anotherlongword y"
      const result = wrap(text, 10)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThan(1)
    })

    test("handles text with many newlines", () => {
      const text = "a\nb\nc\nd\ne\nf\ng\nh"
      const result = wrap(text, 5)
      expect(result).toBe(text)
    })

    test("handles long text with ANSI codes throughout", () => {
      const text = "\x1b[1mWord1\x1b[0m \x1b[36mWord2\x1b[0m \x1b[1mWord3\x1b[0m \x1b[36mWord4\x1b[0m"
      const result = wrap(text, 12)
      const lines = result.split("\n")
      expect(lines.length).toBeGreaterThan(1)
      expect(result).toContain("\x1b[1m")
      expect(result).toContain("\x1b[36m")
    })

    test("handles text with only ANSI codes", () => {
      const text = "\x1b[1m\x1b[36m\x1b[0m"
      const result = wrap(text, 10)
      expect(result).toBe("\x1b[1m\x1b[36m\x1b[0m")
    })
  })
})
