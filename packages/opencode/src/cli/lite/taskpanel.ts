import { formatTokens } from "../metrics"
import { Icons } from "../cmd/tui/util/icons"
import { fg, style } from "./terminal"

export interface Task {
  id: string
  description: string
  status: "pending" | "running" | "completed"
  blockedBy?: string
}

export interface AgentStatus {
  name: string
  activity: string
  toolUses: number
  tokens: number
}

const sanitize = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x1f\x7f]/g, "")

const safeNum = (n: number): number => (Number.isFinite(n) ? Math.max(0, n) : 0)

const truncate = (s: string, max: number): string => (s.length > max ? s.slice(0, max - 1) + "…" : s)

export function renderTaskList(tasks: Task[]): string {
  if (!tasks || tasks.length === 0) return ""

  const completed = tasks.filter((t) => t.status === "completed").length
  const pending = tasks.filter((t) => t.status === "pending" || t.status === "running").length

  const header = `${fg.brightCyan}${style.bold}Tasks${style.reset} ${fg.gray}(${completed} done, ${pending} open)${style.reset}`

  const lines = [header]

  for (const task of tasks) {
    const icon = getTaskIcon(task.status)
    const description = truncate(sanitize(task.description), 60)

    if (task.blockedBy) {
      const blockedBy = sanitize(task.blockedBy)
      lines.push(`  ${icon} ${description} ${fg.yellow}△ blocked by #${blockedBy}${style.reset}`)
    } else {
      lines.push(`  ${icon} ${description}`)
    }
  }

  return lines.join("\n")
}

export function renderAgentTree(agents: AgentStatus[]): string {
  if (!agents || agents.length === 0) return ""

  const header = `${fg.brightCyan}${style.bold}Agents${style.reset}`
  const lines = [header]

  for (let i = 0; i < agents.length; i++) {
    const agent = agents[i]
    const isLast = i === agents.length - 1
    const prefix = isLast ? "└─" : "├─"

    const name = truncate(sanitize(agent.name), 30)
    const activity = truncate(sanitize(agent.activity), 40)
    const tokens = formatTokens(safeNum(agent.tokens))
    const tools = `${safeNum(agent.toolUses)} tool uses`

    const line = `${prefix} ${name}: ${Icons.taskIcon("progress")} ${activity}… · ${tools} · ${tokens}`
    lines.push(line)
  }

  return lines.join("\n")
}

export function renderTaskPanel(tasks: Task[], agents: AgentStatus[]): string {
  const taskList = renderTaskList(tasks)
  const agentTree = renderAgentTree(agents)

  const parts = [taskList, agentTree].filter(Boolean)
  return parts.join("\n\n")
}

function getTaskIcon(status: "pending" | "running" | "completed"): string {
  const icon = status === "completed" ? "■" : "■"
  const color = status === "completed" ? fg.green : status === "running" ? fg.yellow : fg.gray

  return `${color}${icon}${style.reset}`
}
