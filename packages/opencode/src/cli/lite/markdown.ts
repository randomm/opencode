import { createMarkdownStreamer, render } from "markdansi"

export function createMarkdownRenderer() {
  const width = Math.max(60, (process.stdout.columns || 80) - 6)

  const streamer = createMarkdownStreamer({
    render: (chunk: string) =>
      render(chunk, {
        width,
        theme: "default",
        hyperlinks: true,
        codeBox: true,
      }),
    mode: "hybrid",
    spacing: "single",
  })

  return {
    render(chunk: string): string {
      try {
        return streamer.push(chunk) || ""
      } catch {
        return chunk
      }
    },
    flush(): string {
      try {
        return streamer.finish() || ""
      } catch {
        return ""
      }
    },
  }
}
