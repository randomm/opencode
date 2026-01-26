import { Log } from "./log"

/**
 * Manages fire-and-forget background promises to prevent memory leaks
 * and ensure proper cleanup on shutdown.
 *
 * Use this for non-critical background work that shouldn't block the main flow
 * but must be tracked to prevent unbounded promise accumulation.
 */
export namespace BackgroundTasks {
  const log = Log.create({ service: "background-tasks" })
  const pending = new Set<Promise<unknown>>()
  const limit = 100

  /**
   * Spawns a background task. The promise is tracked and cleaned up when complete.
   * If the task limit is exceeded, oldest completed tasks are removed.
   * Errors are logged but do not propagate.
   */
  export function spawn<T>(task: Promise<T>): void {
    const wrapped = task
      .catch((err: any) => {
        if (err?.name !== "AbortError" && !(err instanceof DOMException && err.name === "AbortError")) {
          log.error("background task failed", { error: err })
        }
      })
      .finally(() => {
        pending.delete(wrapped)
      })
    pending.add(wrapped)

    if (pending.size > limit) {
      const oldest = pending.values().next().value
      if (oldest) {
        pending.delete(oldest)
      }
    }
  }

  /**
   * Waits for all pending background tasks to complete.
   * Call this during shutdown to ensure clean termination.
   */
  export async function drain(): Promise<void> {
    if (pending.size === 0) return
    log.info("draining background tasks", { count: pending.size })
    await Promise.allSettled([...pending])
  }

  /**
   * Returns the number of pending background tasks.
   * Useful for testing and monitoring.
   */
  export function count(): number {
    return pending.size
  }

  /**
   * Clears all pending tasks without waiting for them.
   * Use only in tests or emergency shutdown.
   */
  export function clear(): void {
    pending.clear()
  }
}
