export interface AgentMetrics {
  name: string
  activity: string
  toolUses: number
  tokens: number
  startedAt: number
}

export function formatTokens(count: number): string {
  if (count < 0) return "0 tokens"
  if (count === 0) return "0 tokens"
  if (count === 1) return "1 token"
  if (count < 1000) return `${count} tokens`

  if (count >= 1000000) {
    const millions = Math.round(count / 100000) / 10
    return `${millions}m tokens`
  }

  const thousands = count / 1000
  const rounded = Math.round(thousands * 10) / 10

  return `${rounded}k tokens`
}

export function formatDuration(ms: number): string {
  if (ms < 0) return "just started"

  const seconds = Math.floor(ms / 1000)

  if (seconds <= 0) return "just started"
  if (seconds < 60) return `~${seconds}s`

  const minutes = Math.floor(seconds / 60)
  return `~${minutes}m`
}

export function formatAgentMetrics(agent: AgentMetrics): string {
  const now = Date.now()
  const duration = formatDuration(now - agent.startedAt)
  const tokens = formatTokens(agent.tokens)
  const safeActivity = agent.activity.replace(/\x1b\[[0-9;]*m/g, "").replace(/[\x00-\x1f\x7f]/g, "")
  const tools = `${agent.toolUses} tool uses`

  return `${agent.name}: ◇ ${safeActivity}… · ${tools} · ${tokens}`
}
