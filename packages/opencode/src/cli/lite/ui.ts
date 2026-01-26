import { cursor, write } from "./terminal"

export interface Layout {
  render: () => void
}

export class Box implements Layout {
  constructor(
    private width: number,
    private height: number,
    private title = "",
  ) {}

  render() {
    const top = `┌${"─".repeat(this.width - 2)}┐`
    const middle = `│${" ".repeat(this.width - 2)}│`
    const bottom = `└${"─".repeat(this.width - 2)}┘`

    write(top)
    for (let i = 0; i < this.height - 2; i++) {
      write(`\n${middle}`)
    }
    write(`\n${bottom}`)
  }
}

export function text(content: string, x = 0, y = 0) {
  write(cursor.to(y + 1, x + 1))
  write(content)
}

export function border(width: number, height: number) {
  const top = `┌${"─".repeat(width - 2)}┐`
  const middle = `│${" ".repeat(width - 2)}│`
  const bottom = `└${"─".repeat(width - 2)}┘`

  return [top, ...Array(height - 2).fill(middle), bottom]
}
