import { $ } from "bun"
import { Log } from "../util/log"

const log = Log.create({ service: "taskctl.pulse.utils" })

/**
 * Validate a git commit/branch name is safe to use in shell commands and prompts
 * Prevents command injection and code execution
 */
export function validateBaseCommit(baseCommit: string | null | undefined): string | null {
  if (baseCommit === null || baseCommit === undefined) {
    return null
  }

  // Allow only: SHA-1 hashes (40 hex chars), SHA-256 hashes (64 hex chars), or simple branch/tag names
  // Pattern restricts to: alphanumeric, hyphen, underscore, slash, or dot
  // Prevents: command substitution, shell metacharacters, flag injection (no leading hyphen)
  if (!/^[a-fA-F0-9]{40}$/.test(baseCommit) &&
      !/^[a-fA-F0-9]{64}$/.test(baseCommit) &&
      !/^[a-zA-Z0-9](?:[-a-zA-Z0-9_./]*[a-zA-Z0-9])?$/.test(baseCommit)) {
    return null
  }

  return baseCommit
}

/**
 * Check if there are committed changes in the worktree (for adversarial review validation)
 * This is extracted into a separate file for easier test mocking
 */
export async function hasCommittedChanges(worktreePath: string, baseCommit: string | null): Promise<boolean> {
  try {
    const validated = validateBaseCommit(baseCommit) ?? "dev"
    
    const diffCheck = await $`git diff ${validated}..HEAD --stat`.quiet().nothrow().cwd(worktreePath)
    const diffOutput = new TextDecoder().decode(diffCheck.stdout).trim()
    return diffOutput.length > 0
  } catch (e) {
    log.warn("failed to check for committed changes", { worktreePath, baseCommit, error: String(e) })
    return false
  }
}