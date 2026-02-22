/**
 * Audit: Model resolution in pulse.ts spawn functions
 *
 * This file documents the current model resolution behavior in all spawn
 * functions inside the pulse pipeline, and compares it with how tool/task.ts
 * resolves the model from the parent session message.
 *
 * === FINDINGS ===
 *
 * tool/task.ts (SessionPrompt.prompt call sites):
 *   - Reads parent message: MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })
 *   - Resolves model: agent.model ?? { modelID: msg.info.modelID, providerID: msg.info.providerID }
 *   - Passes explicit model to SessionPrompt.prompt({ ..., model: { modelID, providerID } })
 *   - Result: subagents inherit the parent session's active model unless the agent overrides it
 *
 * pulse-scheduler.ts (5 call sites — no model passed to any):
 *   1. spawnDeveloper        (line 218): SessionPrompt.prompt({ sessionID, agent, parts }) — no model
 *   2. spawnAdversarial      (line 335): SessionPrompt.prompt({ sessionID, agent, parts }) — no model
 *   3. respawnDeveloper      (line 442): SessionPrompt.prompt({ sessionID, agent, parts }) — no model
 *
 * pulse-monitoring.ts (2 call sites — no model passed to any):
 *   4. spawnSteering         (line 194): SessionPrompt.prompt({ sessionID, agent, parts }) — no model
 *   5. checkSteering/steer   (line 298): SessionPrompt.prompt({ sessionID, agent, parts }) — no model
 *
 * === GAP ===
 *
 * All five pulse spawn functions omit the `model` field from SessionPrompt.prompt.
 * This means:
 *   - The model used is whatever the session/agent defaults to (not the PM session's active model)
 *   - tool/task.ts explicitly propagates the PM model; the pulse pipeline does not
 *   - Spawn functions that need to adopt the PM model will need to be updated to
 *     resolve it (e.g. from PM session messages or agent config) and pass it through
 *
 * === SPAWN FUNCTION SIGNATURES ===
 *
 *   spawnDeveloper(task, jobId, projectId, pmSessionId): Promise<void>
 *     - Creates worktree, creates child session (parentID: pmSessionId), calls prompt
 *     - agent: "developer-pipeline"
 *
 *   spawnAdversarial(task, jobId, projectId, pmSessionId): Promise<void>
 *     - Uses existing worktree, creates child session (parentID: pmSessionId), calls prompt
 *     - agent: "adversarial-pipeline"
 *
 *   respawnDeveloper(task, jobId, projectId, pmSessionId, attempt, verdict): Promise<void>
 *     - Reuses existing worktree, creates child session (parentID: pmSessionId), calls prompt
 *     - agent: "developer-pipeline"
 *
 *   spawnSteering(task, history, pmSessionId): Promise<{action, message}|null>
 *     - Creates child session (parentID: pmSessionId), calls prompt, polls result
 *     - agent: "steering"
 *
 *   checkSteering/steer guidance (inline in checkSteering):
 *     - Sends guidance prompt to existing developer session (task.assignee)
 *     - agent: "developer-pipeline"
 */

import { describe, test, expect } from "bun:test"
import fs from "fs/promises"

// Source files under audit
const SCHEDULER_SRC = "src/tasks/pulse-scheduler.ts"
const MONITORING_SRC = "src/tasks/pulse-monitoring.ts"
const TASK_TOOL_SRC = "src/tool/task.ts"

