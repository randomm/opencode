import { createLogUpdate } from "log-update"
import { parseKey } from "./input"
import { fg, style, cursor, write } from "./terminal"

export interface SelectOption<T = string> {
  label?: string
  value?: T
  description?: string
  current?: boolean
  section?: string
  separator?: boolean
}

let active = false
let frozenBlock: (() => void) | null = null

export function setBlockFreeze(freezeFn: () => void) {
  frozenBlock = freezeFn
}

export async function select<T>(options: SelectOption<T>[], title?: string): Promise<T | null> {
  if (options.length === 0) return null
  if (active) return null

  if (frozenBlock) {
    frozenBlock()
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const update = createLogUpdate(process.stdout, { showCursor: false })
  const listeners = process.stdin.listeners("data").slice()
  process.stdin.removeAllListeners("data")

  try {
    active = true
    const selectableOptions = options.filter((opt) => !opt.separator && opt.value !== undefined)
    if (selectableOptions.length === 0) {
      return null
    }

    const found = selectableOptions.findIndex((opt) => opt.current)
    let selected = found >= 0 ? found : 0
    selected = Math.max(0, Math.min(selected, selectableOptions.length - 1))

    const render = () => {
      const lines: string[] = []

      if (title) {
        lines.push(title)
      }

      let currentSection = ""

      for (const opt of options) {
        if (opt.separator) {
          currentSection = opt.section || ""
          lines.push(`  ${style.dim}${currentSection}${style.reset}`)
          continue
        }

        const selectedIndex = selectableOptions.indexOf(opt)
        const isSelected = selectedIndex === selected
        const prefix = isSelected ? `${fg.cyan}${style.bold}›${style.reset}` : " "
        const current = opt.current ? " ●" : ""
        const description = opt.description ? ` ${fg.gray}(${opt.description})${style.reset}` : ""

        const text = opt.label || String(opt.value)
        const line = `${prefix} ${text}${current}${description}`
        lines.push(line)
      }

      update(lines.join("\n"))
    }

    const result = await new Promise<T | null>((resolve) => {
      const handler = (data: Buffer) => {
        try {
          const key = parseKey(data)
          const max = selectableOptions.length - 1

          if (key.name === "up" && selected > 0) {
            selected--
            render()
            return
          }
          if (key.name === "down" && selected < max) {
            selected++
            render()
            return
          }
          if (key.name === "return") {
            const value = selectableOptions[selected].value
            resolve(value !== undefined ? value : null)
            return
          }
          if (key.name === "escape") {
            update.clear()
            resolve(null)
            return
          }
        } catch {
          resolve(null)
        }
      }

      process.stdin.on("data", handler)
      render()
    })

    return result
  } finally {
    active = false
    write(cursor.show)
    update.done()
    process.stdin.removeAllListeners("data")
    const typed = listeners.filter((item): item is (chunk: Buffer) => void => typeof item === "function")
    for (const fn of typed) {
      process.stdin.on("data", fn)
    }
  }
}
