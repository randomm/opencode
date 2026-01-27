import { describe, test, expect, beforeEach } from "bun:test"
import * as Panel from "../../../src/cli/lite/panel"

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
})
