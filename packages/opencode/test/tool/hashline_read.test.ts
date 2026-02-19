import { describe, expect, test } from "bun:test"
import path from "path"
import { HashlineReadTool } from "../../src/tool/hashline_read"
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

describe("tool.hashline_read output format", () => {
  test("each line starts with line number + CJK char", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line one\nline two\nline three")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hashlineRead = await HashlineReadTool.init()
        const result = await hashlineRead.execute({ filePath: path.join(tmp.path, "test.txt") }, ctx)
        const contentMatch = result.output.match(/<content>([\s\S]*?)<\/content>/)
        expect(contentMatch).toBeTruthy()
        const contentBody = contentMatch![1] || ""
        const contentLines = contentBody.split("\n").filter((l) => l.length > 0 && !l.startsWith("("))
        expect(contentLines.length).toBe(3)
        for (const line of contentLines) {
          const match = line.match(/^(\d+)([\u4e00-\u9fff])/)
          expect(match).toBeTruthy()
          if (match) {
            const num = parseInt(match[1] || "0", 10)
            expect(num).toBeGreaterThan(0)
          }
        }
      },
    })
  })
})

describe("tool.hashline_read line count", () => {
  test("output has same number of lines as input file", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line one\nline two\nline three")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hashlineRead = await HashlineReadTool.init()
        const result = await hashlineRead.execute({ filePath: path.join(tmp.path, "test.txt") }, ctx)
        const contentMatch = result.output.match(/<content>([\s\S]*?)<\/content>/)
        const contentBody = contentMatch?.[1] || ""
        const contentLines = contentBody.split("\n").filter((l) => l.length > 0 && !l.startsWith("("))
        expect(contentLines.length).toBe(3)
      },
    })
  })
})

describe("tool.hashline_read byte budget", () => {
  test("MAX_BYTES not exceeded", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const lines = Array.from({ length: 1000 }, (_, i) => `line ${i} with some content`).join("\n")
        await Bun.write(path.join(dir, "large.txt"), lines)
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hashlineRead = await HashlineReadTool.init()
        const result = await hashlineRead.execute({ filePath: path.join(tmp.path, "large.txt") }, ctx)
        const bytes = Buffer.byteLength(result.output, "utf8")
        expect(bytes).toBeLessThanOrEqual(50 * 1024 + 500)
      },
    })
  })
})

describe("tool.hashline_read binary file detection", () => {
  test("binary files return error message", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const binary = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd, 0xfc])
        await Bun.write(path.join(dir, "test.bin"), binary)
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hashlineRead = await HashlineReadTool.init()
        const error = await hashlineRead
          .execute({ filePath: path.join(tmp.path, "test.bin") }, ctx)
          .catch((e) => e)
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain("Cannot read binary file")
      },
    })
  })
})

describe("tool.hashline_read non-existent file", () => {
  test("returns error for non-existent file", async () => {
    await using tmp = await tmpdir({})
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hashlineRead = await HashlineReadTool.init()
        const error = await hashlineRead
          .execute({ filePath: path.join(tmp.path, "nonexistent.txt") }, ctx)
          .catch((e) => e)
        expect(error).toBeInstanceOf(Error)
        expect(error.message).toContain("File not found")
      },
    })
  })
})

describe("tool.hashline_read offset parameter", () => {
  test("skips first N lines", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line 1\nline 2\nline 3\nline 4\nline 5")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hashlineRead = await HashlineReadTool.init()
        const result = await hashlineRead.execute({ filePath: path.join(tmp.path, "test.txt"), offset: 3 }, ctx)
        const contentMatch = result.output.match(/<content>([\s\S]*?)<\/content>/)
        const contentBody = contentMatch?.[1] || ""
        const contentLines = contentBody.split("\n").filter((l) => l.length > 0 && !l.startsWith("("))
        expect(contentLines.length).toBe(3)
        const firstLine = contentLines[0]
        expect(firstLine).toMatch(/^3[\u4e00-\u9fff]/)
      },
    })
  })
})

