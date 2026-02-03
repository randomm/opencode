import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { BackgroundTasks } from "./tasks"

describe("BackgroundTasks", () => {
  beforeEach(() => {
    BackgroundTasks.clear()
  })

  afterEach(() => {
    BackgroundTasks.clear()
  })

  describe("spawn", () => {
    test("tracks pending tasks", async () => {
      const task = new Promise<void>((resolve) => setTimeout(resolve, 50))
      BackgroundTasks.spawn(task)

      expect(BackgroundTasks.count()).toBe(1)

      await BackgroundTasks.drain()
      expect(BackgroundTasks.count()).toBe(0)
    })

    test("removes task when completed", async () => {
      let resolver: () => void
      const task = new Promise<void>((resolve) => {
        resolver = resolve
      })

      BackgroundTasks.spawn(task)
      expect(BackgroundTasks.count()).toBe(1)

      resolver!()
      await BackgroundTasks.drain()
      expect(BackgroundTasks.count()).toBe(0)
    })

    test("handles task errors without throwing", async () => {
      const task = Promise.reject(new Error("test error"))
      BackgroundTasks.spawn(task)

      // Should not throw
      await BackgroundTasks.drain()
      expect(BackgroundTasks.count()).toBe(0)
    })

    test("tracks multiple tasks", async () => {
      const tasks = [
        new Promise<void>((resolve) => setTimeout(resolve, 10)),
        new Promise<void>((resolve) => setTimeout(resolve, 20)),
        new Promise<void>((resolve) => setTimeout(resolve, 30)),
      ]

      tasks.forEach((t) => BackgroundTasks.spawn(t))
      expect(BackgroundTasks.count()).toBe(3)

      await BackgroundTasks.drain()
      expect(BackgroundTasks.count()).toBe(0)
    })

    test("enforces task limit", async () => {
      // Spawn more than the limit (100)
      for (let i = 0; i < 105; i++) {
        const task = new Promise<void>((resolve) => setTimeout(resolve, 100))
        BackgroundTasks.spawn(task)
      }

      // Should be at or below the limit
      expect(BackgroundTasks.count()).toBeLessThanOrEqual(101)

      BackgroundTasks.clear()
    })
  })

  describe("drain", () => {
    test("waits for all pending tasks", async () => {
      let completed = 0
      const tasks = [1, 2, 3].map(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              completed++
              resolve()
            }, 10)
          }),
      )

      tasks.forEach((t) => BackgroundTasks.spawn(t))
      await BackgroundTasks.drain()

      expect(completed).toBe(3)
    })

    test("returns immediately when no tasks", async () => {
      const start = Date.now()
      await BackgroundTasks.drain()
      const elapsed = Date.now() - start

      expect(elapsed).toBeLessThan(10)
    })
  })

  describe("count", () => {
    test("returns correct count", () => {
      expect(BackgroundTasks.count()).toBe(0)

      BackgroundTasks.spawn(new Promise<void>((resolve) => setTimeout(resolve, 100)))
      expect(BackgroundTasks.count()).toBe(1)

      BackgroundTasks.spawn(new Promise<void>((resolve) => setTimeout(resolve, 100)))
      expect(BackgroundTasks.count()).toBe(2)

      BackgroundTasks.clear()
    })
  })

  describe("clear", () => {
    test("removes all pending tasks", () => {
      for (let i = 0; i < 5; i++) {
        BackgroundTasks.spawn(new Promise<void>((resolve) => setTimeout(resolve, 100)))
      }
      expect(BackgroundTasks.count()).toBe(5)

      BackgroundTasks.clear()
      expect(BackgroundTasks.count()).toBe(0)
    })
  })
})
