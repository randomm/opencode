import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { getGithubRepo } from "../../src/util/git"
import { mkdirSync, rmSync, existsSync } from "node:fs"
import { $ } from "bun"

describe("getGithubRepo", () => {
  let testDir: string

  beforeEach(() => {
    testDir = `/tmp/opencode-git-test-${Date.now()}`
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  test("parses SSH URL with .git suffix", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin git@github.com:owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBe("owner/repo")
  })

  test("parses SSH URL without .git suffix", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin git@github.com:owner/repo`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBe("owner/repo")
  })

  test("parses HTTPS URL with .git suffix", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin https://github.com/owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBe("owner/repo")
  })

  test("parses HTTPS URL without .git suffix", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin https://github.com/owner/repo`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBe("owner/repo")
  })

  test("parses SSH URL with protocol", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin ssh://git@github.com/owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBe("owner/repo")
  })

  test("parses SSH URL with protocol without .git suffix", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin ssh://git@github.com/owner/repo`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBe("owner/repo")
  })

  test("returns null for GitLab URL", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin git@gitlab.com:owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBeNull()
  })

  test("returns null for GitLab HTTPS URL", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin https://gitlab.com/owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBeNull()
  })

  test("returns null for Bitbucket URL", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin git@bitbucket.org:owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBeNull()
  })

  test("returns null for Bitbucket HTTPS URL", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin https://bitbucket.org/owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBeNull()
  })

  test("returns null when no remote configured", async () => {
    await $`git init`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBeNull()
  })

  test("returns null for non-existent directory", async () => {
    const result = await getGithubRepo("/non-existent-path")
    expect(result).toBeNull()
  })

  test("handles owner and repo names with hyphens", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin git@github.com:my-org/my-repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBe("my-org/my-repo")
  })

  test("handles owner and repo names with numbers", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin https://github.com/org42/project123.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBe("org42/project123")
  })

  test("returns null for malformed URL", async () => {
    await $`git init`.cwd(testDir)
    await $`git remote add origin not-a-valid-url`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBeNull()
  })

  test("rejects github.com.evil.com domain spoofing", async () => {
    await $`git init`.cwd(testDir)
    // This is a malicious URL that contains "github.com" but is not actually GitHub
    await $`git remote add origin https://github.com.evil.com/owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBeNull()
  })

  test("rejects mygithub.com (substring in domain)", async () => {
    await $`git init`.cwd(testDir)
    // Substring in domain name - should be rejected
    await $`git remote add origin https://mygithub.com/owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBeNull()
  })

  test("rejects evil-github.com (substring with hyphen)", async () => {
    await $`git init`.cwd(testDir)
    // Substring with hyphen - should be rejected
    await $`git remote add origin https://evil-github.com/owner/repo.git`.cwd(testDir)
    const result = await getGithubRepo(testDir)
    expect(result).toBeNull()
  })
})