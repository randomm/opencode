import { write, cursor, clear, style, fg } from "./terminal"
import { parseKey } from "./input"

export interface SelectOption<T = string> {
  label: string
  value: T
  description?: string
  current?: boolean
}

let active = false

export async function select<T>(options: SelectOption<T>[], title?: string): Promise<T | null> {
  if (active) return null
  if (options.length === 0) {
    return null
  }

  active = true
  try {
    // Save the original stdin data listeners
    const originalListeners = process.stdin.listeners("data").slice()
    process.stdin.removeAllListeners("data")

    // Find initially selected index
    let selected = options.findIndex((opt) => opt.current) ?? 0
    selected = Math.max(0, Math.min(selected, options.length - 1))

    // Track the number of lines we've written for cleanup
    let totalLines = 0

    // Render initial display
    const render = () => {
      // Move to start
      write(cursor.home)

      // Print title if provided
      if (title) {
        write(title)
        write("\n")
        totalLines = 1
      } else {
        totalLines = 0
      }

      // Print all options
      for (let i = 0; i < options.length; i++) {
        const opt = options[i]
        const isSelected = i === selected
        const prefix = isSelected ? `${fg.cyan}${style.bold}>${style.reset}` : " "
        const current = opt.current ? " ●" : ""
        const description = opt.description ? ` ${fg.gray}(${opt.description})${style.reset}` : ""

        const text = opt.label || opt.value || "(unknown)"
        const line = `${prefix} ${text}${current}${description}`
        write(line)
        write("\n")
        totalLines++
      }
    }

    const clearDisplay = () => {
      // Clear the menu from terminal
      for (let i = 0; i < totalLines; i++) {
        write(cursor.up())
        write(clear.line)
      }
      write(cursor.toColumn(0))
    }

    // Promise that resolves when user selects or cancels
    const result = await new Promise<T | null>((resolve) => {
      let handler: ((data: Buffer) => void) | null = null

      const cleanup = () => {
        if (handler) {
          process.stdin.removeListener("data", handler)
        }
        clearDisplay()
        const listeners = originalListeners.filter(
          (item): item is (chunk: Buffer) => void => typeof item === "function",
        )
        for (const listener of listeners) {
          process.stdin.on("data", listener)
        }
      }

      handler = (data: Buffer) => {
        const key = parseKey(data)

        if (key.name === "up" && selected > 0) {
          selected--
          render()
        } else if (key.name === "down" && selected < options.length - 1) {
          selected++
          render()
        } else if (key.name === "return") {
          cleanup()
          resolve(options[selected].value)
        } else if (key.name === "escape") {
          cleanup()
          resolve(null)
        }
      }

      process.stdin.on("data", handler)
      render()
    })

    return result
  } finally {
    active = false
  }
}
