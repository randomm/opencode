import { describe, test, expect } from "bun:test"
import { createMarkdownRenderer } from "../../../src/cli/lite/markdown"

describe("Markdown Renderer (markdansi)", () => {
  test("buffers partial content until newline", () => {
    const md = createMarkdownRenderer()
    // Markdansi buffers partial content without newline
    const output = md.render("Hello")
    expect(output).toBe("")
  })

  test("flush returns remaining buffered content", () => {
    const md = createMarkdownRenderer()
    md.render("Hello, world")
    const flushed = md.flush()
    expect(flushed).toContain("Hello, world")
  })

  test("renders content with newline from push", () => {
    const md = createMarkdownRenderer()
    const output = md.render("Hello world\n")
    // Output comes from render() when there's a complete line
    expect(output).toContain("Hello world")
  })

  test("renders bold text", () => {
    const md = createMarkdownRenderer()
    const output = md.render("**bold** text\n")
    const flushed = md.flush()
    const combined = output + flushed
    // Markdansi renders bold (may strip ** markers)
    expect(combined).toContain("bold")
    expect(combined).toContain("text")
  })

  test("renders inline code", () => {
    const md = createMarkdownRenderer()
    const output = md.render("`code` here\n")
    const flushed = md.flush()
    const combined = output + flushed
    expect(combined).toContain("code")
  })

  test("renders header", () => {
    const md = createMarkdownRenderer()
    const output = md.render("# Header One\n")
    const flushed = md.flush()
    const combined = output + flushed
    expect(combined).toContain("Header One")
  })

  test("renders code block", () => {
    const md = createMarkdownRenderer()
    let combined = ""
    combined += md.render("```ts\n") || ""
    combined += md.render("const x = 1\n") || ""
    combined += md.render("```\n") || ""
    combined += md.flush() || ""
    expect(combined).toContain("const x = 1")
  })

  test("renders code block without language", () => {
    const md = createMarkdownRenderer()
    let combined = ""
    combined += md.render("```\n") || ""
    combined += md.render("code content\n") || ""
    combined += md.render("```\n") || ""
    combined += md.flush() || ""
    expect(combined).toContain("code content")
  })

  test("renders horizontal rule", () => {
    const md = createMarkdownRenderer()
    const output = md.render("---\n")
    const flushed = md.flush()
    const combined = output + flushed
    // Markdansi converts --- to box drawing characters (─)
    expect(combined.length).toBeGreaterThan(0)
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

  test("preserves text content through streaming", () => {
    const md = createMarkdownRenderer()
    let combined = ""
    combined += md.render("line1\n") || ""
    combined += md.render("line2\n") || ""
    combined += md.render("line3\n") || ""
    combined += md.flush() || ""
    expect(combined).toContain("line1")
    expect(combined).toContain("line2")
    expect(combined).toContain("line3")
  })

  test("handles multiple render calls", () => {
    const md = createMarkdownRenderer()
    let combined = ""
    combined += md.render("Hello ") || ""
    combined += md.render("world\n") || ""
    combined += md.flush() || ""
    expect(combined).toContain("Hello")
    expect(combined).toContain("world")
  })

  test("handles mixed markdown content", () => {
    const md = createMarkdownRenderer()
    let combined = ""
    combined += md.render("# Title\n") || ""
    combined += md.render("\n") || ""
    combined += md.render("Some **bold** and `code`\n") || ""
    combined += md.flush() || ""
    expect(combined).toContain("Title")
    expect(combined).toContain("bold")
    expect(combined).toContain("code")
  })

  test("render returns string type", () => {
    const md = createMarkdownRenderer()
    const output = md.render("test")
    expect(typeof output).toBe("string")
  })

  test("flush returns string type", () => {
    const md = createMarkdownRenderer()
    md.render("test")
    const output = md.flush()
    expect(typeof output).toBe("string")
  })
})
