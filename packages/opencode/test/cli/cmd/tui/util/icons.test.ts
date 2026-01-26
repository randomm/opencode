/**
 * Tests for task state icons and color system
 */

import { describe, it, expect } from "bun:test"
import { Icons } from "../../../../../src/cli/cmd/tui/util/icons"

describe("Icons.taskIcon", () => {
  it("returns green checkmark for completed status", () => {
    const result = Icons.taskIcon("completed")
    expect(result).toContain(Icons.colors.green)
    expect(result).toContain(Icons.icons.taskComplete)
    expect(result).toContain(Icons.colors.reset)
  })

  it("returns dim square for pending status", () => {
    const result = Icons.taskIcon("pending")
    expect(result).toContain(Icons.colors.dim)
    expect(result).toContain(Icons.icons.taskPending)
    expect(result).toContain(Icons.colors.reset)
  })

  it("returns green circle for running status", () => {
    const result = Icons.taskIcon("running")
    expect(result).toContain(Icons.colors.green)
    expect(result).toContain(Icons.icons.taskRunning)
    expect(result).toContain(Icons.colors.reset)
  })

  it("returns yellow diamond for progress status", () => {
    const result = Icons.taskIcon("progress")
    expect(result).toContain(Icons.colors.yellow)
    expect(result).toContain(Icons.icons.taskProgress)
    expect(result).toContain(Icons.colors.reset)
  })

  it("returns safe fallback for invalid status", () => {
    const result = Icons.taskIcon("invalid" as any)
    expect(result).toContain(Icons.colors.dim)
    expect(result).toContain(Icons.icons.taskPending)
  })
})

describe("Icons.agentBadge", () => {
  it("returns empty string for empty name", () => {
    const result = Icons.agentBadge("")
    expect(result).toBe("")
  })

  it("returns colored badge for valid name", () => {
    const result = Icons.agentBadge("DevAgent")
    expect(result).toContain(Icons.colors.cyan)
    expect(result).toContain("DevAgent")
    expect(result).toContain(Icons.colors.reset)
  })

  it("preserves name content exactly", () => {
    const name = "MySpecialAgent123"
    const result = Icons.agentBadge(name)
    expect(result).toContain(name)
  })

  it("handles names with special characters", () => {
    const name = "agent-name_2"
    const result = Icons.agentBadge(name)
    expect(result).toContain(name)
  })
})

describe("Icons.roleBadge", () => {
  it("returns empty string for empty role", () => {
    const result = Icons.roleBadge("")
    expect(result).toBe("")
  })

  it("returns colored badge with icon for valid role", () => {
    const result = Icons.roleBadge("developer")
    expect(result).toContain(Icons.colors.magenta)
    expect(result).toContain(Icons.icons.agentRole)
    expect(result).toContain("developer")
    expect(result).toContain(Icons.colors.reset)
  })

  it("preserves role content exactly", () => {
    const role = "ProductManager"
    const result = Icons.roleBadge(role)
    expect(result).toContain(role)
  })

  it("includes icon separator in output", () => {
    const result = Icons.roleBadge("admin")
    const parts = result.split(" ")
    expect(parts.length).toBeGreaterThanOrEqual(2)
  })
})
