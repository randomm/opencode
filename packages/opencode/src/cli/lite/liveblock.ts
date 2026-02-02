import { fg, style } from "./terminal"
import { theme } from "./theme"

export interface Tool {
  id: string
  name: string
  summary: string
  status: "running" | "done" | "error" | "denied"
  seq: number
}

export interface Task {
  id: string
  agent: string
  description: string
  elapsed: number
  status: "running" | "done"
  startTime: number
  seq: number
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
const PAD = "  "

type LiveBlockInstance = ReturnType<typeof createLiveBlock>

let activeLiveBlock: LiveBlockInstance | null = null

export function _clearActiveLiveBlockForTesting() {
  activeLiveBlock = null
}

export function createLiveBlock() {
  if (activeLiveBlock) {
    throw new Error("Only one liveblock instance can be active at a time")
  }

  const tools = new Map<string, Tool>()
  const tasks = new Map<string, Task>()
  const todos: Todo[] = []
  let active = false
  let frame = 0
  let interval: ReturnType<typeof setInterval> | null = null
  let tasksVisible = false
  let runningTaskCount = 0
  let frozen = false
  let sequence = 0
  let pausedForProse = false
  let linesToClear = 0
  let renderTimeout: NodeJS.Timeout | null = null
  const frozenItems = new Set<string>()
  const lastChildTool = new Map<string, { tool: string; title: string; startTime: number }>()

  function clearLines() {
    if (linesToClear <= 0) return
    process.stdout.write("\x1b[" + linesToClear + "F")
    process.stdout.write("\x1b[0J")
  }

  function scheduleRender() {
    if (renderTimeout) {
      clearTimeout(renderTimeout)
    }
    if (!active || frozen || pausedForProse) return
    renderTimeout = setTimeout(() => {
      renderTimeout = null
      if (!active || frozen || pausedForProse) return
      render()
    }, 16)
  }

  function render() {
    if (activeLiveBlock !== liveBlock) return
    if (!active || frozen || pausedForProse) return
    if (!process.stdout.isTTY) return

    clearLines()
    const cols = process.stdout.columns || 80
    const lines: string[] = []

    const items = [
      [...tools.entries()]
        .filter(([id]) => !frozenItems.has(id))
        .map(([id, tool]) => ({ id, type: "tool" as const, item: tool })),
      [...tasks.entries()]
        .filter(([id]) => !frozenItems.has(id))
        .map(([id, task]) => ({ id, type: "task" as const, item: task })),
    ]
      .flat()
      .sort((a, b) => a.item.seq - b.item.seq)

    for (const { type, item } of items) {
      if (type === "tool") {
        const tool = item as Tool
        const sep = tool.summary ? "  " : ""
        const maxLen = Math.max(0, cols - tool.name.length - 6)
        const showEllipsis = tool.summary.length > maxLen
        const summary = showEllipsis ? `${tool.summary.slice(0, maxLen)}…` : tool.summary

        if (tool.status === "done") {
          const colors = theme.tool.done
          const icon = `${colors.icon}✓${style.reset}`
          lines.push(`${PAD}${icon} ${colors.text}${tool.name}${sep}${summary}${style.reset}`)
        }
        if (tool.status === "running") {
          const colors = theme.tool.running
          const icon = `${colors.icon}◇${style.reset}`
          lines.push(`${PAD}${icon} ${colors.text}${tool.name}${sep}${summary}${style.reset}`)
        }
        if (tool.status === "error") {
          const colors = theme.tool.error
          const icon = `${colors.icon}✗${style.reset}`
          lines.push(`${PAD}${icon} ${colors.text}${tool.name}${sep}${summary}${style.reset}`)
        }
        if (tool.status === "denied") {
          const colors = theme.tool.denied
          const icon = `${colors.icon}✗${style.reset}`
          const deniedSuffix = `${summary} ${style.dim}(permission denied)${style.reset}`
          lines.push(`${PAD}${icon} ${colors.text}${tool.name}${sep}${deniedSuffix}`)
        }
      } else {
        const task = item as Task
        const colors = task.status === "running" ? theme.task.running : theme.task.done
        const spinner =
          task.status === "running" ? `${colors.icon}${frames[frame]}${style.reset}` : `${colors.icon}✓${style.reset}`
        const elapsed = task.status === "running" ? Math.floor((Date.now() - task.startTime) / 1000) : task.elapsed
        const time = elapsed > 0 ? ` ${fg.gray}(${elapsed}s)${style.reset}` : ""

        lines.push(
          `${PAD}${spinner} ${colors.text}task${style.reset} ${colors.text}@${task.agent}:${style.reset} ${task.description}${time}`,
        )

        if (task.status === "running") {
          const statusText = renderTaskChildStatus(task.id)
          const maxLen = Math.max(0, cols - 8)
          const showEllipsis = statusText.length > maxLen
          const summary = showEllipsis ? `${statusText.slice(0, maxLen)}…` : statusText
          lines.push(`${PAD}  ${style.dim}→${style.reset} ${fg.gray}${summary}${style.reset}`)
        }
      }
    }

    if (todos.length > 0 && !tasksVisible) {
      lines.push(`${PAD}${fg.gray}(${todos.length} tasks - ctrl+t to show)${style.reset}`)
    }

    if (todos.length > 0 && tasksVisible) {
      lines.push(`${PAD}${style.dim}${"─".repeat(Math.min(cols, 60))}${style.reset}`)
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
        lines.push(`${PAD}${icon} ${priorityColor}${todo.priority}${style.reset} ${content}`)
      }
    }

    if (lines.length > 0 && !frozen) {
      const content = lines.join("\n")
      process.stdout.write(content + "\n")
      linesToClear = lines.length
    }
  }

