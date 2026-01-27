import logUpdate from "log-update"
import { fg, style } from "./terminal"

export interface Tool {
  id: string
  name: string
  summary: string
  status: "running" | "done" | "error"
}

export interface Task {
  id: string
  agent: string
  description: string
  elapsed: number
  status: "running" | "done"
}

export interface Todo {
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
}

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]

export function createLiveBlock() {
  const tools = new Map<string, Tool>()
  const tasks = new Map<string, Task>()
  const todos: Todo[] = []
  let active = false
  let frame = 0
  let interval: ReturnType<typeof setInterval> | null = null

  function render() {
    const cols = process.stdout.columns || 80
    const lines: string[] = []

    // Render active + recently completed tools
    for (const tool of tools.values()) {
      const icon =
        tool.status === "running"
          ? `${fg.gray}◇${style.reset}`
          : tool.status === "done"
            ? `${fg.green}✓${style.reset}`
            : `${fg.red}✗${style.reset}`
      const maxLen = Math.max(0, cols - tool.name.length - 6)
      const showEllipsis = tool.summary.length > maxLen
      const display = showEllipsis
        ? `${icon} ${fg.cyan}${tool.name}${style.reset}${fg.gray}  ${tool.summary.slice(0, maxLen)}…${style.reset}`
        : `${icon} ${fg.cyan}${tool.name}${style.reset}${fg.gray}  ${tool.summary}${style.reset}`
      lines.push(display)
    }

    // Render running tasks
    for (const task of tasks.values()) {
      const spinner =
        task.status === "running" ? `${fg.cyan}${frames[frame]}${style.reset}` : `${fg.green}✓${style.reset}`
      const time = task.elapsed > 0 ? ` ${fg.gray}(${task.elapsed}s)${style.reset}` : ""
      lines.push(`${spinner} ${fg.gray}@${task.agent}:${style.reset} ${task.description}${time}`)
    }

    // Render todos if any
    if (todos.length > 0) {
      lines.push(`${style.dim}${"─".repeat(Math.min(cols, 60))}${style.reset}`)
      for (const todo of todos) {
        const isCompleted = todo.status === "completed"
        const isInProgress = todo.status === "in_progress"
        const isCancelled = todo.status === "cancelled"
        const check = isCompleted
          ? `${fg.green}✓${style.reset}`
          : isInProgress
            ? `${fg.cyan}›${style.reset}`
            : isCancelled
              ? `${fg.gray}✗${style.reset}`
              : `${fg.gray}○${style.reset}`
        const dim = isCompleted || isCancelled ? style.dim : ""
        const reset = dim ? style.reset : ""
        lines.push(`${check} ${dim}${todo.content}${reset}`)
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

    taskStart(id: string, agent: string, description: string) {
      tasks.set(id, { id, agent, description, elapsed: 0, status: "running" })
      if (!active) {
        active = true
        startAnimation()
      }
      render()
    },

    taskEnd(id: string) {
      const task = tasks.get(id)
      if (task) {
        task.status = "done"
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
      todos.length = 0
      todos.push(...items)
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
  }
}
