/**
 * prompt-async.ts — Fork-specific async task prompt integration
 *
 * Consolidates all async-task code that would otherwise be scattered
 * across prompt.ts, minimizing merge conflicts during upstream syncs.
 */
import { getAndClearCompletedTasks, formatCompletedTasksForInjection, isClosing as _isClosing } from "./async-tasks"
import type { BackgroundTaskResult } from "./async-tasks"
export type { BackgroundTaskResult } from "./async-tasks"
import { BackgroundTasks } from "@/util/tasks"
import { Identifier } from "../id/id"
import type { MessageV2 } from "./message-v2"

/** Collect completed background tasks for a session. Returns [] if none. */
export function collectCompletedTasks(sessionID: string): BackgroundTaskResult[] {
  return getAndClearCompletedTasks(sessionID)
}

/** Check if input is empty (no user parts AND no completed tasks to inject). */
export function isInputEmpty(parts: readonly unknown[], completedTasks: readonly BackgroundTaskResult[]): boolean {
  return parts.length === 0 && completedTasks.length === 0
}

/** Check if session is closing (async task shutdown). */
export function isClosing(sessionID: string): boolean {
  return _isClosing(sessionID)
}

/** Wrap a fire-and-forget promise in BackgroundTasks tracking. */
export function spawnBackground(p: Promise<unknown>): void {
  BackgroundTasks.spawn(p)
}

/**
 * Prepend completed-task results as a synthetic text part at the beginning
 * of the message parts array. Mutates the array in place.
 * No-op if there are no completed tasks.
 */
export function injectTaskResults(
  parts: MessageV2.Part[],
  completedTasks: BackgroundTaskResult[],
  messageID: string,
  sessionID: string,
): void {
  if (completedTasks.length === 0) return
  const injectionText = formatCompletedTasksForInjection(completedTasks)
  parts.unshift({
    id: Identifier.ascending("part"),
    messageID,
    sessionID,
    type: "text" as const,
    text: injectionText,
    synthetic: true,
  })
}
