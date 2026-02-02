import { cursor, clear, fg, style, write } from "./terminal"

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const PAD = "  "

export class Spinner {
  private frame = 0
  private interval: ReturnType<typeof setInterval> | null = null
  private text: string
  private startTime: number = 0

  constructor(text = "Processing") {
    this.text = text
  }

  start() {
    write(cursor.hide)
    this.frame = 0
    this.startTime = Date.now()
    write(`\r${clear.line}${PAD}${fg.cyan}${frames[0]}${style.reset} ${fg.gray}${this.text}${style.reset}`)
    this.interval = setInterval(() => {
      this.frame = (this.frame + 1) % frames.length
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
      const time = elapsed > 0 ? ` · ${elapsed}s` : ""
      write(
        `\r${clear.line}${PAD}${fg.cyan}${frames[this.frame]}${style.reset} ${fg.gray}${this.text}${time}${style.reset}`,
      )
    }, 50)
  }

  update(text: string) {
    this.text = text
  }

  stop(success = true) {
    if (this.interval) clearInterval(this.interval)
    const icon = success ? `${fg.green}✓${style.reset}` : `${fg.red}✗${style.reset}`
    write(`\r${clear.line}${PAD}${icon} ${this.text}\n`)
    write(cursor.show)
  }
}