describe("model resolution audit: pulse spawn functions vs tool/task.ts", () => {
  describe("tool/task.ts — reference implementation", () => {
    test("reads model from parent session message before calling SessionPrompt.prompt", async () => {
      const src = await Bun.file(TASK_TOOL_SRC).text()
      // Must fetch the parent message to get the model
      expect(src).toContain("MessageV2.get({ sessionID: ctx.sessionID, messageID: ctx.messageID })")
      // Must resolve model with agent override fallback to parent model
      expect(src).toContain("agent.model ??")
      expect(src).toContain("msg.info.modelID")
      expect(src).toContain("msg.info.providerID")
    })

    test("passes resolved model explicitly to SessionPrompt.prompt", async () => {
      const src = await Bun.file(TASK_TOOL_SRC).text()
      // Both async and sync SessionPrompt.prompt calls must include model field
      const promptCalls = [...src.matchAll(/SessionPrompt\.prompt\(\{[\s\S]*?\}\)/g)].map((m) => m[0])
      expect(promptCalls.length).toBeGreaterThanOrEqual(2)
      for (const call of promptCalls) {
        expect(call).toContain("model:")
      }
    })
  })

  describe("pulse-scheduler.ts — spawnDeveloper", () => {
    test("SessionPrompt.prompt call omits model field", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      // Locate the spawnDeveloper function body
      const fnStart = src.indexOf("async function spawnDeveloper(")
      const fnEnd = src.indexOf("\nasync function spawnAdversarial(", fnStart)
      const body = src.slice(fnStart, fnEnd)
      // Must call SessionPrompt.prompt
      expect(body).toContain("SessionPrompt.prompt(")
      // Must use agent "developer-pipeline"
      expect(body).toContain('"developer-pipeline"')
      // Must NOT pass a model field (current behavior being audited)
      const promptMatch = body.match(/SessionPrompt\.prompt\(\{([\s\S]*?)\}\)/)
      expect(promptMatch).not.toBeNull()
      expect(promptMatch![1]).not.toContain("model:")
    })
  })

  describe("pulse-scheduler.ts — spawnAdversarial", () => {
    test("SessionPrompt.prompt call omits model field", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      const fnStart = src.indexOf("async function spawnAdversarial(")
      const fnEnd = src.indexOf("\nasync function respawnDeveloper(", fnStart)
      const body = src.slice(fnStart, fnEnd)
      expect(body).toContain("SessionPrompt.prompt(")
      expect(body).toContain('"adversarial-pipeline"')
      const promptMatch = body.match(/SessionPrompt\.prompt\(\{([\s\S]*?)\}\)/)
      expect(promptMatch).not.toBeNull()
      expect(promptMatch![1]).not.toContain("model:")
    })
  })

  describe("pulse-scheduler.ts — respawnDeveloper", () => {
    test("SessionPrompt.prompt call omits model field", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      const fnStart = src.indexOf("async function respawnDeveloper(")
      // End at the export line
      const fnEnd = src.indexOf("\nexport {", fnStart)
      const body = src.slice(fnStart, fnEnd)
      expect(body).toContain("SessionPrompt.prompt(")
      expect(body).toContain('"developer-pipeline"')
      const promptMatch = body.match(/SessionPrompt\.prompt\(\{([\s\S]*?)\}\)/)
      expect(promptMatch).not.toBeNull()
      expect(promptMatch![1]).not.toContain("model:")
    })
  })

  describe("pulse-monitoring.ts — spawnSteering", () => {
    test("SessionPrompt.prompt call omits model field", async () => {
      const src = await Bun.file(MONITORING_SRC).text()
      const fnStart = src.indexOf("async function spawnSteering(")
      const fnEnd = src.indexOf("\nexport async function checkSteering(", fnStart)
      const body = src.slice(fnStart, fnEnd)
      expect(body).toContain("SessionPrompt.prompt(")
      expect(body).toContain('"steering"')
      const promptMatch = body.match(/SessionPrompt\.prompt\(\{([\s\S]*?)\}\)/)
      expect(promptMatch).not.toBeNull()
      expect(promptMatch![1]).not.toContain("model:")
    })
  })

  describe("pulse-monitoring.ts — checkSteering steer-guidance prompt", () => {
    test("inline SessionPrompt.prompt call for steering guidance omits model field", async () => {
      const src = await Bun.file(MONITORING_SRC).text()
      const fnStart = src.indexOf("export async function checkSteering(")
      const body = src.slice(fnStart)
      // The steer-guidance prompt sends to the developer session (task.assignee)
      expect(body).toContain("SessionPrompt.prompt(")
      expect(body).toContain("[Steering guidance]")
      // Find the prompt call in the steer branch
      const steerIdx = body.indexOf("[Steering guidance]")
      const callStart = body.lastIndexOf("SessionPrompt.prompt({", steerIdx)
      const callEnd = body.indexOf("})", callStart) + 2
      const call = body.slice(callStart, callEnd)
      expect(call).not.toContain("model:")
    })
  })

  describe("call site inventory", () => {
    test("scheduler has exactly 3 SessionPrompt.prompt call sites", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      const count = (src.match(/SessionPrompt\.prompt\(/g) ?? []).length
      expect(count).toBe(3)
    })

    test("monitoring has exactly 2 SessionPrompt.prompt call sites", async () => {
      const src = await Bun.file(MONITORING_SRC).text()
      const count = (src.match(/SessionPrompt\.prompt\(/g) ?? []).length
      expect(count).toBe(2)
    })

    test("task tool has exactly 2 SessionPrompt.prompt call sites (sync + async paths)", async () => {
      const src = await Bun.file(TASK_TOOL_SRC).text()
      const count = (src.match(/SessionPrompt\.prompt\(/g) ?? []).length
      expect(count).toBe(2)
    })
  })

  describe("spawn function signatures", () => {
    test("spawnDeveloper accepts (task, jobId, projectId, pmSessionId)", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      expect(src).toContain("async function spawnDeveloper(task: Task, jobId: string, projectId: string, pmSessionId: string)")
    })

    test("spawnAdversarial accepts (task, jobId, projectId, pmSessionId)", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      expect(src).toContain("async function spawnAdversarial(task: Task, jobId: string, projectId: string, pmSessionId: string)")
    })

    test("respawnDeveloper accepts (task, jobId, projectId, pmSessionId, attempt, verdict)", async () => {
      const src = await Bun.file(SCHEDULER_SRC).text()
      expect(src).toContain("async function respawnDeveloper(")
      expect(src).toContain("pmSessionId: string,")
      expect(src).toContain("attempt: number,")
      expect(src).toContain("verdict: AdversarialVerdict,")
    })

    test("spawnSteering accepts (task, history, pmSessionId)", async () => {
      const src = await Bun.file(MONITORING_SRC).text()
      expect(src).toContain("async function spawnSteering(")
      expect(src).toContain("history: string,")
      expect(src).toContain("pmSessionId: string,")
    })
  })

  describe("session creation pattern", () => {
    test("all spawn functions create child sessions with parentID set to pmSessionId", async () => {
      const scheduler = await Bun.file(SCHEDULER_SRC).text()
      const monitoring = await Bun.file(MONITORING_SRC).text()
      // Every Session.createNext in both files must reference parentID with pmSessionId
      for (const src of [scheduler, monitoring]) {
        const createCalls = [...src.matchAll(/Session\.createNext\(\{([\s\S]*?)\}\)/g)]
        for (const [, body] of createCalls) {
          expect(body).toContain("parentID: pmSessionId")
        }
      }
    })
  })
})
