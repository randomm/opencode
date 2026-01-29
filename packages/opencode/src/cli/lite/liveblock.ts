import logUpdate from "log-update"
import { fg, style } from "./terminal"
import { theme } from "./theme"

export interface Tool {
  id: string
  name: string
  summary: string
  status: "running" | "done" | "error" | "denied"
}

export interface Task {
  id: string
  agent: string
  description: string
  elapsed: number
  status: "running" | "done"
  startTime: number
  childTool?: { name: string; summary: string }
  childSessionID?: string
}

export interface Todo {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
  priority: "high" | "medium" | "low"
}

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function createLiveBlock() {
  const tools = new Map<string, Tool>()
  const tasks = new Map<string, Task>()
  const todos: Todo[] = []
  let active = false
  let frame = 0
  let interval: ReturnType<typeof setInterval> | null = null
  let tasksVisible = false

  function render() {
    const cols = process.stdout.columns || 80
    const lines: string[] = []

    // Render active + recently completed tools (tasks now render inline with tools)
    for (const tool of tools.values()) {
      if (tool.name === "task") {
        // Render tasks with distinctive styling
        const task = tasks.get(tool.id)
        if (!task) continue

        const colors = task.status === "running" ? theme.task.running : theme.task.done
        const spinner =
          task.status === "running" ? `${colors.icon}${frames[frame]}${style.reset}` : `${colors.icon}✓${style.reset}`
        const elapsed = task.status === "running" ? Math.floor((Date.now() - task.startTime) / 1000) : task.elapsed
        const time = elapsed > 0 ? ` ${fg.gray}(${elapsed}s)${style.reset}` : ""
        lines.push(
          `  ${spinner} ${colors.text}task${style.reset} ${colors.text}@${task.agent}:${style.reset} ${task.description}${time}`,
        )

        // Render nested child tool if present
        if (task.status === "running" && task.childTool) {
          const childColors = theme.tool.running
          const childIcon = `${childColors.icon}◇${style.reset}`
          const maxLen = Math.max(0, cols - task.childTool.name.length - 15)
          const showEllipsis = task.childTool.summary.length > maxLen
          const summary = showEllipsis ? `${task.childTool.summary.slice(0, maxLen)}…` : task.childTool.summary
          lines.push(`      └─ ${childIcon} ${childColors.text}${task.childTool.name}  ${summary}${style.reset}`)
        }
        continue
      }

      const sep = tool.summary ? "  " : ""
      const maxLen = Math.max(0, cols - tool.name.length - 6)
      const showEllipsis = tool.summary.length > maxLen
      const summary = showEllipsis ? `${tool.summary.slice(0, maxLen)}…` : tool.summary

      if (tool.status === "done") {
        const colors = theme.tool.done
        const icon = `${colors.icon}✓${style.reset}`
        lines.push(`  ${icon} ${colors.text}${tool.name}${sep}${summary}${style.reset}`)
      }

      if (tool.status === "running") {
        const colors = theme.tool.running
        const icon = `${colors.icon}◇${style.reset}`
        lines.push(`  ${icon} ${colors.text}${tool.name}${sep}${summary}${style.reset}`)
      }

      if (tool.status === "error") {
        const colors = theme.tool.error
        const icon = `${colors.icon}✗${style.reset}`
        lines.push(`  ${icon} ${colors.text}${tool.name}${sep}${summary}${style.reset}`)
      }

      if (tool.status === "denied") {
        const colors = theme.tool.denied
        const icon = `${colors.icon}✗${style.reset}`
        const deniedSuffix = `${summary} ${style.dim}(permission denied)${style.reset}`
        lines.push(`  ${icon} ${colors.text}${tool.name}${sep}${deniedSuffix}`)
      }
    }

    // Render todos if any
    if (todos.length > 0 && !tasksVisible) {
      lines.push(`  ${fg.gray}(${todos.length} tasks - ctrl+t to show)${style.reset}`)
    }

    if (todos.length > 0 && tasksVisible) {
      lines.push(`  ${style.dim}${"─".repeat(Math.min(cols, 60))}${style.reset}`)
      for (const todo of todos) {
        const icon =
          todo.status === "completed"
            ? `${fg.green}☑${style.reset}`
            : todo.status === "in_progress"
              ? `${fg.cyan}${style.bold}◆${style.reset}`
              : todo.status === "cancelled"
                ? `${style.dim}☒${style.reset}`
                : `${style.dim}☐${style.reset}`
        const priorityColor = todo.priority === "high" ? fg.red : todo.priority === "medium" ? fg.yellow : fg.gray
        const maxLen = Math.max(0, cols - 25)
        const truncated = todo.content.length > maxLen ? `${todo.content.slice(0, maxLen)}…` : todo.content
        const content = todo.status === "cancelled" ? `${style.dim}${truncated}${style.reset}` : truncated
        lines.push(`  ${icon} ${priorityColor}${todo.priority}${style.reset} ${content}`)
      }
    }

    if (lines.length === 0) return

    logUpdate(lines.join("\n"))
  }

  function startAnimation() {
    if (interval) return
    interval = setInterval(() => {
      frame = (frame + 1) % frames.length
      render()
    }, 80)
  }

  function stopAnimation() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  return {
    toolStart(id: string, name: string, summary: string) {
      tools.set(id, { id, name, summary, status: "running" })
      if (!active) {
        active = true
        startAnimation()
      }
      render()
    },

    toolEnd(id: string, name: string, summary: string, error = false) {
      tools.set(id, { id, name, summary, status: error ? "error" : "done" })
      render()
    },

    toolDenied(id: string, name: string, summary: string) {
      tools.set(id, { id, name, summary, status: "denied" })
      render()
    },

    taskStart(id: string, agent: string, description: string, childSessionID?: string) {
      tasks.set(id, { id, agent, description, elapsed: 0, status: "running", startTime: Date.now(), childSessionID })
      tools.set(id, { id, name: "task", summary: `${agent}: ${description}`, status: "running" })
      if (!active) {
        active = true
        startAnimation()
      }
      render()
    },

    taskEnd(id: string) {
      const task = tasks.get(id)
      if (task) {
        task.elapsed = Math.floor((Date.now() - task.startTime) / 1000)
        task.status = "done"
        task.childTool = undefined
        tools.set(id, { id, name: "task", summary: `${task.agent}: ${task.description}`, status: "done" })
        render()
      }
    },

    setTaskChildTool(taskId: string, childName: string, childSummary: string) {
      const task = tasks.get(taskId)
      if (task && task.status === "running") {
        task.childTool = { name: childName, summary: childSummary }
        render()
      }
    },

    clearTaskChildTool(taskId: string) {
      const task = tasks.get(taskId)
      if (task) {
        task.childTool = undefined
        render()
      }
    },

    taskTick() {
      for (const task of tasks.values()) {
        if (task.status === "running") {
          task.elapsed++
        }
      }
    },

    setTodos(items: Todo[]) {
      todos.splice(0, todos.length, ...items)
      if (active) render()
    },

    freeze() {
      stopAnimation()
      if (active) {
        render()
        logUpdate.done()
        active = false
      }
    },

    reset() {
      stopAnimation()
      if (active) {
        render()
        logUpdate.done()
        active = false
      }
      tools.clear()
      tasks.clear()
      todos.length = 0
    },

    hasActive() {
      for (const tool of tools.values()) {
        if (tool.status === "running") return true
      }
      for (const task of tasks.values()) {
        if (task.status === "running") return true
      }
      return false
    },

    isActive() {
      return active
    },

    clear() {
      tools.clear()
      tasks.clear()
      todos.length = 0
      stopAnimation()
      if (active) {
        logUpdate.clear()
        active = false
      }
    },

    setTasksVisible(visible: boolean) {
      tasksVisible = visible
      if (active) render()
    },

    toggleTasksVisible() {
      tasksVisible = !tasksVisible
      if (active) render()
      return tasksVisible
    },

    getTasksVisible() {
      return tasksVisible
    },
  }
}
