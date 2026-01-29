import { Session } from "../../session"
import { MessageV2 } from "../../session/message-v2"
import { createMarkdownRenderer } from "./markdown"
import { wrap } from "./wrap"
import { fg, style, clear, cursor, write } from "./terminal"

const PAD = "  "
const MAX_WIDTH = Math.min(100, (process.stdout.columns || 80) - 4)

interface PanelState {
  view: "parent" | "child"
  childIndex: number
  children: string[]
  parentSessionID: string | null
}

let state: PanelState = {
  view: "parent",
  childIndex: 0,
  children: [],
  parentSessionID: null,
}

let navigationMode = false

export function setParentSession(sessionID: string | null) {
  state.parentSessionID = sessionID
  state.children = []
  state.childIndex = 0
  state.view = "parent"
}

let loading = false

async function loadChildSessions() {
  if (!state.parentSessionID) return
  if (loading) return

  loading = true
  try {
    const childSessions = await Session.children(state.parentSessionID)
    const fetched = childSessions.map((s) => s.id)

    const merged = [...state.children]
    for (const id of fetched) {
      if (!merged.includes(id)) merged.push(id)
    }

    const currentChild = state.children[state.childIndex]
    state.children = merged

    if (currentChild) {
      const newIndex = merged.indexOf(currentChild)
      state.childIndex = newIndex >= 0 ? newIndex : Math.max(0, Math.min(state.childIndex, merged.length - 1))
    }

    const current = state.children[state.childIndex]
    if (state.view === "child" && !current) {
      state.view = "parent"
      state.childIndex = 0
    }
  } catch {
    state.children = []
    if (state.view === "child") {
      state.view = "parent"
      state.childIndex = 0
    }
  } finally {
    loading = false
  }
}

export function addChild(sessionID: string) {
  if (state.children.includes(sessionID)) return
  state.children.push(sessionID)
  if (state.children.length > 50) {
    state.children.shift()
  }
}

export function enterNavigationMode() {
  navigationMode = true
}

export function exitNavigationMode() {
  navigationMode = false
}

export function isInNavigationMode(): boolean {
  return navigationMode
}

export function navigate(direction: "left" | "right" | "up"): boolean {
  if (!direction) return false

  if (direction === "up") {
    state.view = "parent"
    return true
  }

  if (state.children.length === 0) {
    return false
  }

  const wasInParent = state.view === "parent"
  state.view = "child"

  if (!wasInParent) {
    if (direction === "right") {
      state.childIndex = (state.childIndex + 1) % state.children.length
      return true
    }
    if (direction === "left") {
      state.childIndex = (state.childIndex - 1 + state.children.length) % state.children.length
      return true
    }
  }

  return true
}

export function getCurrentSessionID(): string | null {
  if (state.view === "parent") return state.parentSessionID
  return state.children[state.childIndex] || null
}

function padLines(text: string): string {
  return text
    .split("\n")
    .map((line) => (line ? `${PAD}${line}` : line))
    .join("\n")
}

async function renderSessionMessages(sessionID: string): Promise<string> {
  try {
    const messages = await Session.messages({ sessionID })
    const md = createMarkdownRenderer()

    for (const msg of messages) {
      if (!msg.info) continue

      if (msg.info.role === "user") {
        const parts = msg.parts.filter((p) => p.type === "text")
        if (parts.length > 0) {
          const userText = parts.map((p) => p.text).join("\n")
          const rendered = md.render(userText)
          const wrapped = wrap(rendered, MAX_WIDTH)
          write(padLines(wrapped) + "\n")
        }
      }

      if (msg.info.role === "assistant") {
        const parts = msg.parts
        for (const part of parts) {
          if (part.type === "text" && part.text) {
            const rendered = md.render(part.text)
            const wrapped = wrap(rendered, MAX_WIDTH)
            write(padLines(wrapped) + "\n")
          }
          if (part.type === "tool" && part.tool && part.state) {
            const summary = String(part.state.input).slice(0, 50).replace(/\s+/g, " ")
            const icon =
              part.state.status === "completed"
                ? `${fg.green}✓${style.reset}`
                : part.state.status === "error"
                  ? `${fg.red}✗${style.reset}`
                  : `${fg.gray}◇${style.reset}`
            write(`${PAD}${icon} ${part.tool}${summary ? `: ${summary}` : ""}${style.reset}\n`)
          }
          if (part.type === "subtask") {
            write(`${PAD}${fg.cyan}Subtask: ${part.description}${style.reset}\n`)
          }
          if (part.type === "reasoning" && part.text) {
            const rendered = md.render(part.text)
            const wrapped = wrap(rendered, MAX_WIDTH)
            write(padLines(`${fg.gray}${wrapped}${style.reset}\n`))
          }
        }
      }
    }
    return ""
  } catch {
    return "  (failed to load session)\n"
  }
}

export async function renderPanel() {
  if (state.view === "parent") {
    return
  }

  if (state.children.length === 0) {
    write(`${fg.gray}No child sessions${style.reset}\n\n`)
    return
  }

  await loadChildSessions()

  const childID = getCurrentSessionID()
  if (!childID) {
    write(`${fg.gray}No child session selected${style.reset}\n\n`)
    return
  }

  write(clear.screen)
  write(cursor.home)

  const title =
    state.children.length > 0 ? `${fg.brightCyan}[${state.childIndex + 1}/${state.children.length}]${style.reset}` : ""

  write(`${title} ${fg.gray}Child Session: ${childID.slice(0, 8)}${style.reset}\n`)
  const rule = `${style.dim}${"─".repeat(Math.min(process.stdout.columns || 80, 80))}${style.reset}\n`
  write(rule)

  const result = await renderSessionMessages(childID)
  if (result) {
    write(`${fg.gray}${result}${style.reset}`)
  }

  write("\n")
}

export function getHint(): string {
  if (state.view === "parent") {
    return ""
  }

  const hasChildren = state.children.length > 0
  const prevNext = hasChildren ? `Ctrl+X h (prev) Ctrl+X l (next)` : ""
  const parent = "Ctrl+X k (back to parent)"

  const parts = [prevNext, parent].filter(Boolean)
  return parts.length > 0 ? `${fg.gray}${parts.join(" · ")}${style.reset}` : ""
}

export function reset() {
  state = {
    view: "parent",
    childIndex: 0,
    children: [],
    parentSessionID: null,
  }
  navigationMode = false
  loading = false
}

export function hasChildren(): boolean {
  return state.children.length > 0
}
