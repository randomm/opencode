import { cursor, clear, fg, style, write } from "./terminal"

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export class Spinner {
  private frame = 0
  private interval: ReturnType<typeof setInterval> | null = null
  private text: string

  constructor(text = "Processing") {
    this.text = text
  }

  start() {
    write(cursor.hide)
    this.interval = setInterval(() => {
      this.frame = (this.frame + 1) % frames.length
      write(`\r${clear.line}${fg.cyan}${frames[this.frame]}${style.reset} ${fg.gray}${this.text}${style.reset}`)
    }, 50)
  }

  update(text: string) {
    this.text = text
  }

  stop(success = true) {
    if (this.interval) clearInterval(this.interval)
    const icon = success ? `${fg.green}✓${style.reset}` : `${fg.red}✗${style.reset}`
    write(`\r${clear.line}${icon} ${this.text}\n`)
    write(cursor.show)
  }
}
