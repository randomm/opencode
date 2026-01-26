import { fg, bg, style } from "./terminal"

export interface BottomBarState {
  permissionMode: "ask" | "bypass" | "deny"
  fileChanges: {
    total: number
    added: number
    removed: number
  }
  user?: string
  host?: string
}

const sanitize = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x1f\x7f]/g, "")

const safeNum = (n: number): number => (Number.isFinite(n) ? n : 0)

const formatCount = (n: number): string => (n > 9999 ? `${(n / 1000).toFixed(1)}k` : String(n))

export function renderPrompt(): string {
  return `${fg.cyan}❯${style.reset} `
}

export function renderBottomBar(state: BottomBarState): string {
  const parts: string[] = []

  const modeText = state.permissionMode === "bypass" ? "bypass permissions on" : state.permissionMode
  parts.push(`${fg.yellow}▶▶${style.reset} ${modeText}`)

  parts.push(`(shift+Tab to cycle)`)

  const addedCount = Math.max(0, safeNum(state.fileChanges.added))
  const removedCount = Math.max(0, safeNum(state.fileChanges.removed))
  const totalCount = Math.max(0, safeNum(state.fileChanges.total))

  const fileCount = `${formatCount(totalCount)} files`
  const added = `${fg.brightGreen}+${formatCount(addedCount)}${style.reset}`
  const removed = `${fg.red}-${formatCount(removedCount)}${style.reset}`
  parts.push(`${fileCount} ${added} ${removed}`)

  let userBadge = ""
  if (state.user || state.host) {
    const sanitizedUser = state.user ? sanitize(state.user) : ""
    const sanitizedHost = state.host ? sanitize(state.host) : ""
    const userHost = [sanitizedUser, sanitizedHost].filter(Boolean).join("@")
    userBadge = userHost ? `${bg.cyan}${fg.black}${userHost}${style.reset}` : ""
  }

  const line = parts.join(" · ")
  return userBadge ? `${line}    ${userBadge}` : line
}