  function renderTaskChildStatus(taskId: string) {
    const info = lastChildTool.get(taskId)
    if (!info) return "---"

    const elapsed = Math.floor((Date.now() - info.startTime) / 1000)
    if (elapsed >= 2) {
      return `${info.tool}: ${info.title}... ${elapsed}s`
    }
    return `${info.tool}: ${info.title}`
  }

  function startAnimation() {
    if (interval) return
    interval = setInterval(() => {
      frame = (frame + 1) % frames.length
      scheduleRender()
    }, 80)
  }

  function stopAnimation() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
  }

  function destroy() {
    stopAnimation()
    if (renderTimeout) {
      clearTimeout(renderTimeout)
      renderTimeout = null
    }
    activeLiveBlock = null
  }

  const liveBlock = {
    toolStart(id: string, name: string, summary: string) {
      tools.set(id, { id, name, summary, status: "running", seq: sequence++ })
      if (!active) {
        active = true
        startAnimation()
      }
      render()
    },

    toolEnd(id: string, name: string, summary: string, error = false) {
      const existing = tools.get(id)
      const seq = existing ? existing.seq : sequence++
      tools.set(id, { id, name, summary, status: error ? "error" : "done", seq })
      frozenItems.add(id)
      render()
    },

    toolDenied(id: string, name: string, summary: string) {
      const existing = tools.get(id)
      const seq = existing ? existing.seq : sequence++
      tools.set(id, { id, name, summary, status: "denied", seq })
      render()
    },

    taskStart(id: string, agent: string, description: string, childSessionID?: string) {
      if (tasks.has(id)) {
        return
      }
      tasks.set(id, {
        id,
        agent,
        description,
        elapsed: 0,
        status: "running",
        startTime: Date.now(),
        seq: sequence++,
        childSessionID,
      })
      runningTaskCount++
      if (!active) {
        active = true
        startAnimation()
      }
      render()
    },

    taskEnd(id: string) {
      const task = tasks.get(id)
      if (task && task.status === "running") {
        task.elapsed = Math.floor((Date.now() - task.startTime) / 1000)
        task.status = "done"
        task.childTool = undefined
        lastChildTool.delete(id)
        frozenItems.add(id)
        runningTaskCount--
        render()
      }
    },

    setTaskChildTool(taskId: string, childName: string, childSummary: string) {
      const task = tasks.get(taskId)
      if (task && task.status === "running") {
        task.childTool = { name: childName, summary: childSummary }
        lastChildTool.set(taskId, { tool: childName, title: childSummary, startTime: Date.now() })
        if (!active) {
          active = true
          startAnimation()
        }
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
        frozen = true
        render()
        destroy()
        active = false
      }
    },

    clearForProse() {
      if (linesToClear > 0) {
        clearLines()
        linesToClear = 0
      }
    },

    pause() {
      pausedForProse = true
      if (renderTimeout) {
        clearTimeout(renderTimeout)
        renderTimeout = null
      }
      if (linesToClear > 0) {
        clearLines()
        linesToClear = 0
      }
    },

    resume() {
      pausedForProse = false
      if (active && !frozen) render()
    },

    reset() {
      stopAnimation()
      if (active) {
        render()
        destroy()
        active = false
      }
      tools.clear()
      tasks.clear()
      todos.length = 0
      runningTaskCount = 0
      frozen = false
      pausedForProse = false
      sequence = 0
      linesToClear = 0
      frozenItems.clear()
      lastChildTool.clear()
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

    hasRunningTasks() {
      return runningTaskCount > 0
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
        linesToClear = 0
        clearLines()
        activeLiveBlock = null
        active = false
      }
      frozen = false
      frozenItems.clear()
      lastChildTool.clear()
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

  activeLiveBlock = liveBlock
  return liveBlock
}
