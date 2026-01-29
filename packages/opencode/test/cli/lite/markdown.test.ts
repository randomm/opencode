import { describe, test, expect } from "bun:test"
import { createMarkdownRenderer } from "../../../src/cli/lite/markdown"

describe("Markdown Renderer", () => {
  test("renders plain text unchanged", () => {
    const md = createMarkdownRenderer()
    const output = md.render("Hello, world")
    expect(output).toBe("Hello, world")
  })

  test("renders bold text with ANSI codes", () => {
    const md = createMarkdownRenderer()
    const output = md.render("**bold**")
    expect(output).toContain("\x1b[1m") // bold
    expect(output).toContain("bold")
    expect(output).toContain("\x1b[0m") // reset
  })

  test("renders inline code with cyan color", () => {
    const md = createMarkdownRenderer()
    const output = md.render("`code`")
    expect(output).toContain("\x1b[36m") // cyan
    expect(output).toContain("code")
    expect(output).toContain("\x1b[0m") // reset
  })

  test("renders H1 header with bold and cyan - requires newline", () => {
    const md = createMarkdownRenderer()
    const output = md.render("# Header One\n")
    expect(output).toContain("\x1b[1m") // bold
    expect(output).toContain("\x1b[36m") // cyan
    expect(output).toContain("Header One")
    expect(output).toContain("\x1b[0m") // reset
  })

  test("renders H2 header - requires newline", () => {
    const md = createMarkdownRenderer()
    const output = md.render("## Header Two\n")
    expect(output).toContain("\x1b[1m")
    expect(output).toContain("\x1b[36m")
    expect(output).toContain("Header Two")
    expect(output).toContain("\x1b[0m")
  })

  test("renders H6 header - requires newline", () => {
    const md = createMarkdownRenderer()
    const output = md.render("###### Header Six\n")
    expect(output).toContain("\x1b[1m")
    expect(output).toContain("\x1b[36m")
    expect(output).toContain("Header Six")
  })

  test("renders mixed content with bold within sentence", () => {
    const md = createMarkdownRenderer()
    const output = md.render("This is **bold** text")
    expect(output).toContain("This is ")
    expect(output).toContain("\x1b[1m")
    expect(output).toContain("bold")
    expect(output).toContain("\x1b[0m")
    expect(output).toContain(" text")
  })

  test("handles unclosed bold marker - starts bold but buffers content", () => {
    const md = createMarkdownRenderer()
    const output = md.render("**incomplete")
    // Unclosed bold opens bold but buffers text waiting for closing **
    expect(output).toContain("\x1b[1m")
    expect(output).toContain("incomplete")
    expect(output).not.toContain("\x1b[0m")
  })

  test("handles unclosed code span - buffers incomplete input", () => {
    const md = createMarkdownRenderer()
    const output = md.render("`incomplete")
    // Unclosed code should buffer, not output
    expect(output).toBe("")
  })

  test("flush closes bold state and adds reset", () => {
    const md = createMarkdownRenderer()
    md.render("**incomplete")
    const flushed = md.flush()
    // Should add reset to close the open bold state
    expect(flushed).toContain("\x1b[0m")
  })

  test("flush outputs buffered incomplete code text", () => {
    const md = createMarkdownRenderer()
    md.render("`incomplete")
    const flushed = md.flush()
    expect(flushed).toContain("`incomplete")
  })

  test("supports streaming with multiple render calls", () => {
    const md = createMarkdownRenderer()
    const out1 = md.render("**bo")
    const out2 = md.render("ld**")
    const out3 = md.render(" text")

    expect(out1).toContain("\x1b[1mbo") // bold opened
    expect(out2).toContain("ld\x1b[0m") // closed
    expect(out3).toBe(" text")
  })

  test("handles multiple bold spans in one render", () => {
    const md = createMarkdownRenderer()
    const output = md.render("**first** and **second**")
    expect(output).toContain("\x1b[1mfirst\x1b[0m")
    expect(output).toContain("\x1b[1msecond\x1b[0m")
    expect(output).toContain(" and ")
  })

  test("renders code block with language", () => {
    const md = createMarkdownRenderer()
    const output = md.render("```ts\nconst x = 1\n```\n")
    expect(output).toContain("```ts") // fence in gray
    expect(output).toContain("const x = 1") // content in cyan
    expect(output).toContain("```") // closing fence in gray
  })

  test("renders code block without language", () => {
    const md = createMarkdownRenderer()
    const output = md.render("```\ncode content\n```\n")
    expect(output).toContain("```")
    expect(output).toContain("code content")
  })

  test("renders horizontal rule", () => {
    const md = createMarkdownRenderer()
    const output = md.render("---\n")
    expect(output).toContain("---")
    expect(output).toContain("\x1b[90m") // gray color
    expect(output).toContain("\x1b[0m") // reset
  })

  test("handles text that looks like markdown but is not at line start", () => {
    const md = createMarkdownRenderer()
    const output = md.render("not # at start\nmiddle --- text\nnot ~ inline")
    expect(output).toContain("not # at start")
    expect(output).toContain("middle --- text")
    expect(output).toContain("not ~ inline")
    expect(output).not.toContain("\x1b[1m") // no bold codes
  })

  test("renders header followed by regular text", () => {
    const md = createMarkdownRenderer()
    const output = md.render("# Title\nSome text")
    expect(output).toContain("\x1b[1m\x1b[36mTitle\x1b[0m\n")
    expect(output).toContain("Some text")
  })

  test("backtick within bold is treated as literal text within bold", () => {
    const md = createMarkdownRenderer()
    const output = md.render("**bold `code` inside**")
    // Inline code is not processed when inside bold
    expect(output).toContain("\x1b[1mbold `code` inside\x1b[0m")
  })

  test("handles empty input", () => {
    const md = createMarkdownRenderer()
    const output = md.render("")
    expect(output).toBe("")
  })

  test("handles flush on empty buffer", () => {
    const md = createMarkdownRenderer()
    const output = md.flush()
    expect(output).toBe("")
  })

  test("code block content gets cyan color", () => {
    const md = createMarkdownRenderer()
    const output = md.render("```\nline1\nline2\n```\n")
    expect(output).toContain("\x1b[36mline1")
    expect(output).toContain("\x1b[36mline2")
  })

  test("horizontal rule must have at least 3 dashes", () => {
    const md = createMarkdownRenderer()
    const output = md.render("--\n") // only 2 dashes
    expect(output).toStrictEqual("--\n")
    expect(output).not.toContain("\x1b[90m") // no gray color
  })

  test("handles inline code with content containing special characters", () => {
    const md = createMarkdownRenderer()
    const output = md.render("`**not**bold**`")
    expect(output).toContain("\x1b[36m")
    expect(output).toContain("**not**bold**")
    expect(output).toContain("\x1b[0m")
    expect(output).not.toContain("\x1b[1m") // no bold applied
  })

  test("handles multiple inline code spans", () => {
    const md = createMarkdownRenderer()
    const output = md.render("`first` and `second`")
    expect(output).toContain("\x1b[36mfirst\x1b[0m")
    expect(output).toContain("\x1b[36msecond\x1b[0m")
  })

  test("preserves newlines in plain text", () => {
    const md = createMarkdownRenderer()
    const output = md.render("line1\nline2\nline3")
    expect(output).toBe("line1\nline2\nline3")
  })

  test("handles bold with adjacent markers", () => {
    const md = createMarkdownRenderer()
    const output = md.render("a**b**c**d**e")
    expect(output).toContain("a\x1b[1mb\x1b[0mc\x1b[1md\x1b[0me")
  })

  test("flush closes bold state and adds reset", () => {
    const md = createMarkdownRenderer()
    md.render("**open bold")
    const flushed = md.flush()
    // Should add reset to open bold state
    expect(flushed).toContain("\x1b[0m")
  })
})
