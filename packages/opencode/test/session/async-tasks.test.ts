import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import {
  getAndClearCompletedTasks,
  hasUndeliveredCompletedTasks,
  trackBackgroundTask,
} from "../../src/session"
import type { TaskMetadata } from "../../src/session"

function metadata(child: string, parent: string): TaskMetadata {
  return {
    agent_type: "test-agent",
    description: "test task",
    session_id: child,
    parent_session_id: parent,
    start_time: Date.now(),
  }
}

describe("async-tasks: parent_session_id routing", () => {
  test("getAndClearCompletedTasks finds results by parent_session_id", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const id = "routing-test-1-" + Date.now()
        const parent = "parent-1-" + Date.now()
        const child = "child-1-" + Date.now()

        await trackBackgroundTask(id, Promise.resolve("test result"), parent, metadata(child, parent))
        await new Promise((r) => setTimeout(r, 50))

        const found = getAndClearCompletedTasks(parent)
        expect(found.length).toBe(1)
        expect(found[0]!.result).toBe("test result")

        const notFound = getAndClearCompletedTasks(child)
        expect(notFound.length).toBe(0)
      },
    })
  })

  test("hasUndeliveredCompletedTasks checks parent_session_id", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const id = "routing-test-2-" + Date.now()
        const parent = "parent-2-" + Date.now()
        const child = "child-2-" + Date.now()

        await trackBackgroundTask(id, Promise.resolve("test result"), parent, metadata(child, parent))
        await new Promise((r) => setTimeout(r, 50))

        expect(hasUndeliveredCompletedTasks(parent)).toBe(true)
        expect(hasUndeliveredCompletedTasks(child)).toBe(false)

        getAndClearCompletedTasks(parent)
      },
    })
  })

  test("results not found with wrong parent_session_id", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const id = "routing-test-3-" + Date.now()
        const parent = "session-A-" + Date.now()
        const child = "child-3-" + Date.now()

        await trackBackgroundTask(id, Promise.resolve("test result"), parent, metadata(child, parent))
        await new Promise((r) => setTimeout(r, 50))

        const wrong = getAndClearCompletedTasks("session-B-wrong")
        expect(wrong.length).toBe(0)

        const right = getAndClearCompletedTasks(parent)
        expect(right.length).toBe(1)
      },
    })
  })

  test("delivered results not re-delivered", async () => {
    await Instance.provide({
      directory: "/tmp/test",
      fn: async () => {
        const id = "routing-test-4-" + Date.now()
        const parent = "parent-4-" + Date.now()
        const child = "child-4-" + Date.now()

        await trackBackgroundTask(id, Promise.resolve("test result"), parent, metadata(child, parent))
        await new Promise((r) => setTimeout(r, 50))

        const first = getAndClearCompletedTasks(parent)
        expect(first.length).toBe(1)

        const second = getAndClearCompletedTasks(parent)
        expect(second.length).toBe(0)
      },
    })
  })
})