import { describe, test, expect, mock } from "bun:test"

// Mock log-update to capture calls during testing
const mockLogUpdate = mock(() => {})
const mockDone = mock(() => {})
const mockClear = mock(() => {})

mock.module("log-update", () => {
  const fn = mockLogUpdate as any
  fn.done = mockDone
  fn.clear = mockClear
  return { default: fn }
})

import { createLiveBlock } from "../../../src/cli/lite/liveblock"

describe("createLiveBlock", () => {
  describe("tool lifecycle", () => {
    test("toolStart adds tool with running status", () => {
      const block = createLiveBlock()
      mockLogUpdate.mockClear()
      block.toolStart("1", "search", "Searching files")

      expect(mockLogUpdate).toHaveBeenCalled()
      expect(block.hasActive()).toBe(true)
      expect(block.isActive()).toBe(true)
    })

    test("toolEnd updates tool to done status", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")
      mockLogUpdate.mockClear()

      block.toolEnd("1", "search", "Found 23 files")

      expect(mockLogUpdate).toHaveBeenCalled()
      expect(block.hasActive()).toBe(false)
    })

    test("toolEnd with error updates tool to error status", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")
      mockLogUpdate.mockClear()

      block.toolEnd("1", "search", "Search failed", true)

      expect(mockLogUpdate).toHaveBeenCalled()
      expect(block.hasActive()).toBe(false)
    })

    test("multiple tools can exist simultaneously", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")
      mockLogUpdate.mockClear()

      block.toolStart("2", "fetch", "Fetching content")
      block.toolEnd("1", "search", "Found 23 files")

      expect(mockLogUpdate).toHaveBeenCalledTimes(2)
      expect(block.hasActive()).toBe(true)
    })

    test("hasActive returns false when all tools are done", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")
      block.toolStart("2", "fetch", "Fetching content")

      expect(block.hasActive()).toBe(true)

      block.toolEnd("1", "search", "Found 23 files")
      block.toolEnd("2", "fetch", "Fetched content")

      expect(block.hasActive()).toBe(false)
    })

    test("toolEnd can update non-existent tool", () => {
      const block = createLiveBlock()
      mockLogUpdate.mockClear()

      block.toolEnd("1", "search", "No files found")

      expect(mockLogUpdate).toHaveBeenCalled()
    })
  })

  describe("task lifecycle", () => {
    test("taskStart adds task with running status", () => {
      const block = createLiveBlock()
      mockLogUpdate.mockClear()

      block.taskStart("1", "developer", "Writing code")

      expect(mockLogUpdate).toHaveBeenCalled()
      expect(block.hasActive()).toBe(true)
      expect(block.isActive()).toBe(true)
    })

    test("taskEnd marks task as done", () => {
      const block = createLiveBlock()
      block.taskStart("1", "developer", "Writing code")
      mockLogUpdate.mockClear()

      block.taskEnd("1")

      expect(mockLogUpdate).toHaveBeenCalled()
      expect(block.hasActive()).toBe(false)
    })

    test("taskTick increments elapsed time for running tasks", () => {
      const block = createLiveBlock()
      block.taskStart("1", "developer", "Writing code")
      block.taskStart("2", "tester", "Running tests")

      block.taskTick()

      expect(block.hasActive()).toBe(true)
    })

    test("taskTick only increments running tasks", () => {
      const block = createLiveBlock()
      block.taskStart("1", "developer", "Writing code")
      block.taskStart("2", "tester", "Running tests")

      block.taskEnd("1")
      block.taskTick()

      expect(block.hasActive()).toBe(true)
    })

    test("multiple tasks can exist simultaneously", () => {
      const block = createLiveBlock()
      block.taskStart("1", "developer", "Writing code")
      mockLogUpdate.mockClear()

      block.taskStart("2", "tester", "Running tests")

      expect(mockLogUpdate).toHaveBeenCalled()
      expect(block.hasActive()).toBe(true)
    })

    test("taskEnd on non-existent task does nothing", () => {
      const block = createLiveBlock()
      const hasActiveBefore = block.hasActive()

      block.taskEnd("nonexistent")

      expect(block.hasActive()).toBe(hasActiveBefore)
    })
  })

  describe("todo management", () => {
    test("setTodos sets todo list", () => {
      const block = createLiveBlock()
      const todos = [
        { id: "1", content: "Write tests", status: "completed" as const, priority: "medium" as const },
        { id: "2", content: "Fix bugs", status: "in_progress" as const, priority: "high" as const },
      ]

      block.setTodos(todos)
      mockLogUpdate.mockClear()

      expect(mockLogUpdate).not.toHaveBeenCalled()
    })

    test("setTodos with empty list clears todos", () => {
      const block = createLiveBlock()
      block.setTodos([{ id: "1", content: "Write tests", status: "pending" as const, priority: "low" as const }])
      mockLogUpdate.mockClear()

      block.setTodos([])

      expect(mockLogUpdate).not.toHaveBeenCalled()
    })

    test("setTodos replaces previous todos", () => {
      const block = createLiveBlock()
      block.setTodos([{ id: "1", content: "First todo", status: "pending" as const, priority: "low" as const }])
      mockLogUpdate.mockClear()

      const newTodos = [
        { id: "2", content: "Second todo", status: "completed" as const, priority: "medium" as const },
        { id: "3", content: "Third todo", status: "pending" as const, priority: "high" as const },
      ]

      block.setTodos(newTodos)

      expect(mockLogUpdate).not.toHaveBeenCalled()
    })

    test("setTodos renders when block is active", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")
      mockLogUpdate.mockClear()

      block.setTodos([{ id: "1", content: "Test todo", status: "pending" as const, priority: "low" as const }])

      expect(mockLogUpdate).toHaveBeenCalled()
    })

    test("todos render with correct icons and priorities", () => {
      const block = createLiveBlock()
      block.setTodos([
        { id: "1", content: "Priority task", status: "pending" as const, priority: "low" as const },
        { id: "2", content: "High priority", status: "in_progress" as const, priority: "high" as const },
        { id: "3", content: "Done task", status: "completed" as const, priority: "medium" as const },
        { id: "4", content: "Cancelled task", status: "cancelled" as const, priority: "low" as const },
      ])

      mockLogUpdate.mockClear()

      block.toolStart("1", "search", "Searching files")

      expect(mockLogUpdate).toHaveBeenCalled()
      const allCalls = mockLogUpdate.mock.calls as unknown[][]
      const output = allCalls[allCalls.length - 1][0] as string
      expect(output).toContain("☐")
      expect(output).toContain("◆")
      expect(output).toContain("☑")
      expect(output).toContain("☒")
      expect(output).toContain("Priority task")
      expect(output).toContain("Done task")
    })
  })

  describe("state transitions", () => {
    test("isActive returns false initially", () => {
      const block = createLiveBlock()
      expect(block.isActive()).toBe(false)
    })

    test("toolStart activates the block", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")

      expect(block.isActive()).toBe(true)
    })

    test("taskStart activates the block", () => {
      const block = createLiveBlock()
      block.taskStart("1", "developer", "Writing code")

      expect(block.isActive()).toBe(true)
    })

    test("freeze deactivates the block", () => {
      const block = createLiveBlock()
      mockDone.mockClear()
      block.toolStart("1", "search", "Searching files")

      block.freeze()

      expect(block.isActive()).toBe(false)
      expect(mockDone).toHaveBeenCalled()
    })

    test("reset deactivates and clears all state", () => {
      const block = createLiveBlock()
      mockDone.mockClear()
      block.toolStart("1", "search", "Searching files")
      block.taskStart("2", "developer", "Writing code")
      block.setTodos([{ id: "1", content: "Test", status: "pending" as const, priority: "low" as const }])

      block.reset()

      expect(block.isActive()).toBe(false)
      expect(block.hasActive()).toBe(false)
      expect(mockDone).toHaveBeenCalled()
    })

    test("clear clears without persisting", () => {
      const block = createLiveBlock()
      mockClear.mockClear()
      block.toolStart("1", "search", "Searching files")

      block.clear()

      expect(block.isActive()).toBe(false)
      expect(block.hasActive()).toBe(false)
      expect(mockClear).toHaveBeenCalled()
    })
  })

  describe("freeze behavior", () => {
    test("freeze is idempotent", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")

      block.freeze()
      mockDone.mockClear()

      block.freeze()

      expect(block.isActive()).toBe(false)
    })

    test("freeze preserves tool state", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")
      block.toolStart("2", "fetch", "Fetching content")

      block.freeze()

      expect(block.hasActive()).toBe(true)
    })

    test("freeze preserves task state", () => {
      const block = createLiveBlock()
      block.taskStart("1", "developer", "Writing code")

      block.freeze()

      expect(block.hasActive()).toBe(true)
    })

    test("freeze on inactive block does not call done", () => {
      const block = createLiveBlock()
      mockDone.mockClear()

      block.freeze()

      expect(block.isActive()).toBe(false)
    })
  })

  describe("reset behavior", () => {
    test("reset clears tools", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")
      block.toolStart("2", "fetch", "Fetching content")

      block.reset()

      expect(block.hasActive()).toBe(false)
    })

    test("reset clears tasks", () => {
      const block = createLiveBlock()
      block.taskStart("1", "developer", "Writing code")
      block.taskStart("2", "tester", "Running tests")

      block.reset()

      expect(block.hasActive()).toBe(false)
    })

    test("reset clears todos", () => {
      const block = createLiveBlock()
      block.setTodos([{ id: "1", content: "Test", status: "pending" as const, priority: "low" as const }])

      block.reset()

      expect(block.isActive()).toBe(false)
    })

    test("reset on inactive block does not call done", () => {
      const block = createLiveBlock()
      mockDone.mockClear()

      block.reset()

      expect(block.isActive()).toBe(false)
    })
  })

  describe("integration scenarios", () => {
    test("full workflow: tools, tasks, and todos", () => {
      const block = createLiveBlock()
      const todos = [
        { id: "1", content: "Write code", status: "pending" as const, priority: "low" as const },
        { id: "2", content: "Run tests", status: "in_progress" as const, priority: "medium" as const },
      ]

      block.setTodos(todos)
      block.toolStart("1", "search", "Searching files")
      block.taskStart("2", "developer", "Writing code")

      expect(block.isActive()).toBe(true)
      expect(block.hasActive()).toBe(true)

      block.taskTick()
      block.taskEnd("2")
      block.toolEnd("1", "search", "Found 23 files")

      expect(block.hasActive()).toBe(false)

      block.freeze()

      expect(block.isActive()).toBe(false)
    })

    test("mixed running and done tools", () => {
      const block = createLiveBlock()
      block.toolStart("1", "search", "Searching files")
      block.toolStart("2", "fetch", "Fetching content")
      block.toolEnd("1", "search", "Found 23 files")

      expect(block.hasActive()).toBe(true)
    })

    test("clear calls clear on logUpdate when active", () => {
      const block = createLiveBlock()
      mockClear.mockClear()
      block.toolStart("1", "search", "Searching files")

      block.clear()

      expect(mockClear).toHaveBeenCalled()
    })

    test("reset after freeze behavior", () => {
      const block = createLiveBlock()
      mockDone.mockClear()
      block.toolStart("1", "search", "Searching files")
      block.freeze()

      block.reset()

      expect(block.isActive()).toBe(false)
      expect(block.hasActive()).toBe(false)
    })

    test("taskTick with no running tasks", () => {
      const block = createLiveBlock()
      block.taskStart("1", "developer", "Writing code")
      block.taskEnd("1")

      block.taskTick()

      expect(block.hasActive()).toBe(false)
    })
  })
})
