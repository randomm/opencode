import { formatTokens, formatDuration } from "../metrics"
import { fg, style } from "./terminal"

export interface StatusLineState {
  activity: string
  duration: number
  tokens: number
  tasksVisible: boolean
}

const sanitize = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x1f\x7f]/g, "")

const safeNum = (n: number): number => (Number.isFinite(n) ? Math.max(0, n) : 0)

const truncate = (s: string, max: number): string => (s.length > max ? s.slice(0, max) + "…" : s)

export function renderStatusLine(state: StatusLineState): string {
  const symbol = `${fg.brightCyan}◆${style.reset}`

  const safeDuration = safeNum(state.duration)
  const safeTokens = safeNum(state.tokens)
  const durationText = formatDuration(safeDuration)
  const tokensText = formatTokens(safeTokens)

  const sanitizedActivity = sanitize(state.activity || "")
  const activity = sanitizedActivity.trim() || "Idle"
  const truncatedActivity = truncate(activity, 30)

  const taskHint = state.tasksVisible ? "hide" : "show"

  const hints = ["Esc to interrupt", `ctrl+t to ${taskHint} tasks`, durationText, `↓ ${tokensText}`]

  return `${symbol} ${truncatedActivity} (${hints.join(" · ")})`
}
