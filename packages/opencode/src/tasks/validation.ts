import { Store } from "./store"
import type { ValidationResult } from "./types"

function detectCycle(tasks: Map<string, { depends_on: string[] }>): string[] {
  const errors: string[] = []
  const visited = new Set<string>()
  const path = new Set<string>()

  function dfs(taskId: string, dependencyChain: string[]): boolean {
    if (path.has(taskId)) {
      const cycle = [...dependencyChain, taskId].join(" -> ")
      errors.push(`Circular dependency detected: ${cycle}`)
      return true
    }

    if (visited.has(taskId)) return false

    path.add(taskId)
    visited.add(taskId)

    const task = tasks.get(taskId)
    if (task) {
      for (const depId of task.depends_on) {
        dfs(depId, [...dependencyChain, taskId])
      }
    }

    path.delete(taskId)
    return false
  }

  for (const taskId of tasks.keys()) {
    if (!visited.has(taskId)) {
      dfs(taskId, [])
    }
  }

  return errors
}

export const Validation = {
  async validateGraph(projectId: string): Promise<ValidationResult> {
    const tasks = await Store.listTasks(projectId)
    const taskMap = new Map(tasks.map((task) => [task.id, { depends_on: task.depends_on }]))
    const taskSet = new Set(tasks.map((task) => task.id))

    const errors: string[] = []
    const warnings: string[] = []

    const cycleErrors = detectCycle(taskMap)
    errors.push(...cycleErrors)

    for (const task of tasks) {
      for (const depId of task.depends_on) {
        if (!taskSet.has(depId)) {
          errors.push(`Task "${task.id}" depends on non-existent task "${depId}"`)
        }
      }

      if (!task.acceptance_criteria || task.acceptance_criteria.trim() === "") {
        warnings.push(`Task "${task.id}" is missing acceptance criteria`)
      }

      const hasModuleLabel = task.labels.some((label) => label.startsWith("module:"))
      const hasFileLabel = task.labels.some((label) => label.startsWith("file:"))
      if (!hasModuleLabel && !hasFileLabel) {
        warnings.push(`Task "${task.id}" has no conflict labels (no module: or file: prefix)`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  },

  validateGraphFromMap(taskMap: Map<string, { depends_on: string[] }>): string[] {
    const errors: string[] = []
    const cycleErrors = detectCycle(taskMap)
    errors.push(...cycleErrors)

    const taskSet = new Set(taskMap.keys())

    for (const [taskId, task] of taskMap.entries()) {
      for (const depId of task.depends_on) {
        if (!taskSet.has(depId)) {
          errors.push(`Task "${taskId}" depends on non-existent task "${depId}"`)
        }
      }
    }

    return errors
  },
}