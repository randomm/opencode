import { Store } from "./store"
import type { Task } from "./types"

export const Scheduler = {
  async getNextTasks(projectId: string, count: number = 1): Promise<Task[]> {
    const tasks = await Store.listTasks(projectId)
    const openTasks = tasks.filter((task) => task.status === "open" || task.status === "blocked_on_conflict")

    const readyTasks = openTasks.filter((task) => {
      const dependencies = task.depends_on
      const allDepsClosed = dependencies.every((depId) => {
        const depTask = tasks.find((t) => t.id === depId)
        return depTask && depTask.status === "closed"
      })

      return allDepsClosed
    })

    const sortedTasks = readyTasks.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.id.localeCompare(b.id)
    })

    return sortedTasks.slice(0, count)
  },
}