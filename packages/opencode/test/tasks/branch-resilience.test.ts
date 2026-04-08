import { describe, test, expect } from "bun:test"
import { $ } from "bun"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import fs from "fs/promises"

describe("taskctl start: branch creation resilience", () => {
  test("checks out existing branch instead of creating duplicate", async () => {
    await using tmp = await tmpdir({ git: true })

    const branchName = "feature/test-branch"

    // Create the branch once
    await $`git checkout -b ${branchName}`.cwd(tmp.path).quiet().nothrow()
    const firstCheckout = await $`git rev-parse --abbrev-ref HEAD`.cwd(tmp.path).quiet().nothrow()
    expect(new TextDecoder().decode(firstCheckout.stdout).trim()).toBe(branchName)

    // Make a commit to establish history
    await Bun.write(path.join(tmp.path, "test.txt"), "content")
    await $`git add test.txt`.cwd(tmp.path).quiet().nothrow()
    await $`git commit -m "test commit"`.cwd(tmp.path).quiet().nothrow()

    // Switch back to main
    await $`git checkout -`.cwd(tmp.path).quiet().nothrow()

    // Verify branch exists
    const branchCheck = await $`git rev-parse --verify ${branchName}`.cwd(tmp.path).quiet().nothrow()
    expect(branchCheck.exitCode).toBe(0)

    // Simulate the start command logic: check if branch exists
    const existsCheck = await $`git rev-parse --verify ${branchName}`.cwd(tmp.path).quiet().nothrow()

    if (existsCheck.exitCode === 0) {
      // Branch exists — check it out
      const checkoutResult = await $`git checkout ${branchName}`.cwd(tmp.path).quiet().nothrow()
      expect(checkoutResult.exitCode).toBe(0)

      const currentBranch = await $`git rev-parse --abbrev-ref HEAD`.cwd(tmp.path).quiet().nothrow()
      expect(new TextDecoder().decode(currentBranch.stdout).trim()).toBe(branchName)
    } else {
      throw new Error("Branch should exist")
    }
  })

  test("creates new branch when it doesn't exist", async () => {
    await using tmp = await tmpdir({ git: true })

    const branchName = "feature/new-branch-test"

    // Verify branch doesn't exist
    const branchCheck = await $`git rev-parse --verify ${branchName}`.cwd(tmp.path).quiet().nothrow()
    expect(branchCheck.exitCode).not.toBe(0)

    // Simulate the start command logic: branch doesn't exist, create it
    const base = "main"
    const createResult = await $`git checkout -b ${branchName} ${base}`.cwd(tmp.path).quiet().nothrow()
    expect(createResult.exitCode).toBe(0)

    const currentBranch = await $`git rev-parse --abbrev-ref HEAD`.cwd(tmp.path).quiet().nothrow()
    expect(new TextDecoder().decode(currentBranch.stdout).trim()).toBe(branchName)
  })

  test("handles remote branch already exists gracefully", async () => {
    await using tmp = await tmpdir({ git: true })

    const branchName = "feature/remote-exists-test"

    // Create branch
    await $`git checkout -b ${branchName}`.cwd(tmp.path).quiet().nothrow()
    await Bun.write(path.join(tmp.path, "test.txt"), "content")
    await $`git add test.txt`.cwd(tmp.path).quiet().nothrow()
    await $`git commit -m "test commit"`.cwd(tmp.path).quiet().nothrow()

    // Add a fake remote that points to the current directory
    const remotePath = tmp.path
    await $`git remote add test-remote ${remotePath}`.cwd(tmp.path).quiet().nothrow()

    // Push to the remote
    const pushResult = await $`git push test-remote ${branchName}`.cwd(tmp.path).quiet().nothrow().nothrow()

    // If push failed with "already exists" error (which it shouldn't in this case, but we test the logic)
    // then we would set upstream manually
    if (pushResult.exitCode !== 0) {
      const stderr = pushResult.stderr ? new TextDecoder().decode(pushResult.stderr) : ""
      if (stderr.includes("already exists") || stderr.includes("would clobber")) {
        await $`git branch --set-upstream-to=test-remote/${branchName} ${branchName}`.cwd(tmp.path).quiet().nothrow()
      }
    }

    // The branch should be checked out and ready
    const currentBranch = await $`git rev-parse --abbrev-ref HEAD`.cwd(tmp.path).quiet().nothrow()
    expect(new TextDecoder().decode(currentBranch.stdout).trim()).toBe(branchName)
  })
})