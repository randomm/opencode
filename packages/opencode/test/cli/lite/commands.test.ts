/**
 * Tests for src/cli/lite/commands.ts
 *
 * Coverage: ~44% line coverage
 *
 * Tested functions (pure/testable):
 * - loadRecentModels(): reads recent models from JSON file
 * - saveRecentModels(): writes recent models to JSON file
 * - addRecentModel(): adds model to front, deduplicates, caps at 10
 * - getAllModels(): aggregates models from providers, separates recent from all
 *
 * Untested functions (require integration/E2E testing):
 * - handleSessions(): interactive session selection with terminal I/O
 * - handleNew(): creates new session (requires Instance.directory)
 * - handleAgents(): interactive agent selection with terminal I/O
 * - handleModels(): interactive model selection with terminal I/O
 * - handleSubagentModel(): interactive subagent model selection
 * - handleCustomCommand(): executes custom commands with streaming
 *
 * These interactive handlers depend on:
 * - select() function (terminal UI)
 * - write() for terminal output
 * - Session.list(), Session.createNext()
 * - Agent.list()
 * - Instance.directory
 *
 * These would require E2E tests with terminal emulation or
 * refactoring to inject dependencies for unit testing.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import path from "path"
import fs from "fs/promises"
import os from "os"

const testStateDir = path.join(os.tmpdir(), "opencode-test-commands")

mock.module("xdg-basedir", () => {
  return {
    xdgData: path.join(testStateDir, ".local", "share"),
    xdgCache: path.join(testStateDir, ".cache"),
    xdgConfig: path.join(testStateDir, ".config"),
    xdgState: testStateDir,
  }
})

import {
  loadRecentModels,
  saveRecentModels,
  addRecentModel,
  getAllModels,
  type ModelRecent,
} from "../../../src/cli/lite/commands"

describe("commands", () => {
  beforeEach(async () => {
    await fs.mkdir(testStateDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(testStateDir, { recursive: true, force: true })
    } catch {}
  })

  describe("loadRecentModels", () => {
    test("returns empty array when model.json does not exist", async () => {
      const recent = await loadRecentModels()
      expect(recent).toEqual([])
    })

    test("returns empty array when recent field is missing", async () => {
      const modelFile = path.join(testStateDir, "opencode", "model.json")
      await fs.mkdir(path.dirname(modelFile), { recursive: true })
      await Bun.write(modelFile, JSON.stringify({ favorite: [] }))

      const recent = await loadRecentModels()
      expect(recent).toEqual([])
    })

    test("returns recent models when file exists", async () => {
      const modelFile = path.join(testStateDir, "opencode", "model.json")
      await fs.mkdir(path.dirname(modelFile), { recursive: true })
      const expected: ModelRecent[] = [
        { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
        { providerID: "openai", modelID: "gpt-4o" },
      ]
      await Bun.write(
        modelFile,
        JSON.stringify({
          recent: expected,
          favorite: [],
        }),
      )

      const recent = await loadRecentModels()
      expect(recent).toEqual(expected)
    })

    test("handles malformed JSON gracefully", async () => {
      const modelFile = path.join(testStateDir, "opencode", "model.json")
      await fs.mkdir(path.dirname(modelFile), { recursive: true })
      await Bun.write(modelFile, "not valid json")

      await expect(loadRecentModels()).rejects.toThrow()
    })

    test("returns empty recent array when recent field is null", async () => {
      const modelFile = path.join(testStateDir, "opencode", "model.json")
      await fs.mkdir(path.dirname(modelFile), { recursive: true })
      await Bun.write(modelFile, JSON.stringify({ recent: null, favorite: [] }))

      const recent = await loadRecentModels()
      expect(recent).toEqual([])
    })
  })

  describe("saveRecentModels", () => {
    test("creates file with recent models when file does not exist", async () => {
      const modelFile = path.join(testStateDir, "opencode", "model.json")
      const recent: ModelRecent[] = [{ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" }]

      await saveRecentModels(recent)

      const file = Bun.file(modelFile)
      const exists = await file.exists()
      expect(exists).toBe(true)

      const data = await file.json()
      expect(data.recent).toEqual(recent)
      expect(data.favorite).toEqual([])
    })

    test("preserves favorite field when updating recent", async () => {
      const modelFile = path.join(testStateDir, "opencode", "model.json")
      await fs.mkdir(path.dirname(modelFile), { recursive: true })
      const favorite: ModelRecent[] = [{ providerID: "openai", modelID: "gpt-4o" }]
      await Bun.write(
        modelFile,
        JSON.stringify({
          recent: [],
          favorite,
        }),
      )

      const recent: ModelRecent[] = [{ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" }]
      await saveRecentModels(recent)

      const data = await Bun.file(modelFile).json()
      expect(data.recent).toEqual(recent)
      expect(data.favorite).toEqual(favorite)
    })

    test("overwrites existing recent field", async () => {
      const modelFile = path.join(testStateDir, "opencode", "model.json")
      await fs.mkdir(path.dirname(modelFile), { recursive: true })
      const oldRecent: ModelRecent[] = [{ providerID: "openai", modelID: "gpt-4o" }]
      await Bun.write(
        modelFile,
        JSON.stringify({
          recent: oldRecent,
          favorite: [],
        }),
      )

      const newRecent: ModelRecent[] = [{ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" }]
      await saveRecentModels(newRecent)

      const data = await Bun.file(modelFile).json()
      expect(data.recent).toEqual(newRecent)
    })

    test("saves empty recent array", async () => {
      const modelFile = path.join(testStateDir, "opencode", "model.json")
      await fs.mkdir(path.dirname(modelFile), { recursive: true })

      await saveRecentModels([])

      const data = await Bun.file(modelFile).json()
      expect(data.recent).toEqual([])
    })

    test("creates parent directory if needed", async () => {
      const modelFile = path.join(testStateDir, "opencode", "model.json")
      const recent: ModelRecent[] = [{ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" }]

      await saveRecentModels(recent)

      const parentExists = await fs
        .access(path.dirname(modelFile))
        .then(() => true)
        .catch(() => false)
      expect(parentExists).toBe(true)
    })
  })

  describe("addRecentModel", () => {
    test("adds first model to empty recent list", async () => {
      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const recent = await loadRecentModels()
      expect(recent).toEqual([{ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" }])
    })

    test("adds model to front of list", async () => {
      await saveRecentModels([
        { providerID: "openai", modelID: "gpt-4o" },
        { providerID: "anthropic", modelID: "claude-3-opus-20240229" },
      ])

      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const recent = await loadRecentModels()
      expect(recent[0]).toEqual({ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" })
      expect(recent.length).toBe(3)
    })

    test("deduplicates existing model and moves to front", async () => {
      await saveRecentModels([
        { providerID: "anthropic", modelID: "claude-3-opus-20240229" },
        { providerID: "openai", modelID: "gpt-4o" },
        { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
      ])

      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const recent = await loadRecentModels()
      expect(recent).toEqual([
        { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
        { providerID: "anthropic", modelID: "claude-3-opus-20240229" },
        { providerID: "openai", modelID: "gpt-4o" },
      ])
    })

    test("trims list to 10 items", async () => {
      const initial: ModelRecent[] = Array.from({ length: 10 }, (_, i) => ({
        providerID: "provider",
        modelID: `model-${i}`,
      }))
      await saveRecentModels(initial)

      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const recent = await loadRecentModels()
      expect(recent.length).toBe(10)
      expect(recent[0]).toEqual({ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" })
      expect(recent[9]).toEqual({ providerID: "provider", modelID: "model-8" })
    })

    test("deduplicates when list is at capacity", async () => {
      const initial: ModelRecent[] = [
        { providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" },
        ...Array.from({ length: 9 }, (_, i) => ({
          providerID: "provider",
          modelID: `model-${i}`,
        })),
      ]
      await saveRecentModels(initial)

      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const recent = await loadRecentModels()
      expect(recent.length).toBe(10)
      expect(recent[0]).toEqual({ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" })
      expect(
        recent.filter((r) => r.providerID === "anthropic" && r.modelID === "claude-3-5-sonnet-20241022").length,
      ).toBe(1)
    })

    test("handles adding same model twice in sequence", async () => {
      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")
      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const recent = await loadRecentModels()
      expect(recent.length).toBe(1)
      expect(recent[0]).toEqual({ providerID: "anthropic", modelID: "claude-3-5-sonnet-20241022" })
    })

    test("distinguishes models with same modelID but different providerID", async () => {
      await addRecentModel("provider1", "model-x")
      await addRecentModel("provider2", "model-x")

      const recent = await loadRecentModels()
      expect(recent.length).toBe(2)
      expect(recent[0]).toEqual({ providerID: "provider2", modelID: "model-x" })
      expect(recent[1]).toEqual({ providerID: "provider1", modelID: "model-x" })
    })

    test("only removes exact duplicates", async () => {
      await saveRecentModels([
        { providerID: "provider1", modelID: "model-x" },
        { providerID: "provider2", modelID: "model-x" },
      ])

      await addRecentModel("provider1", "model-x")

      const recent = await loadRecentModels()
      expect(recent.length).toBe(2)
      expect(recent.filter((r) => r.providerID === "provider1" && r.modelID === "model-x").length).toBe(1)
      expect(recent.filter((r) => r.providerID === "provider2" && r.modelID === "model-x").length).toBe(1)
    })
  })

  describe("getAllModels", () => {
    test("returns empty array when no providers available", async () => {
      mock.module("../../../src/provider/provider", () => ({
        Provider: {
          list: async () => ({}),
        },
      }))

      const models = await getAllModels()
      const nonSeparator = models.filter((m) => !m.separator)
      expect(nonSeparator.length).toBe(0)
    })

    test("aggregates models from multiple providers", async () => {
      mock.module("../../../src/provider/provider", () => ({
        Provider: {
          list: async () => ({
            anthropic: {
              models: {
                "claude-3-5-sonnet-20241022": {
                  name: "Claude 3.5 Sonnet",
                  family: "claude-3",
                  cost: { input: 3, output: 15 },
                },
              },
            },
            openai: {
              models: {
                "gpt-4o": {
                  name: "GPT-4o",
                  family: "gpt-4",
                  cost: { input: 5, output: 15 },
                },
              },
            },
          }),
        },
      }))

      const models = await getAllModels()
      const nonSeparator = models.filter((m) => !m.separator)
      expect(nonSeparator.length).toBe(2)

      const anthropicModel = nonSeparator.find((m) => m.value === "anthropic/claude-3-5-sonnet-20241022")
      expect(anthropicModel).toBeDefined()
      expect(anthropicModel?.label).toContain("Claude 3.5 Sonnet")
      expect(anthropicModel?.label).toContain("anthropic")
      expect(anthropicModel?.description).toContain("claude-3")
      expect(anthropicModel?.description).toContain("Paid")

      const openaiModel = nonSeparator.find((m) => m.value === "openai/gpt-4o")
      expect(openaiModel).toBeDefined()
      expect(openaiModel?.label).toContain("GPT-4o")
      expect(openaiModel?.label).toContain("openai")
    })

    test("separates recent from all models", async () => {
      mock.module("../../../src/provider/provider", () => ({
        Provider: {
          list: async () => ({
            anthropic: {
              models: {
                "claude-3-5-sonnet-20241022": {
                  name: "Claude 3.5 Sonnet",
                  family: "claude-3",
                  cost: { input: 3, output: 15 },
                },
                "claude-3-opus-20240229": {
                  name: "Claude 3 Opus",
                  family: "claude-3",
                  cost: { input: 15, output: 75 },
                },
              },
            },
          }),
        },
      }))

      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const models = await getAllModels()

      const recentSection = models.find((m) => m.section === "Recent")
      const allModelsSection = models.find((m) => m.section === "All Models")

      expect(recentSection).toBeDefined()
      expect(allModelsSection).toBeDefined()

      const recentModels = models.filter((m) => {
        const recentIdx = models.indexOf(recentSection!)
        const allIdx = models.indexOf(allModelsSection!)
        const idx = models.indexOf(m)
        return idx > recentIdx && idx < allIdx && !m.separator
      })

      expect(recentModels.length).toBe(1)
      expect(recentModels[0].value).toBe("anthropic/claude-3-5-sonnet-20241022")
    })

    test("excludes recent models from all models section", async () => {
      mock.module("../../../src/provider/provider", () => ({
        Provider: {
          list: async () => ({
            anthropic: {
              models: {
                "claude-3-5-sonnet-20241022": {
                  name: "Claude 3.5 Sonnet",
                  family: "claude-3",
                  cost: { input: 3, output: 15 },
                },
                "claude-3-opus-20240229": {
                  name: "Claude 3 Opus",
                  family: "claude-3",
                  cost: { input: 15, output: 75 },
                },
              },
            },
          }),
        },
      }))

      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const models = await getAllModels()

      const allModelsSection = models.find((m) => m.section === "All Models")
      const allModels = models.filter((m) => {
        const allIdx = models.indexOf(allModelsSection!)
        const idx = models.indexOf(m)
        return idx > allIdx && !m.separator && !m.section
      })

      expect(allModels.length).toBe(1)
      expect(allModels[0].value).toBe("anthropic/claude-3-opus-20240229")
    })

    test("marks free models in description", async () => {
      mock.module("../../../src/provider/provider", () => ({
        Provider: {
          list: async () => ({
            opencode: {
              models: {
                "free-model": {
                  name: "Free Model",
                  family: "test",
                  cost: { input: 0, output: 0 },
                },
              },
            },
          }),
        },
      }))

      const models = await getAllModels()
      const nonSeparator = models.filter((m) => !m.separator && !m.section)

      expect(nonSeparator.length).toBe(1)
      expect(nonSeparator[0].description).toContain("Free")
      expect(nonSeparator[0].description).not.toContain("Paid")
    })

    test("handles models without family field", async () => {
      mock.module("../../../src/provider/provider", () => ({
        Provider: {
          list: async () => ({
            provider: {
              models: {
                "test-model": {
                  name: "Test Model",
                  cost: { input: 1, output: 1 },
                },
              },
            },
          }),
        },
      }))

      const models = await getAllModels()
      const nonSeparator = models.filter((m) => !m.separator && !m.section)

      expect(nonSeparator.length).toBe(1)
      expect(nonSeparator[0].description).toContain("Paid")
    })

    test("maintains order of recent models", async () => {
      mock.module("../../../src/provider/provider", () => ({
        Provider: {
          list: async () => ({
            anthropic: {
              models: {
                "claude-3-5-sonnet-20241022": {
                  name: "Claude 3.5 Sonnet",
                  family: "claude-3",
                  cost: { input: 3, output: 15 },
                },
                "claude-3-opus-20240229": {
                  name: "Claude 3 Opus",
                  family: "claude-3",
                  cost: { input: 15, output: 75 },
                },
                "claude-3-haiku-20240307": {
                  name: "Claude 3 Haiku",
                  family: "claude-3",
                  cost: { input: 0.25, output: 1.25 },
                },
              },
            },
          }),
        },
      }))

      await addRecentModel("anthropic", "claude-3-opus-20240229")
      await addRecentModel("anthropic", "claude-3-haiku-20240307")
      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const models = await getAllModels()
      const recentSection = models.find((m) => m.section === "Recent")
      const allModelsSection = models.find((m) => m.section === "All Models")

      const recentIdx = models.indexOf(recentSection!)
      const allIdx = allModelsSection ? models.indexOf(allModelsSection) : models.length

      const recentModels = models.filter((m) => {
        const idx = models.indexOf(m)
        return idx > recentIdx && idx < allIdx && !m.separator && !m.section
      })

      expect(recentModels.length).toBe(3)
      expect(recentModels[0].value).toBe("anthropic/claude-3-5-sonnet-20241022")
      expect(recentModels[1].value).toBe("anthropic/claude-3-haiku-20240307")
      expect(recentModels[2].value).toBe("anthropic/claude-3-opus-20240229")
    })

    test("only shows recent section when recent models exist", async () => {
      mock.module("../../../src/provider/provider", () => ({
        Provider: {
          list: async () => ({
            anthropic: {
              models: {
                "claude-3-5-sonnet-20241022": {
                  name: "Claude 3.5 Sonnet",
                  family: "claude-3",
                  cost: { input: 3, output: 15 },
                },
              },
            },
          }),
        },
      }))

      const models = await getAllModels()
      const recentSection = models.find((m) => m.section === "Recent")

      expect(recentSection).toBeUndefined()
    })

    test("filters out recent models that no longer exist in providers", async () => {
      mock.module("../../../src/provider/provider", () => ({
        Provider: {
          list: async () => ({
            anthropic: {
              models: {
                "claude-3-5-sonnet-20241022": {
                  name: "Claude 3.5 Sonnet",
                  family: "claude-3",
                  cost: { input: 3, output: 15 },
                },
              },
            },
          }),
        },
      }))

      await addRecentModel("anthropic", "claude-3-opus-20240229")
      await addRecentModel("anthropic", "claude-3-5-sonnet-20241022")

      const models = await getAllModels()
      const recentSection = models.find((m) => m.section === "Recent")
      const allModelsSection = models.find((m) => m.section === "All Models")

      const recentModels = models.filter((m) => {
        const recentIdx = models.indexOf(recentSection!)
        const allIdx = allModelsSection ? models.indexOf(allModelsSection) : models.length
        const idx = models.indexOf(m)
        return idx > recentIdx && idx < allIdx && !m.separator
      })

      expect(recentModels.length).toBe(1)
      expect(recentModels[0].value).toBe("anthropic/claude-3-5-sonnet-20241022")
    })
  })
})
