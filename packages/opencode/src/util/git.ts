import { $ } from "bun"
import { existsSync } from "node:fs"
import { Flag } from "../flag/flag"

export interface GitResult {
  exitCode: number
  text(): string | Promise<string>
  stdout: Buffer | ReadableStream<Uint8Array>
  stderr: Buffer | ReadableStream<Uint8Array>
}

/**
 * Run a git command.
 *
 * Uses Bun's lightweight `$` shell by default.  When the process is running
 * as an ACP client, child processes inherit the parent's stdin pipe which
 * carries protocol data – on Windows this causes git to deadlock.  In that
 * case we fall back to `Bun.spawn` with `stdin: "ignore"`.
 */
export async function git(args: string[], opts: { cwd: string; env?: Record<string, string> }): Promise<GitResult> {
  // Check if directory exists before running git
  if (!existsSync(opts.cwd)) {
    return {
      exitCode: 1,
      text: () => "",
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
    }
  }

  if (Flag.OPENCODE_CLIENT === "acp") {
    try {
      const proc = Bun.spawn(["git", ...args], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        cwd: opts.cwd,
        env: opts.env ? { ...process.env, ...opts.env } : process.env,
      })
      // Read output concurrently with exit to avoid pipe buffer deadlock
      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).arrayBuffer(),
        new Response(proc.stderr).arrayBuffer(),
      ])
      const stdoutBuf = Buffer.from(stdout)
      const stderrBuf = Buffer.from(stderr)
      return {
        exitCode,
        text: () => stdoutBuf.toString(),
        stdout: stdoutBuf,
        stderr: stderrBuf,
      }
    } catch (error) {
      const stderr = Buffer.from(error instanceof Error ? error.message : String(error))
      return {
        exitCode: 1,
        text: () => "",
        stdout: Buffer.alloc(0),
        stderr,
      }
    }
  }

  const env = opts.env ? { ...process.env, ...opts.env } : undefined
  let cmd = $`git ${args}`.quiet().nothrow()
  // Handle non-existent directories - cwd() throws before command runs
  try {
    cmd = cmd.cwd(opts.cwd)
  } catch {
    return {
      exitCode: 1,
      text: () => "",
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
    }
  }
  if (env) cmd = cmd.env(env)
  const result = await cmd
  return {
    exitCode: result.exitCode,
    text: () => result.text(),
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

/**
 * Get GitHub repository from git remote.
 * Returns 'owner/repo' for GitHub URLs, null otherwise.
 */
export async function getGithubRepo(root: string): Promise<string | null> {
  const result = await git(["remote", "get-url", "origin"], { cwd: root })
  if (result.exitCode !== 0) return null

  const url = await result.text()
  const trimmedUrl = url.trim()

  // Only parse GitHub URLs - validate actual domain to prevent spoofing
  // SSH format: git@github.com:
  // HTTPS format: https://github.com/ or http://github.com/
  if (
    !trimmedUrl.startsWith("git@github.com:") &&
    !trimmedUrl.startsWith("https://github.com/") &&
    !trimmedUrl.startsWith("http://github.com/") &&
    !trimmedUrl.startsWith("ssh://git@github.com/")
  ) {
    return null
  }

  // Parse SSH: git@github.com:owner/repo.git
  const sshMatch = trimmedUrl.match(/^git@github\.com:([^/]+)\/([^/]+?)(\.git)?$/)
  if (sshMatch) return `${sshMatch[1]}/${sshMatch[2]}`

  // Parse HTTPS: https://github.com/owner/repo.git or https://github.com/owner/repo
  const httpsMatch = trimmedUrl.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/)
  if (httpsMatch) return `${httpsMatch[1]}/${httpsMatch[2]}`

  // Parse SSH with protocol: ssh://git@github.com/owner/repo.git
  const sshProtocolMatch = trimmedUrl.match(/^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(\.git)?$/)
  if (sshProtocolMatch) return `${sshProtocolMatch[1]}/${sshProtocolMatch[2]}`

  return null
}
