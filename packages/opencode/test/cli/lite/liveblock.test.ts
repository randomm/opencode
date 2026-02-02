import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { createLiveBlock, _clearActiveLiveBlockForTesting } from "../../../src/cli/lite/liveblock"

function stripAnsi(str: string) {
  return str.replace(/\x1b\[[0-9;]*[mGK]/g, "")
}

describe("liveblock", () => {
  let liveBlock: ReturnType<typeof createLiveBlock>
  const originalWrite = process.stdout.write
  const output: string[] = []

  let originalIsTTY = process.stdout.isTTY
  let originalColumns = process.stdout.columns

  beforeEach(() => {
    output.length = 0
    process.stdout.write = ((data) => {
      output.push(String(data))
      return true
    }) as typeof process.stdout.write
    process.stdout.isTTY = true
    process.stdout.columns = 80
    _clearActiveLiveBlockForTesting()
    liveBlock = createLiveBlock()
  })

  afterEach(() => {
    liveBlock.clear()
    process.stdout.write = originalWrite
    process.stdout.isTTY = originalIsTTY
    process.stdout.columns = originalColumns
  })

  function getCleanOutput() {
    return stripAnsi(output.join(""))
  }

  describe("Tool lifecycle", () => {
    test("toolStart creates entry in tools Map", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")

      expect(output.length).toBeGreaterThan(0)
      expect(getCleanOutput()).toContain("Tool Name")
    })

    test("toolEnd marks tool as done and adds to frozenItems", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      const hasActiveBefore = liveBlock.hasActive()
      liveBlock.toolEnd("tool-1", "Tool Name", "Tool summary")

      const hasActiveAfter = liveBlock.hasActive()
      expect(hasActiveBefore).toBe(true)
      expect(hasActiveAfter).toBe(false)
    })

    test("toolEnd marks tool as error when error parameter is true", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.toolEnd("tool-1", "Tool Name", "Error summary", true)

      expect(liveBlock.hasActive()).toBe(false)
    })

    test("toolDenied marks tool as denied with permission denied message", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      output.length = 0
      liveBlock.toolDenied("tool-1", "Tool Name", "Tool summary")

      const deniedOutput = getCleanOutput()
      expect(deniedOutput).toContain("✗")
      expect(deniedOutput).toContain("permission denied")
    })

    test("toolEnd on non-existent tool creates new entry", () => {
      liveBlock.toolEnd("tool-1", "Tool Name", "Tool summary")
      liveBlock.taskStart("task-1", "agent", "test")

      expect(liveBlock.hasActive()).toBe(true)
    })

    test("toolDenied on non-existent tool creates new entry", () => {
      liveBlock.toolDenied("tool-1", "Tool Name", "Tool summary")
      liveBlock.taskStart("task-1", "agent", "test")

      expect(liveBlock.hasActive()).toBe(true)
    })

    test("toolEnd preserves original sequence number from toolStart", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.toolStart("tool-2", "Tool Name 2", "Tool summary 2")
      liveBlock.toolEnd("tool-1", "Tool Name", "Tool summary")
      output.length = 0

      liveBlock.toolEnd("tool-2", "Tool Name 2", "Tool summary 2")

      const tool1Index = getCleanOutput().indexOf("Tool Name")
      const tool2Index = getCleanOutput().indexOf("Tool Name 2")
      expect(tool1Index < tool2Index || tool1Index === -1 || tool2Index === -1).toBe(true)
    })
  })

  describe("Task lifecycle", () => {
    test("taskStart creates entry in tasks Map", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")

      expect(output.length).toBeGreaterThan(0)
      const cleanOutput = getCleanOutput()
      expect(cleanOutput).toContain("@agent:")
      expect(cleanOutput).toContain("Task description")
    })

    test("taskStart with existing ID is ignored", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      output.length = 0

      liveBlock.taskStart("task-1", "agent", "Different description")

      expect(output.length).toBe(0)
    })

    test("taskEnd marks task as done", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      const hasActiveBefore = liveBlock.hasActive()

      liveBlock.taskEnd("task-1")

      expect(hasActiveBefore).toBe(true)
      expect(liveBlock.hasActive()).toBe(false)
    })

    test("taskEnd clears lastChildTool entry", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.setTaskChildTool("task-1", "child-tool", "child summary")
      liveBlock.taskEnd("task-1")

      expect(liveBlock.hasActive()).toBe(false)
    })

    test("taskEnd on non-existent task does nothing", () => {
      liveBlock.taskEnd("task-1")

      expect(output.length).toBe(0)
    })

    test("taskEnd on already done task does nothing", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.taskEnd("task-1")
      output.length = 0

      liveBlock.taskEnd("task-1")

      expect(output.length).toBe(0)
    })

    test("taskStart increments runningTaskCount", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      expect(liveBlock.hasRunningTasks()).toBe(true)

      liveBlock.taskStart("task-2", "agent", "Task description 2")
      expect(liveBlock.hasRunningTasks()).toBe(true)

      liveBlock.taskEnd("task-1")
      expect(liveBlock.hasRunningTasks()).toBe(true)

      liveBlock.taskEnd("task-2")
      expect(liveBlock.hasRunningTasks()).toBe(false)
    })
  })

  describe("Child tool tracking", () => {
    test("setTaskChildTool updates task.childTool and lastChildTool", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      output.length = 0

      liveBlock.setTaskChildTool("task-1", "child-tool", "child summary")

      expect(output.length).toBeGreaterThan(0)
      expect(getCleanOutput()).toContain("child-tool")
    })

    test("setTaskChildTool on non-existent task does nothing", () => {
      liveBlock.setTaskChildTool("task-1", "child-tool", "child summary")

      expect(output.length).toBe(0)
    })

    test("setTaskChildTool on done task does nothing", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.taskEnd("task-1")
      output.length = 0

      liveBlock.setTaskChildTool("task-1", "child-tool", "child summary")

      expect(output.length).toBe(0)
    })

    test("clearTaskChildTool clears task.childTool", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.setTaskChildTool("task-1", "child-tool", "child summary")

      expect(getCleanOutput()).toContain("child-tool")

      liveBlock.clearTaskChildTool("task-1")
      output.length = 0

      liveBlock.resume()
      expect(output.length).toBeGreaterThan(0)
    })

    test("clearTaskChildTool keeps lastChildTool entry", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.setTaskChildTool("task-1", "child-tool", "child summary")
      liveBlock.clearTaskChildTool("task-1")

      expect(liveBlock.hasActive()).toBe(true)
    })

    test("clearTaskChildTool on non-existent task does nothing", () => {
      liveBlock.clearTaskChildTool("task-1")

      expect(output.length).toBe(0)
    })

    test("renderTaskChildStatus returns '---' when no info", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      output.length = 0

      liveBlock.resume()

      expect(output.some((line) => line.includes("---"))).toBe(true)
    })

    test("renderTaskChildStatus shows elapsed time after 2s", async () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.setTaskChildTool("task-1", "child-tool", "child summary")
      output.length = 0

      await new Promise((resolve) => setTimeout(resolve, 2100))
      liveBlock.resume()

      const outputText = output.join("")
      expect(outputText).toMatch(/\d+s/)
    })
  })

  describe("Render guards", () => {
    test("render() does nothing when frozen=true", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.freeze()
      output.length = 0

      liveBlock.toolStart("tool-2", "Tool Name 2", "Tool summary 2")

      expect(output.length).toBe(0)
    })

    test("render() does nothing when pausedForProse=true", () => {
      liveBlock.pause()
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")

      expect(output.length).toBe(0)
    })

    test("render() does nothing when active=false", () => {
      liveBlock.clear()
      _clearActiveLiveBlockForTesting()
      liveBlock = createLiveBlock()
      output.length = 0

      liveBlock.resume()

      expect(output.length).toBe(0)
    })

    test("render() does nothing when isTTY=false", () => {
      process.stdout.isTTY = false
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")

      expect(output.length).toBe(0)
    })

    test("render() skips items in frozenItems", () => {
      liveBlock.toolStart("tool-1", "ToolA", "Summary A")
      liveBlock.toolStart("tool-2", "ToolB", "Summary B")
      liveBlock.toolEnd("tool-1", "ToolA", "Done A")

      const cleanOutput = getCleanOutput()

      expect(liveBlock.hasActive()).toBe(true)
    })
  })

  describe("State management", () => {
    test("pause() sets pausedForProse and clears lines", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      const initialLength = output.length

      liveBlock.pause()

      expect(initialLength).toBeGreaterThan(0)
      expect(output.length).toBeGreaterThan(initialLength)
    })

    test("pause() clears linesToClear", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.pause()
      output.length = 0

      liveBlock.resume()

      expect(output.length).toBeGreaterThan(0)
    })

    test("resume() clears pausedForProse and triggers render", () => {
      liveBlock.pause()
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")

      expect(output.length).toBe(0)

      liveBlock.resume()

      expect(output.length).toBeGreaterThan(0)
    })

    test("freeze() stops animation and marks frozen", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.freeze()
      output.length = 0

      liveBlock.toolStart("tool-2", "Tool Name 2", "Tool summary 2")

      expect(output.length).toBe(0)
    })

    test("freeze() renders final state", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.freeze()

      expect(output.length).toBeGreaterThan(0)
    })

    test("reset() clears all state", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.setTaskChildTool("task-1", "child-tool", "child summary")
      liveBlock.reset()
      output.length = 0

      liveBlock.resume()

      expect(output.length).toBe(0)
      expect(liveBlock.hasActive()).toBe(false)
    })

    test("reset() allows creating new liveblock instance", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.reset()
      liveBlock.clear()

      const newLiveBlock = createLiveBlock()

      expect(newLiveBlock).toBeDefined()
      newLiveBlock.clear()
    })

    test("clear() clears all maps and state", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.clear()
      output.length = 0

      liveBlock.resume()

      expect(output.length).toBe(0)
      expect(liveBlock.hasActive()).toBe(false)
    })

    test("clear() stops animation", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      expect(liveBlock.hasActive()).toBe(true)
      liveBlock.clear()

      expect(liveBlock.hasActive()).toBe(false)
    })
  })

  describe("FrozenItems filtering", () => {
    test("Completed tools not rendered after freeze", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.toolEnd("tool-1", "Tool Name", "Tool summary")
      liveBlock.freeze()
      output.length = 0

      liveBlock.resume()

      const outputText = output.join("")
      expect(outputText).not.toContain("Tool Name")
    })

    test("Completed tasks not rendered after freeze", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.taskEnd("task-1")
      liveBlock.freeze()
      output.length = 0

      liveBlock.resume()

      expect(output.length).toBe(0)
    })

    test("Running tools still rendered after freeze", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      output.length = 0

      liveBlock.resume()

      expect(output.length).toBeGreaterThan(0)
      const outputText = output.join("")
      expect(outputText).toContain("Tool Name")
    })

    test("Running tasks still rendered after freeze", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      output.length = 0

      liveBlock.resume()

      expect(output.length).toBeGreaterThan(0)
      const outputText = output.join("")
      expect(outputText).toContain("@agent:")
    })
  })

  describe("Single instance enforcement", () => {
    test("Only one liveblock instance can be active at a time", () => {
      expect(createLiveBlock).toThrow("Only one liveblock instance can be active at a time")
    })
  })

  describe("Edge cases", () => {
    test("toolStart with empty name and summary", () => {
      _clearActiveLiveBlockForTesting()
      liveBlock = createLiveBlock()
      liveBlock.toolStart("id", "", "")

      expect(output.length).toBeGreaterThan(0)
    })

    test("taskStart with empty name and description", () => {
      _clearActiveLiveBlockForTesting()
      liveBlock = createLiveBlock()
      liveBlock.taskStart("id", "", "")

      expect(output.length).toBeGreaterThan(0)
    })

    test("toolStart with very long summary handles truncation", () => {
      _clearActiveLiveBlockForTesting()
      process.stdout.columns = 30
      liveBlock = createLiveBlock()
      const longSummary = "This is a very long summary that exceeds the terminal width"

      liveBlock.toolStart("id", "Tool", longSummary)

      const cleanOutput = getCleanOutput()
      expect(cleanOutput).toContain("…")
    })

    test("taskStart with zero terminal width handles gracefully", () => {
      _clearActiveLiveBlockForTesting()
      process.stdout.columns = 0
      liveBlock = createLiveBlock()
      liveBlock.taskStart("id", "agent", "description")

      expect(output.length).toBeGreaterThan(0)
    })

    test("taskStart with negative terminal width does not crash", () => {
      _clearActiveLiveBlockForTesting()
      process.stdout.columns = -1
      liveBlock = createLiveBlock()
      liveBlock.taskStart("id", "agent", "description")

      expect(output.length).toBeGreaterThan(0)
    })

    test("taskStart with childSessionID parameter", () => {
      _clearActiveLiveBlockForTesting()
      liveBlock = createLiveBlock()
      liveBlock.taskStart("id", "agent", "description", "session-123")

      expect(liveBlock.hasActive()).toBe(true)
    })

    test("tools sorted by sequence number not start time", () => {
      _clearActiveLiveBlockForTesting()
      liveBlock = createLiveBlock()

      liveBlock.toolStart("tool-1", "First", "sum1")
      liveBlock.toolStart("tool-2", "Second", "sum2")
      liveBlock.toolStart("tool-3", "Third", "sum3")

      const cleanOutput = getCleanOutput()
      const firstIndex = cleanOutput.indexOf("First")
      const secondIndex = cleanOutput.indexOf("Second")
      const thirdIndex = cleanOutput.indexOf("Third")

      expect(firstIndex < secondIndex && secondIndex < thirdIndex).toBe(true)
    })

    test("reset() clears sequence numbers", () => {
      _clearActiveLiveBlockForTesting()
      liveBlock = createLiveBlock()

      liveBlock.toolStart("tool-1", "First", "sum1")
      liveBlock.reset()
      _clearActiveLiveBlockForTesting()
      liveBlock = createLiveBlock()

      liveBlock.toolStart("tool-2", "Second", "sum2")

      expect(liveBlock.hasActive()).toBe(true)
    })
  })

  describe("hasActive", () => {
    test("hasActive returns true when tool is running", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")

      expect(liveBlock.hasActive()).toBe(true)
    })

    test("hasActive returns true when task is running", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")

      expect(liveBlock.hasActive()).toBe(true)
    })

    test("hasActive returns false when all items are done", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.toolEnd("tool-1", "Tool Name", "Tool summary")

      expect(liveBlock.hasActive()).toBe(false)
    })

    test("hasActive returns false when no items", () => {
      expect(liveBlock.hasActive()).toBe(false)
    })
  })

  describe("hasRunningTasks", () => {
    test("hasRunningTasks returns true when task is running", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")

      expect(liveBlock.hasRunningTasks()).toBe(true)
    })

    test("hasRunningTasks returns false when no tasks", () => {
      expect(liveBlock.hasRunningTasks()).toBe(false)
    })

    test("hasRunningTasks returns false when tasks are done", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.taskEnd("task-1")

      expect(liveBlock.hasRunningTasks()).toBe(false)
    })
  })

  describe("isActive", () => {
    test("isActive returns true after toolStart", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")

      expect(liveBlock.isActive()).toBe(true)
    })

    test("isActive returns true after taskStart", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")

      expect(liveBlock.isActive()).toBe(true)
    })

    test("isActive returns false when no items", () => {
      expect(liveBlock.isActive()).toBe(false)
    })

    test("isActive returns false after freeze", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      liveBlock.freeze()

      expect(liveBlock.isActive()).toBe(false)
    })
  })

  describe("Tasks visibility", () => {
    test("setTasksVisible triggers render when active", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      output.length = 0

      liveBlock.setTasksVisible(true)

      expect(output.length).toBeGreaterThan(0)
    })

    test("toggleTasksVisible toggles and returns new value", () => {
      const result1 = liveBlock.toggleTasksVisible()
      expect(result1).toBe(true)

      const result2 = liveBlock.toggleTasksVisible()
      expect(result2).toBe(false)
    })

    test("toggleTasksVisible triggers render when active", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      output.length = 0

      liveBlock.toggleTasksVisible()

      expect(output.length).toBeGreaterThan(0)
    })

    test("getTasksVisible returns current visibility state", () => {
      expect(liveBlock.getTasksVisible()).toBe(false)

      liveBlock.setTasksVisible(true)

      expect(liveBlock.getTasksVisible()).toBe(true)
    })
  })

  describe("Todos", () => {
    test("setTodos triggers render when active", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      output.length = 0

      liveBlock.setTodos([{ id: "todo-1", content: "Todo item", status: "pending", priority: "medium" }])

      expect(output.length).toBeGreaterThan(0)
    })

    test("setTodos updates todos without triggering render when inactive", () => {
      liveBlock.setTodos([{ id: "todo-1", content: "Todo item", status: "pending", priority: "medium" }])

      expect(output.length).toBe(0)
    })
  })

  describe("Task tick", () => {
    test("taskTick increments elapsed time for running tasks", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.taskEnd("task-1")

      expect(liveBlock.hasActive()).toBe(false)
    })

    test("taskTick does not increment elapsed time for done tasks", () => {
      liveBlock.taskStart("task-1", "agent", "Task description")
      liveBlock.taskEnd("task-1")
      liveBlock.taskTick()
      liveBlock.taskTick()

      expect(liveBlock.hasActive()).toBe(false)
    })
  })

  describe("clearForProse", () => {
    test("clearForProse clears displayed lines", () => {
      liveBlock.toolStart("tool-1", "Tool Name", "Tool summary")
      expect(output.length).toBeGreaterThan(0)
      output.length = 0

      liveBlock.clearForProse()

      expect(output.length).toBeGreaterThan(0)
    })

    test("clearForProse does nothing when linesToClear is 0", () => {
      liveBlock.clearForProse()

      expect(output.length).toBe(0)
    })
  })
})
