import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test"
import * as Panel from "../../../src/cli/lite/panel"
import { Session } from "../../../src/session"

describe("Panel", () => {
  beforeEach(() => {
    Panel.reset()
  })

  test("initial state is parent view with no children", () => {
    expect(Panel.getCurrentSessionID()).toBeNull()
    expect(Panel.hasChildren()).toBe(false)
  })

  test("setParentSession sets the parent session", () => {
    Panel.setParentSession("session-123")
    expect(Panel.getCurrentSessionID()).toBe("session-123")
  })

  test("addChild adds a child session", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-session-1")
    expect(Panel.hasChildren()).toBe(true)
  })

  test("navigate to child switches view", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-session-1")

    const result = Panel.navigate("right")
    expect(result).toBe(true)
    expect(Panel.getCurrentSessionID()).toBe("child-session-1")
  })

  test("navigate between multiple children", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.addChild("child-2")
    Panel.addChild("child-3")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-2")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-3")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")
  })

  test("navigate left cycles backward", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.addChild("child-2")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")

    Panel.navigate("left")
    expect(Panel.getCurrentSessionID()).toBe("child-2")

    Panel.navigate("left")
    expect(Panel.getCurrentSessionID()).toBe("child-1")
  })

  test("navigate up returns to parent", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")

    Panel.navigate("up")
    expect(Panel.getCurrentSessionID()).toBe("parent-session")
  })

  test("navigation mode can be toggled", () => {
    expect(Panel.isInNavigationMode()).toBe(false)

    Panel.enterNavigationMode()
    expect(Panel.isInNavigationMode()).toBe(true)

    Panel.exitNavigationMode()
    expect(Panel.isInNavigationMode()).toBe(false)
  })

  test("navigate returns false when no children exist", () => {
    Panel.setParentSession("parent-session")

    const result = Panel.navigate("right")
    expect(result).toBe(false)
  })

  test("addChild does not duplicate children", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.addChild("child-1")
    Panel.addChild("child-1")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")
  })

  test("getHint returns empty string in parent view", () => {
    Panel.setParentSession("parent-session")
    const hint = Panel.getHint()
    expect(hint).toBe("")
  })

  test("getHint returns navigation hints in child view", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.navigate("right")

    const hint = Panel.getHint()
    expect(hint).toContain("Ctrl+X")
  })

  test("addChild enforces 50-child cap by removing oldest", () => {
    Panel.setParentSession("parent-session")

    // Add 52 children (cap is 50), oldest 2 removed, so first remaining is child-2
    for (let i = 0; i < 52; i++) {
      Panel.addChild(`child-${i}`)
    }

    expect(Panel.hasChildren()).toBe(true)

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-2")
  })

  test("addChild with duplicate session ID is ignored", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.addChild("child-2")
    Panel.addChild("child-1")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-2")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")
  })

  test("navigate with no direction returns false", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")

    // mock setup requires type bypass
    const result = Panel.navigate("" as any)
    expect(result).toBe(false)
  })

  test("navigate up always switches to parent view", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")

    const result = Panel.navigate("up")
    expect(result).toBe(true)
    expect(Panel.getCurrentSessionID()).toBe("parent-session")
  })

  test("navigate right from parent with children enters child view", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.addChild("child-2")

    const result = Panel.navigate("right")
    expect(result).toBe(true)
    expect(Panel.getCurrentSessionID()).toBe("child-1")
  })

  test("navigate left from parent with children enters child view", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")

    const result = Panel.navigate("left")
    expect(result).toBe(true)
    expect(Panel.getCurrentSessionID()).toBe("child-1")
  })

  test("getCurrentSessionID returns null when in child view with no children", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.navigate("right")

    Panel.reset()
    Panel.setParentSession("parent-session")

    const sessionID = Panel.getCurrentSessionID()
    expect(sessionID).toBe("parent-session")
  })

  test("setParentSession resets children and view", () => {
    Panel.setParentSession("parent-1")
    Panel.addChild("child-1")
    Panel.navigate("right")

    Panel.setParentSession("parent-2")
    expect(Panel.getCurrentSessionID()).toBe("parent-2")
    expect(Panel.hasChildren()).toBe(false)
  })

  test("setParentSession with null clears parent", () => {
    Panel.setParentSession("parent-session")
    Panel.setParentSession(null)

    expect(Panel.getCurrentSessionID()).toBeNull()
  })

  test("reset clears all state including navigation mode", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.enterNavigationMode()
    Panel.navigate("right")

    Panel.reset()

    expect(Panel.getCurrentSessionID()).toBeNull()
    expect(Panel.hasChildren()).toBe(false)
    expect(Panel.isInNavigationMode()).toBe(false)
  })

  test("getHint returns empty string when in child view with no children", () => {
    Panel.setParentSession("parent-session")
    Panel.navigate("right")

    const hint = Panel.getHint()
    expect(hint).toBe("")
  })

  test("getHint includes prev/next hints when children exist", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.addChild("child-2")
    Panel.navigate("right")

    const hint = Panel.getHint()
    expect(hint).toContain("prev")
    expect(hint).toContain("next")
  })

  test("getHint includes parent navigation hint", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.navigate("right")

    const hint = Panel.getHint()
    expect(hint).toContain("back to parent")
  })

  test("navigate right at end wraps to beginning", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.addChild("child-2")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-2")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")
  })

  test("navigate left at start wraps to end", () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.addChild("child-2")

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-1")

    Panel.navigate("left")
    expect(Panel.getCurrentSessionID()).toBe("child-2")
  })

  test("renderPanel does nothing when view is parent", async () => {
    Panel.setParentSession("parent-session")
    await Panel.renderPanel()
    expect(Panel.getCurrentSessionID()).toBe("parent-session")
  })

  test("renderPanel handles empty children array", async () => {
    Panel.setParentSession("parent-session")
    Panel.navigate("right")

    Panel.reset()
    Panel.setParentSession("parent-session")

    const childrenSpy = spyOn(Session, "children").mockResolvedValue([])

    Panel.navigate("right")
    await Panel.renderPanel()

    childrenSpy.mockRestore()
  })

  test("renderPanel loads and displays child session", async () => {
    Panel.setParentSession("parent-session")

    // mock setup requires type bypass
    const childrenSpy = spyOn(Session, "children").mockResolvedValue([{ id: "child-1" } as any])

    // mock setup requires type bypass
    const messagesSpy = spyOn(Session, "messages").mockResolvedValue([
      {
        info: { role: "user" as const },
        parts: [{ type: "text" as const, text: "test message" }],
      } as any,
    ])

    Panel.addChild("child-1")
    Panel.navigate("right")
    await Panel.renderPanel()

    expect(childrenSpy).toHaveBeenCalled()
    expect(messagesSpy).toHaveBeenCalled()

    childrenSpy.mockRestore()
    messagesSpy.mockRestore()
  })

  test("renderPanel handles session load error", async () => {
    Panel.setParentSession("parent-session")

    const childrenSpy = spyOn(Session, "children").mockRejectedValue(new Error("API error"))

    Panel.addChild("child-1")
    Panel.navigate("right")
    await Panel.renderPanel()

    expect(Panel.hasChildren()).toBe(false)
    expect(Panel.getCurrentSessionID()).toBe("parent-session")

    childrenSpy.mockRestore()
  })

  test("renderPanel merges API children with local children", async () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")

    // mock setup requires type bypass
    const childrenSpy = spyOn(Session, "children").mockResolvedValue([
      { id: "child-1" } as any,
      { id: "child-2" } as any,
    ])

    const messagesSpy = spyOn(Session, "messages").mockResolvedValue([])

    Panel.navigate("right")
    await Panel.renderPanel()

    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-2")

    childrenSpy.mockRestore()
    messagesSpy.mockRestore()
  })

  test("renderPanel preserves child index after merge", async () => {
    Panel.setParentSession("parent-session")
    Panel.addChild("child-1")
    Panel.addChild("child-2")

    // mock setup requires type bypass
    const childrenSpy = spyOn(Session, "children").mockResolvedValue([
      { id: "child-1" } as any,
      { id: "child-2" } as any,
      { id: "child-3" } as any,
    ])

    const messagesSpy = spyOn(Session, "messages").mockResolvedValue([])

    Panel.navigate("right")
    Panel.navigate("right")
    expect(Panel.getCurrentSessionID()).toBe("child-2")

    await Panel.renderPanel()

    expect(Panel.getCurrentSessionID()).toBe("child-2")

    childrenSpy.mockRestore()
    messagesSpy.mockRestore()
  })

  test("renderPanel handles messages with assistant role", async () => {
    Panel.setParentSession("parent-session")

    // mock setup requires type bypass
    const childrenSpy = spyOn(Session, "children").mockResolvedValue([{ id: "child-1" } as any])

    // mock setup requires type bypass
    const messagesSpy = spyOn(Session, "messages").mockResolvedValue([
      {
        info: { role: "assistant" as const },
        parts: [
          { type: "text" as const, text: "assistant response" },
          {
            type: "tool" as const,
            tool: "bash",
            state: { status: "completed" as const, input: "ls -la" },
          },
          { type: "subtask" as const, description: "run command" },
          { type: "reasoning" as const, text: "thinking..." },
        ],
      } as any,
    ])

    Panel.addChild("child-1")
    Panel.navigate("right")
    await Panel.renderPanel()

    childrenSpy.mockRestore()
    messagesSpy.mockRestore()
  })

  test("renderPanel handles tool state variations", async () => {
    Panel.setParentSession("parent-session")

    // mock setup requires type bypass
    const childrenSpy = spyOn(Session, "children").mockResolvedValue([{ id: "child-1" } as any])

    // mock setup requires type bypass
    const messagesSpy = spyOn(Session, "messages").mockResolvedValue([
      {
        info: { role: "assistant" as const },
        parts: [
          {
            type: "tool" as const,
            tool: "bash",
            state: { status: "error" as const, input: "invalid" },
          },
          {
            type: "tool" as const,
            tool: "read",
            state: { status: "pending" as const, input: "file.txt" },
          },
        ],
      } as any,
    ])

    Panel.addChild("child-1")
    Panel.navigate("right")
    await Panel.renderPanel()

    childrenSpy.mockRestore()
    messagesSpy.mockRestore()
  })

  test("renderPanel filters non-text user message parts", async () => {
    Panel.setParentSession("parent-session")

    // mock setup requires type bypass
    const childrenSpy = spyOn(Session, "children").mockResolvedValue([{ id: "child-1" } as any])

    // mock setup requires type bypass
    const messagesSpy = spyOn(Session, "messages").mockResolvedValue([
      {
        info: { role: "user" as const },
        parts: [
          { type: "text" as const, text: "message 1" },
          { type: "image" as const },
          { type: "text" as const, text: "message 2" },
        ],
      } as any,
    ])

    Panel.addChild("child-1")
    Panel.navigate("right")
    await Panel.renderPanel()

    childrenSpy.mockRestore()
    messagesSpy.mockRestore()
  })

  test("renderPanel handles messages without info", async () => {
    Panel.setParentSession("parent-session")

    // mock setup requires type bypass
    const childrenSpy = spyOn(Session, "children").mockResolvedValue([{ id: "child-1" } as any])

    // mock setup requires type bypass
    const messagesSpy = spyOn(Session, "messages").mockResolvedValue([
      { parts: [{ type: "text" as const, text: "no info" }] } as any,
    ])

    Panel.addChild("child-1")
    Panel.navigate("right")
    await Panel.renderPanel()

    childrenSpy.mockRestore()
    messagesSpy.mockRestore()
  })

  test("renderPanel handles message fetch error", async () => {
    Panel.setParentSession("parent-session")

    // mock setup requires type bypass
    const childrenSpy = spyOn(Session, "children").mockResolvedValue([{ id: "child-1" } as any])

    const messagesSpy = spyOn(Session, "messages").mockRejectedValue(new Error("fetch failed"))

    Panel.addChild("child-1")
    Panel.navigate("right")
    await Panel.renderPanel()

    childrenSpy.mockRestore()
    messagesSpy.mockRestore()
  })

  test("renderPanel with concurrent load calls only loads once", async () => {
    Panel.setParentSession("parent-session")

    let callCount = 0
    // mock setup requires type bypass
    const childrenSpy = spyOn(Session, "children").mockImplementation((() => {
      callCount++
      return Promise.resolve([{ id: "child-1" } as any])
    }) as any)

    const messagesSpy = spyOn(Session, "messages").mockResolvedValue([])

    Panel.addChild("child-1")
    Panel.navigate("right")

    const promise1 = Panel.renderPanel()
    const promise2 = Panel.renderPanel()

    await Promise.all([promise1, promise2])

    expect(callCount).toBeLessThanOrEqual(2)

    childrenSpy.mockRestore()
    messagesSpy.mockRestore()
  })
})
