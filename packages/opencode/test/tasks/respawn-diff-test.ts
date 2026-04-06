/**
 * Test: respawnDeveloper includes git diff in prompt
 *
 * Verifies that when respawnDeveloper generates a prompt,
 * it includes the git diff showing changes from base_commit to HEAD.
 */

import { describe, test, expect } from "bun:test"

const SCHEDULER_SRC = "src/tasks/pulse-scheduler.ts"

describe("respawnDeveloper — git diff integration", () => {
  test("includes git diff generation logic in respawnDeveloper", async () => {
    const src = await Bun.file(SCHEDULER_SRC).text()

    // Find respawnDeveloper function body
    const fnStart = src.indexOf("async function respawnDeveloper(")
    const fnEnd = src.indexOf("\nexport {", fnStart)
    const body = src.slice(fnStart, fnEnd)

    // Must validate base commit
    expect(body).toContain("validateBaseCommit(task.base_commit)")

    // Must generate git diff using diffBase (which handles fallback to "dev")
    expect(body).toContain('git diff ${diffBase}..HEAD')
    expect(body).toContain('cwd(safeWorktree)')

    // Must handle diff output
    expect(body).toContain("diffResult.stdout")
    expect(body).toContain("TextDecoder().decode(diffResult.stdout)")

    // Must create previousImplementation variable
    expect(body).toContain("previousImplementation")
  })

  test("includes previousImplementation in the prompt", async () => {
    const src = await Bun.file(SCHEDULER_SRC).text()

    // Find respawnDeveloper function body
    const fnStart = src.indexOf("async function respawnDeveloper(")
    const fnEnd = src.indexOf("\nexport {", fnStart)
    const body = src.slice(fnStart, fnEnd)

    // The prompt must include previousImplementation
    expect(body).toContain("previousImplementation}")

    // The prompt must include the warning about reading changed files
    expect(body).toContain("CRITICAL: Read the changed files above FIRST")
  })

  test("includes git diff output in previousImplementation block", async () => {
    const src = await Bun.file(SCHEDULER_SRC).text()

    const fnStart = src.indexOf("async function respawnDeveloper(")
    const fnEnd = src.indexOf("\nexport {", fnStart)
    const body = src.slice(fnStart, fnEnd)

    // Check for the diff output template
    expect(body).toContain("PREVIOUS IMPLEMENTATION (for reference)")
    expect(body).toContain("The following changes already exist in this worktree:")

    // Check for diff code block formatting - template should contain diffOutput variable
    expect(body).toContain("\\`\\`\\`diff")
    expect(body).toContain("diffOutput")
  })

  test("has proper error handling for git diff generation", async () => {
    const src = await Bun.file(SCHEDULER_SRC).text()

    const fnStart = src.indexOf("async function respawnDeveloper(")
    const fnEnd = src.indexOf("\nexport {", fnStart)
    const body = src.slice(fnStart, fnEnd)

    // Must have try/catch around git diff
    expect(body).toContain("try {")
    expect(body).toContain('await $`git diff ${diffBase}..HEAD`')
    expect(body).toContain("} catch (e) {")

    // Must log warnings on failure
    expect(body).toContain('log.warn("failed to generate git diff for respawn"')
    expect(body).toContain("taskId: task.id")
  })

  test("skips previousImplementation when diffOutput is empty", async () => {
    const src = await Bun.file(SCHEDULER_SRC).text()

    const fnStart = src.indexOf("async function respawnDeveloper(")
    const fnEnd = src.indexOf("\nexport {", fnStart)
    const body = src.slice(fnStart, fnEnd)

    // Must conditionally include previousImplementation
    expect(body).toContain("const previousImplementation = diffOutput")

    // Must provide empty string when no diff
    expect(body).toContain(': ""')
  })
})
