import { cursor, clear, fg, style, write } from "./terminal"

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export class Spinner {
  private frame = 0
  private interval: ReturnType<typeof setInterval> | null = null
  private text: string
  private startTime: number = 0
  private onUpdate?: (text: string) => void

  constructor(text = "Processing") {
    this.text = text
  }

  start(onUpdate?: (text: string) => void) {
    this.onUpdate = onUpdate
    this.startTime = Date.now()
    this.frame = 0

    if (onUpdate) {
      this.interval = setInterval(() => {
        this.frame = (this.frame + 1) % frames.length
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
        const time = elapsed > 0 ? ` · ${elapsed}s` : ""
        const icon = frames[this.frame]
        onUpdate(`${fg.cyan}${icon}${style.reset} ${fg.gray}${this.text}${time}${style.reset}`)
      }, 50)
    } else {
      write(cursor.hide)
      this.interval = setInterval(() => {
        this.frame = (this.frame + 1) % frames.length
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
        const time = elapsed > 0 ? ` · ${elapsed}s` : ""
        write(
          `\r${clear.line}${fg.cyan}${frames[this.frame]}${style.reset} ${fg.gray}${this.text}${time}${style.reset}`,
        )
      }, 50)
    }
  }

  update(text: string) {
    this.text = text
  }

  stop(success = true) {
    if (this.interval) clearInterval(this.interval)
    const icon = success ? `${fg.green}✓${style.reset}` : `${fg.red}✗${style.reset}`
    if (this.onUpdate) {
      this.onUpdate(`${icon} ${this.text}`)
    } else {
      write(`\r${clear.line}${icon} ${this.text}\n`)
      write(cursor.show)
    }
  }
}
