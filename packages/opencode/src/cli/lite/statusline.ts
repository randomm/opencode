import { formatTokens, formatDuration } from "../metrics"
import { fg, style } from "./terminal"

export interface StatusLineState {
  activity: string
  duration: number
  tokens: number
  tasksVisible: boolean
}

const sanitize = (s: string): string =>
  s
    .replace(/\x1b[\[\]()#;?]*[0-9;]*[A-Za-z]/g, "") // All CSI sequences
    .replace(/\x1b\][^\x07]*\x07/g, "") // OSC sequences (hyperlinks, title)
    .replace(/[\x00-\x1f\x7f]/g, "") // Control characters

const safeNum = (n: number): number => (Number.isFinite(n) ? Math.max(0, n) : 0)

const truncate = (s: string, max: number): string => {
  const arr = Array.from(s)
  return arr.length > max ? arr.slice(0, max - 1).join("") + "…" : s
}

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
