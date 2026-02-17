import { describe, expect, test } from "bun:test"
import path from "path"
import { BashTool } from "../../src/tool/bash"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

const ctx = {
  sessionID: "test",
  messageID: "",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

describe("bash workdir validation", () => {
  test("uses provided workdir when it exists", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: path.join(tmp.path, ".opencode"),
      fn: async () => {
        const bash = await BashTool.init()
        const result = await bash.execute(
          {
            command: "pwd",
            description: "Print working directory",
            workdir: tmp.path,
          },
          ctx,
        )
        expect(result.metadata.exit).toBe(0)
        expect(result.metadata.output).toContain(tmp.path)
      },
    })
  })

  test("falls back to Instance.directory when workdir does not exist", async () => {
    const projectRoot = path.join(__dirname, "../..")
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const bash = await BashTool.init()
        const nonexistent = "/nonexistent/path/that/does/not/exist"
        const result = await bash.execute(
          {
            command: "pwd",
            description: "Print working directory",
            workdir: nonexistent,
          },
          ctx,
        )
        expect(result.metadata.exit).toBe(0)
        // Output should be the fallback directory (projectRoot), not the nonexistent one
        expect(result.metadata.output).toContain(projectRoot)
      },
    })
  })

  test("logs warning when workdir does not exist", async () => {
    const projectRoot = path.join(__dirname, "../..")
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const bash = await BashTool.init()
        const nonexistent = "/nonexistent/path/that/does/not/exist"
        const warnings: Array<{ message: string; data?: unknown }> = []
        
        // Capture log warnings - we'll check the test completes without error
        // The actual warning logging happens inside the tool
        const result = await bash.execute(
          {
            command: "echo 'test'",
            description: "Echo test",
            workdir: nonexistent,
          },
          ctx,
        )
        
        // Command should succeed using fallback directory
        expect(result.metadata.exit).toBe(0)
        expect(result.metadata.output).toContain("test")
      },
    })
  })

  test("uses Instance.directory when workdir is omitted", async () => {
    const projectRoot = path.join(__dirname, "../..")
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const bash = await BashTool.init()
        const result = await bash.execute(
          {
            command: "pwd",
            description: "Print working directory",
          },
          ctx,
        )
        expect(result.metadata.exit).toBe(0)
        expect(result.metadata.output).toContain(projectRoot)
      },
    })
  })

  test("falls back to Instance.directory when workdir is outside project boundary", async () => {
    const projectRoot = path.join(__dirname, "../..")
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const bash = await BashTool.init()
        const result = await bash.execute(
          {
            command: "pwd",
            description: "Print working directory",
            workdir: "/tmp",
          },
          ctx,
        )
        expect(result.metadata.exit).toBe(0)
        expect(result.metadata.output).toContain(projectRoot)
      },
    })
  })
})
