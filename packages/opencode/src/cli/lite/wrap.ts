function visible(str: string): number {
  return str.replace(/\x1b\[[0-9;]*m/g, "").length
}

export function wrap(text: string, width: number): string {
  if (visible(text) <= width) return text

  const lines: string[] = []
  const paragraphs = text.split("\n")

  for (const para of paragraphs) {
    if (visible(para) <= width) {
      lines.push(para)
      continue
    }

    const words = para.split(/\s+/)
    let line = ""

    for (const word of words) {
      const wordVisible = visible(word)
      const lineVisible = visible(line)

      if (lineVisible + wordVisible + 1 > width && lineVisible > 0) {
        lines.push(line)
        line = word
      } else {
        line = line ? `${line} ${word}` : word
      }
    }

    if (line) lines.push(line)
  }

  return lines.join("\n")
}
