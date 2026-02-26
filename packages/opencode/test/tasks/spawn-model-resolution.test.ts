/**
 * TDD: Model resolution in pulse spawn functions
 *
 * Acceptance criteria:
 *   - spawnDeveloper, spawnAdversarial, spawnSteering all pass `model:` to SessionPrompt.prompt()
 *   - Model is resolved from PM session's last assistant message (modelID/providerID)
 *   - Falls back to Provider.defaultModel() when no assistant message exists
 */

import { describe, test, expect } from "bun:test"

const SCHEDULER_SRC = "src/tasks/pulse-scheduler.ts"
const MONITORING_SRC = "src/tasks/pulse-monitoring.ts"

describe("spawn functions pass model to SessionPrompt.prompt", () => {
  describe("pulse-scheduler.ts — spawnDeveloper", () => {
    test("calls resolveModel before SessionPrompt.prompt", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      const fnStart = src.indexOf("async function spawnDeveloper(")
      const fnEnd = src.indexOf("\nasync function spawnAdversarial(", fnStart)
      const body = src.slice(fnStart, fnEnd)
      expect(body).toContain("resolveModel(")
    })

    test("passes model field to SessionPrompt.prompt", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      const fnStart = src.indexOf("async function spawnDeveloper(")
      const fnEnd = src.indexOf("\nasync function spawnAdversarial(", fnStart)
      const body = src.slice(fnStart, fnEnd)
      const promptMatch = body.match(/SessionPrompt\.prompt\(\{([\s\S]*?)\}\)/)
      expect(promptMatch).not.toBeNull()
      expect(promptMatch![1]).toContain("model:")
    })
  })

  describe("pulse-scheduler.ts — spawnAdversarial", () => {
    test("calls resolveModel before SessionPrompt.prompt", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      const fnStart = src.indexOf("async function spawnAdversarial(")
      const fnEnd = src.indexOf("\nasync function respawnDeveloper(", fnStart)
      const body = src.slice(fnStart, fnEnd)
      expect(body).toContain("resolveModel(")
    })

    test("passes model field to SessionPrompt.prompt", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      const fnStart = src.indexOf("async function spawnAdversarial(")
      const fnEnd = src.indexOf("\nasync function respawnDeveloper(", fnStart)
      const body = src.slice(fnStart, fnEnd)
      const promptMatch = body.match(/SessionPrompt\.prompt\(\{([\s\S]*?)\}\)/)
      expect(promptMatch).not.toBeNull()
      expect(promptMatch![1]).toContain("model:")
    })
  })

  describe("pulse-monitoring.ts — spawnSteering", () => {
    test("calls resolveModel before SessionPrompt.prompt", async () => {
      const src = await Bun.file(MONITORING_SRC).text()
      const fnStart = src.indexOf("async function spawnSteering(")
      const fnEnd = src.indexOf("\nexport async function checkSteering(", fnStart)
      const body = src.slice(fnStart, fnEnd)
      expect(body).toContain("resolveModel(")
    })

    test("passes model field to SessionPrompt.prompt", async () => {
      const src = await Bun.file(MONITORING_SRC).text()
      const fnStart = src.indexOf("async function spawnSteering(")
      const fnEnd = src.indexOf("\nexport async function checkSteering(", fnStart)
      const body = src.slice(fnStart, fnEnd)
      const promptMatch = body.match(/SessionPrompt\.prompt\(\{([\s\S]*?)\}\)/)
      expect(promptMatch).not.toBeNull()
      expect(promptMatch![1]).toContain("model:")
    })
  })
})
