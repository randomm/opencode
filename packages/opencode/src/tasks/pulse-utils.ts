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

/**
 * Detect the default branch of a git repository dynamically
 * Tries symbolic-ref first (fastest), falls back to remote show, then defaults to 'dev'
 */
export async function defaultBranch(cwd: string): Promise<string> {
  try {
    // Try symbolic-ref first (fastest, works when origin/HEAD is set)
    const ref = await $`git symbolic-ref refs/remotes/origin/HEAD --short`.quiet().nothrow().cwd(cwd)
    if (ref.exitCode === 0) {
      const name = new TextDecoder().decode(ref.stdout).trim().replace(/^origin\//, "")
      if (name) {
        log.debug("detected default branch via symbolic-ref", { branch: name })
        return name
      }
    }
  } catch (e) {
    log.debug("symbolic-ref attempt failed", { error: String(e) })
  }

  try {
    // Fallback: parse remote show output
    const show = await $`git remote show origin`.quiet().nothrow().cwd(cwd)
    if (show.exitCode === 0) {
      const output = new TextDecoder().decode(show.stdout)
      const match = output.match(/HEAD branch:\s*(.+)/)
      if (match?.[1]) {
        const branch = match[1].trim()
        if (branch) {
          log.debug("detected default branch via remote show", { branch })
          return branch
        }
      }
    }
  } catch (e) {
    log.debug("remote show attempt failed", { error: String(e) })
  }

  // Last resort default
  log.warn("could not detect default branch, using fallback", { fallback: "dev" })
  return "dev"
}