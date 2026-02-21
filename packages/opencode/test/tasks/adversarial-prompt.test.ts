import { describe, test, expect } from "bun:test"

describe("adversarial prompt generation with base_commit", () => {
  test("prompt includes base_commit hash when available", () => {
    const task = {
      id: "task-123",
      title: "Test feature",
      description: "Add feature",
      acceptance_criteria: "Should work",
      base_commit: "abc123def456",
    }

    const safeWorktree = "/tmp/worktree"
    const baseCommitStr = task.base_commit ? `Base Commit: ${task.base_commit}` : "Base Commit: Not captured"
    const prompt = `Review the implementation in worktree at: ${safeWorktree}

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Acceptance Criteria: ${task.acceptance_criteria}
${baseCommitStr}

When reviewing changes, use git diff to see ONLY the developer's changes:
\`\`\`bash
cd ${safeWorktree}
git diff ${task.base_commit || "dev"}..HEAD
\`\`\`

This ensures you only review changes made by the developer, not commits that were already in dev.

Read the changed files in the worktree, run typecheck, and record your verdict with taskctl verdict.`

    expect(prompt).toContain(`Base Commit: ${task.base_commit}`)
    expect(prompt).toContain(`git diff ${task.base_commit}..HEAD`)
  })

  test("prompt handles missing base_commit gracefully", () => {
    const task = {
      id: "task-456",
      title: "Test feature",
      description: "Add feature",
      acceptance_criteria: "Should work",
      base_commit: null,
    }

    const safeWorktree = "/tmp/worktree"
    const baseCommitStr = task.base_commit ? `Base Commit: ${task.base_commit}` : "Base Commit: Not captured"
    const prompt = `Review the implementation in worktree at: ${safeWorktree}

Task ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Acceptance Criteria: ${task.acceptance_criteria}
${baseCommitStr}

When reviewing changes, use git diff to see ONLY the developer's changes:
\`\`\`bash
cd ${safeWorktree}
git diff ${task.base_commit || "dev"}..HEAD
\`\`\`

This ensures you only review changes made by the developer, not commits that were already in dev.

Read the changed files in the worktree, run typecheck, and record your verdict with taskctl verdict.`

    expect(prompt).toContain("Base Commit: Not captured")
    expect(prompt).toContain("git diff dev..HEAD")
  })

  test("adversarial agent prompt includes base_commit guidance", () => {
    const agentPrompt = `## Reviewing ONLY developer changes (base_commit)
The prompt includes a base_commit hash. Use it to see ONLY the developer's changes:
\`\`\`bash
cd <worktree>
git diff <base_commit>..HEAD
\`\`\`
This diff shows ONLY what the developer added, not commits already in dev. Flag ONLY changes that appear in this diff as out-of-scope.`

    expect(agentPrompt).toContain("base_commit")
    expect(agentPrompt).toContain("git diff <base_commit>..HEAD")
    expect(agentPrompt).toContain("ONLY the developer's changes")
  })
})
