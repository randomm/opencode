export function summarizeInput(tool: string, input?: Record<string, unknown>): string {
  if (!input) return ""
  const str = (key: string) => String(input[key] || "")

  if (tool === "bash") return str("command").slice(0, 60)
  if (tool === "read") return str("filePath").split("/").slice(-2).join("/")
  if (tool === "write" || tool === "edit") return str("filePath").split("/").slice(-2).join("/")
  if (tool === "rg" || tool === "grep") {
    const pattern = str("pattern").slice(0, 30)
    const include = str("include")
    return include ? `"${pattern}" in ${include}` : `"${pattern}"`
  }
  if (tool === "glob") return str("pattern").slice(0, 60)
  if (tool === "task") {
    const agent = str("subagent_type")
    const desc = str("description").slice(0, 40)
    return agent ? `@${agent}: ${desc}` : desc
  }
  if (tool === "todowrite" || tool === "todoread") return "todo list"

  const first = Object.values(input).find((v) => typeof v === "string")
  return first ? String(first).slice(0, 60) : ""
}
