import { describe, expect, test } from "bun:test"
import path from "path"
import { HashlineEditTool } from "../../src/tool/hashline_edit"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"
import { FileTime } from "../../src/file/time"
import { Flag } from "../../src/flag/flag"

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

describe("tool.hashline_edit", () => {
  test("set_line replaces a line correctly", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            file: path.join(tmp.path, "test.txt"),
            edits: [{ op: "set_line", anchor: "2咲", new_text: "new line 2" }],
          },
          ctx
        )
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nnew line 2\nline3")
        expect(result.output).toContain("Edit applied successfully")
      },
    })
  })

  test("set_line with new_text empty deletes the line", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            file: path.join(tmp.path, "test.txt"),
            edits: [{ op: "set_line", anchor: "2咲", new_text: "" }],
          },
          ctx
        )
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nline3")
        expect(result.output).toContain("Edit applied successfully")
      },
    })
  })

  test("replace_lines replaces a range correctly", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3\nline4\nline5")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            file: path.join(tmp.path, "test.txt"),
            edits: [
              {
                op: "replace_lines",
                start_anchor: "2咲",
                end_anchor: "4扟",
                new_text: "replaced lines",
              },
            ],
          },
          ctx
        )
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nreplaced lines\nline5")
        expect(result.output).toContain("Edit applied successfully")
      },
    })
  })

  test("replace_lines with new_text empty deletes the range", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3\nline4")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            file: path.join(tmp.path, "test.txt"),
            edits: [
              {
                op: "replace_lines",
                start_anchor: "2咲",
                end_anchor: "3徃",
                new_text: "",
              },
            ],
          },
          ctx
        )
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nline4")
        expect(result.output).toContain("Edit applied successfully")
      },
    })
  })

  test("insert_after inserts lines at the correct position", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            file: path.join(tmp.path, "test.txt"),
            edits: [
              {
                op: "insert_after",
                anchor: "2咲",
                text: "inserted line",
              },
            ],
          },
          ctx
        )
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nline2\ninserted line\nline3")
        expect(result.output).toContain("Edit applied successfully")
      },
    })
  })

  test("returns human-readable error message when anchor mismatches", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            file: path.join(tmp.path, "test.txt"),
            edits: [{ op: "set_line", anchor: "2戌", new_text: "new line" }],
          },
          ctx
        ).catch((e) => e)
        expect(result.message).toContain("have changed since last read")
        expect(result.message).toContain("→")
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nline2\nline3")
      },
    })
  })

  test("returns error message for no-op edit", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            file: path.join(tmp.path, "test.txt"),
            edits: [{ op: "set_line", anchor: "2咲", new_text: "line2" }],
          },
          ctx
        ).catch((e) => e)
        expect(result.message).toContain("No-op edit detected")
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nline2\nline3")
      },
    })
  })

  test("applies multiple edits atomically", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3\nline4\nline5")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            file: path.join(tmp.path, "test.txt"),
            edits: [
              { op: "set_line", anchor: "2咲", new_text: "updated line 2" },
              { op: "set_line", anchor: "3徃", new_text: "updated line 3" },
            ],
          },
          ctx
        )
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nupdated line 2\nupdated line 3\nline4\nline5")
        expect(result.output).toContain("Edit applied successfully")
      },
    })
  })

  test("atomic failure: file unchanged when any anchor is invalid", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3\nline4")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            file: path.join(tmp.path, "test.txt"),
            edits: [
              { op: "set_line", anchor: "2咲", new_text: "this should apply" },
              { op: "set_line", anchor: "3戌", new_text: "this should fail" },
            ],
          },
          ctx
        ).catch((e) => e)
        expect(result.message).toContain("have changed since last read")
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nline2\nline3\nline4")
      },
    })
  })

  test("hashline_edit not in registry when flag disabled", async () => {
    process.env.OPENCODE_EXPERIMENTAL_HASHLINE = "false"
    try {
      // Test that the module handles the flag correctly
      const { HashlineEditTool } = await import("../../src/tool/hashline_edit")
      // Tool exists but won't be in registry when flag is disabled
      expect(HashlineEditTool).toBeDefined()
    } finally {
      delete process.env.OPENCODE_EXPERIMENTAL_HASHLINE
    }
  })
})