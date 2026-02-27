import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import path from "path"
import { $ } from "bun"
import { defaultBranch, validateBaseCommit, hasCommittedChanges } from "../../src/tasks/pulse-utils"

describe("pulse-utils", () => {
  describe("validateBaseCommit", () => {
    it("returns null for undefined", () => {
      expect(validateBaseCommit(undefined)).toBeNull()
    })

    it("returns null for null", () => {
      expect(validateBaseCommit(null)).toBeNull()
    })

    it("validates SHA-1 hashes", () => {
      const sha1 = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b"
      expect(validateBaseCommit(sha1)).toBe(sha1)
    })

    it("validates SHA-256 hashes", () => {
      const sha256 = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2a1b2c3d4e5f6a1b2c3d4e5"
      expect(validateBaseCommit(sha256)).toBe(sha256)
    })

    it("validates simple branch names", () => {
      expect(validateBaseCommit("dev")).toBe("dev")
      expect(validateBaseCommit("main")).toBe("main")
      expect(validateBaseCommit("feature-name")).toBe("feature-name")
      expect(validateBaseCommit("feature/test")).toBe("feature/test")
    })

    it("rejects command injection attempts", () => {
      expect(validateBaseCommit("dev && rm -rf /")).toBeNull()
      expect(validateBaseCommit("dev; echo hack")).toBeNull()
      expect(validateBaseCommit("`whoami`")).toBeNull()
      expect(validateBaseCommit("$(whoami)")).toBeNull()
    })

    it("rejects names with leading hyphen (flag injection)", () => {
      expect(validateBaseCommit("-rf")).toBeNull()
    })

    it("rejects names with trailing special chars", () => {
      expect(validateBaseCommit("dev-")).toBeNull()
    })
  })

  describe("defaultBranch", () => {
    let testDir: string

    beforeEach(async () => {
      // Create a temporary git repository for testing
      testDir = `/tmp/test-repo-${Date.now()}`
      await $`mkdir -p ${testDir}`.quiet()
      await $`cd ${testDir} && git init`.quiet()
      await $`cd ${testDir} && git config user.email "test@example.com"`.quiet()
      await $`cd ${testDir} && git config user.name "Test User"`.quiet()
    })

    afterEach(async () => {
      // Cleanup test directory
      await $`rm -rf ${testDir}`.quiet().nothrow()
    })

    it("returns dev as fallback when no remote is configured", async () => {
      const branch = await defaultBranch(testDir)
      expect(branch).toBe("dev")
    })

    it("detects default branch from git symbolic-ref when available", async () => {
      // Create an origin remote
      const remoteDir = `/tmp/test-remote-${Date.now()}`
      await $`mkdir -p ${remoteDir}`.quiet()
      await $`cd ${remoteDir} && git init --bare`.quiet()

      // Add remote to test repo
      await $`cd ${testDir} && git remote add origin ${remoteDir}`.quiet()

      // Create a commit and push
      await $`cd ${testDir} && echo "test" > file.txt && git add file.txt && git commit -m "init"`.quiet()
      await $`cd ${testDir} && git branch -M main && git push -u origin main 2>/dev/null || true`.quiet().nothrow()

      // Set the symbolic ref (this simulates a real GitHub setup)
      await $`cd ${remoteDir} && git symbolic-ref HEAD refs/heads/main`.quiet()

      // The defaultBranch function should detect main
      const branch = await defaultBranch(testDir)
      expect(branch).toBe("main")

      // Cleanup remote
      await $`rm -rf ${remoteDir}`.quiet()
    })

    it("handles git errors gracefully", async () => {
      // Use a non-existent directory
      const branch = await defaultBranch("/non/existent/path")
      expect(branch).toBe("dev")
    })
  })

  describe("hasCommittedChanges", () => {
    let testDir: string

    beforeEach(async () => {
      testDir = `/tmp/test-worktree-${Date.now()}`
      await $`mkdir -p ${testDir}`.quiet()
      await $`cd ${testDir} && git init`.quiet()
      await $`cd ${testDir} && git config user.email "test@example.com"`.quiet()
      await $`cd ${testDir} && git config user.name "Test User"`.quiet()
    })

    afterEach(async () => {
      await $`rm -rf ${testDir}`.quiet().nothrow()
    })

    it("returns false when no changes exist", async () => {
      // Create initial commit
      await $`cd ${testDir} && echo "initial" > file.txt && git add file.txt && git commit -m "init"`.quiet()

      const hasChanges = await hasCommittedChanges(testDir, "HEAD")
      expect(hasChanges).toBe(false)
    })

    it("returns true when changes are committed", async () => {
      // Create initial commit on 'main' or 'master'
      await $`cd ${testDir} && echo "initial" > file.txt && git add file.txt && git commit -m "init"`.quiet()

      // Create another branch and make a commit
      await $`cd ${testDir} && git checkout -b feature 2>/dev/null || git switch -c feature`.quiet()
      await $`cd ${testDir} && echo "changed" > file.txt && git add file.txt && git commit -m "change"`.quiet()

      // Get the base commit (which should show differences)
      const baseCommit = await $`cd ${testDir} && git rev-parse HEAD~1`.quiet().text()
      const base = baseCommit.trim()

      const hasChanges = await hasCommittedChanges(testDir, base)
      expect(hasChanges).toBe(true)
    })

    it("returns false gracefully on non-existent paths", async () => {
      const hasChanges = await hasCommittedChanges("/non/existent/path", "dev")
      expect(hasChanges).toBe(false)
    })
  })
})