describe("tool.hashline_read limit parameter", () => {
  test("returns only N lines", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line 1\nline 2\nline 3\nline 4\nline 5")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hashlineRead = await HashlineReadTool.init()
        const result = await hashlineRead.execute({ filePath: path.join(tmp.path, "test.txt"), limit: 2 }, ctx)
        const contentMatch = result.output.match(/<content>([\s\S]*?)<\/content>/)
        const contentBody = contentMatch?.[1] || ""
        const contentLines = contentBody.split("\n").filter((l) => l.length > 0 && !l.startsWith("("))
        expect(contentLines.length).toBe(2)
        expect(result.metadata.truncated).toBe(true)
      },
    })
  })
})

describe("tool.hashline_read CJK char stability", () => {
  test("same file content produces same CJK chars on re-read", async () => {
    const content = "const foo = 1\nconst bar = 2\nconst baz = 3"
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), content)
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hashlineRead1 = await HashlineReadTool.init()
        const result1 = await hashlineRead1.execute({ filePath: path.join(tmp.path, "test.txt") }, ctx)
        const hashlineRead2 = await HashlineReadTool.init()
        const result2 = await hashlineRead2.execute({ filePath: path.join(tmp.path, "test.txt") }, ctx)
        expect(result1.output).toBe(result2.output)
      },
    })
  })
})

describe("tool.hashline_read flag disabled", () => {
  test("hashline_read not in registry when flag is off", async () => {
    const originalFlag = process.env.OPENCODE_EXPERIMENTAL_HASHLINE
    process.env.OPENCODE_EXPERIMENTAL_HASHLINE = "false"
    try {
      await using tmp = await tmpdir({})
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const { ToolRegistry } = await import("../../src/tool/registry")
          const toolIDs = await ToolRegistry.ids()
          expect(toolIDs).not.toContain("hashline_read")
        },
      })
    } finally {
      if (originalFlag !== undefined) {
        process.env.OPENCODE_EXPERIMENTAL_HASHLINE = originalFlag
      } else {
        delete process.env.OPENCODE_EXPERIMENTAL_HASHLINE
      }
    }
  })
})

describe("tool.hashline_read flag enabled", () => {
  test("hashline_read IS in registry when flag is on", async () => {
    const originalFlag = process.env.OPENCODE_EXPERIMENTAL_HASHLINE
    process.env.OPENCODE_EXPERIMENTAL_HASHLINE = "true"
    try {
      await using tmp = await tmpdir({})
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const { ToolRegistry } = await import("../../src/tool/registry")
          const toolIDs = await ToolRegistry.ids()
          expect(toolIDs).toContain("hashline_read")
        },
      })
    } finally {
      if (originalFlag !== undefined) {
        process.env.OPENCODE_EXPERIMENTAL_HASHLINE = originalFlag
      } else {
        delete process.env.OPENCODE_EXPERIMENTAL_HASHLINE
      }
    }
  })
})

describe("tool.hashline_read CJK byte counting", () => {
  test("byte budget uses 3 bytes per CJK char", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const line = "x".repeat(150)
        const lines = Array.from({ length: 100 }, () => line).join("\n")
        await Bun.write(path.join(dir, "test.txt"), lines)
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hashlineRead = await HashlineReadTool.init()
        const result = await hashlineRead.execute({ filePath: path.join(tmp.path, "test.txt") }, ctx)
        const contentMatch = result.output.match(/<content>([\s\S]*?)<\/content>/)
        const contentBody = contentMatch?.[1] || ""
        const contentLines = contentBody.split("\n").filter((l) => l.length > 0)
        let totalBytes = 0
        for (const line of contentLines) {
          const lineBytes = Buffer.byteLength(line, "utf8")
          totalBytes += lineBytes + 1
        }
        expect(totalBytes).toBeLessThanOrEqual(50 * 1024)
      },
    })
  })
})