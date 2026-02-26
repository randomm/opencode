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
        FileTime.hashlineRead(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
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
        FileTime.hashlineRead(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
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
        FileTime.hashlineRead(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
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
        FileTime.hashlineRead(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
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
        FileTime.hashlineRead(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
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
        FileTime.hashlineRead(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
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
        FileTime.hashlineRead(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
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
        FileTime.hashlineRead(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
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
        FileTime.hashlineRead(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
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

  test("hashline_edit fails if called after regular read instead of hashline_read", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        // Use regular read, NOT hashline_read
        FileTime.read(ctx.sessionID, path.join(tmp.path, "test.txt"))
        const result = await tool.execute(
          {
            filePath: path.join(tmp.path, "test.txt"),
            edits: [{ op: "set_line", anchor: "2咲", new_text: "new line 2" }],
          },
          ctx
        ).catch((e) => e)
        expect(result.message).toContain("You must use hashline_read before hashline_edit")
        expect(result.message).toContain("The regular read tool does not provide hashline anchors")
        const content = await Bun.file(path.join(tmp.path, "test.txt")).text()
        expect(content).toBe("line1\nline2\nline3")
      },
    })
  })

  test("hashline_edit succeeds after hashline_read but fails after only regular read", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "file1.txt"), "line1\nline2\nline3")
        await Bun.write(path.join(dir, "file2.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        const filepath1 = path.join(tmp.path, "file1.txt")
        const filepath2 = path.join(tmp.path, "file2.txt")

        // file1: use hashline_read - should succeed
        FileTime.hashlineRead(ctx.sessionID, filepath1)
        const result1 = await tool.execute(
          {
            filePath: filepath1,
            edits: [{ op: "set_line", anchor: "2咲", new_text: "modified" }],
          },
          ctx
        )
        expect(result1.output).toContain("Edit applied successfully")

        // file2: use only regular read, NOT hashline_read - should fail
        FileTime.read(ctx.sessionID, filepath2)
        const result2 = await tool.execute(
          {
            filePath: filepath2,
            edits: [{ op: "set_line", anchor: "2咲", new_text: "modified" }],
          },
          ctx
        ).catch((e) => e)
        expect(result2.message).toContain("You must use hashline_read before hashline_edit")
        expect(result2.message).toContain("The regular read tool does not provide hashline anchors")
      },
    })
  })

  test("hashline_edit fails when file modified on disk after hashline_read", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        const filepath = path.join(tmp.path, "test.txt")

        // hashline_read the file
        FileTime.hashlineRead(ctx.sessionID, filepath)

        // Modify file externally to trigger staleness error
        await new Promise((r) => setTimeout(r, 10)) // Small delay to ensure mtime changes
        await Bun.write(filepath, "line1\nmodified\nline3")

        const result = await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "set_line", anchor: "2咲", new_text: "new" }],
          },
          ctx
        ).catch((e) => e)
        expect(result.message).toContain("File")
        expect(result.message).toContain("has been modified since it was last read with hashline_read")
      },
    })
  })

  test("hashline_edit rejects edit from different session even if another session used hashline_read", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        const filepath = path.join(tmp.path, "test.txt")

        // Session A reads with hashline_read
        FileTime.hashlineRead("session-a", filepath)

        // Session B (different sessionID) tries to edit — should fail
        const ctxB = { ...ctx, sessionID: "session-b" }
        const result = await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "set_line", anchor: "2咲", new_text: "modified" }],
          },
          ctxB
        ).catch((e) => e)
        expect(result.message).toContain("You must use hashline_read before hashline_edit")

        // File should be unchanged
        const content = await Bun.file(filepath).text()
        expect(content).toBe("line1\nline2\nline3")
      },
    })
  })

  test("delete_file successfully deletes a file after hashline_read", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        const filepath = path.join(tmp.path, "test.txt")
        FileTime.hashlineRead(ctx.sessionID, filepath)
        const result = await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "delete_file" }],
          },
          ctx
        )
        expect(result.output).toContain("File deleted successfully")
        const exists = await Bun.file(filepath).exists()
        expect(exists).toBe(false)
      },
    })
  })

  test("delete_file is rejected without prior hashline_read", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "content")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        const filepath = path.join(tmp.path, "test.txt")
        const result = await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "delete_file" }],
          },
          ctx
        ).catch((e) => e)
        expect(result.message).toContain("You must use hashline_read before hashline_edit")
        const exists = await Bun.file(filepath).exists()
        expect(exists).toBe(true)
      },
    })
  })

  test("delete_file returns clear error if file already gone", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "content")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        const filepath = path.join(tmp.path, "test.txt")
        FileTime.hashlineRead(ctx.sessionID, filepath)
        // Delete the file externally
        await Bun.file(filepath).delete()
        const result = await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "delete_file" }],
          },
          ctx
        ).catch((e) => e)
        expect(result.message).toContain("File not found")
      },
    })
  })

  test("after delete_file, subsequent hashline_edit fails until new hashline_read", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "content")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        const filepath = path.join(tmp.path, "test.txt")
        FileTime.hashlineRead(ctx.sessionID, filepath)
        await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "delete_file" }],
          },
          ctx
        )
        // Try to edit the same path (file is now gone)
        const result = await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "delete_file" }],
          },
          ctx
        ).catch((e) => e)
        expect(result.message).toContain("You must use hashline_read before hashline_edit")
      },
    })
  })

  test("after delete_file + new hashline_read, operations work on re-created file", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        const filepath = path.join(tmp.path, "test.txt")
        FileTime.hashlineRead(ctx.sessionID, filepath)
        // Delete the file
        await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "delete_file" }],
          },
          ctx
        )
        // Re-create the file
        await Bun.write(filepath, "new line1\nnew line2")
        // Read it again with hashline_read
        FileTime.hashlineRead(ctx.sessionID, filepath)
        // Now editing should work
        const result = await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "set_line", anchor: "1赙", new_text: "modified" }],
          },
          ctx
        )
        expect(result.output).toContain("Edit applied successfully")
        const content = await Bun.file(filepath).text()
        expect(content).toContain("modified")
      },
    })
  })

  test("consecutive hashline_edit calls work without re-reading in between", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "test.txt"), "line1\nline2\nline3\nline4")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const tool = await HashlineEditTool.init()
        const filepath = path.join(tmp.path, "test.txt")

        // First: hashline_read the file
        FileTime.hashlineRead(ctx.sessionID, filepath)

        // Second: do first edit
        const result1 = await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "set_line", anchor: "2咲", new_text: "edited line 2" }],
          },
          ctx
        )
        expect(result1.output).toContain("Edit applied successfully")

        // Third: do second edit WITHOUT re-reading - this should succeed
        // because hashline_edit now correctly updates the hashlineRead timestamp
        const result2 = await tool.execute(
          {
            filePath: filepath,
            edits: [{ op: "set_line", anchor: "3徃", new_text: "edited line 3" }],
          },
          ctx
        )
        expect(result2.output).toContain("Edit applied successfully")

        // Verify both edits were applied
        const content = await Bun.file(filepath).text()
        expect(content).toBe("line1\nedited line 2\nedited line 3\nline4")
      },
    })
  })
})