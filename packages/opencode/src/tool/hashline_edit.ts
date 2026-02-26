import z from "zod"
import * as path from "path"
import { Tool } from "./tool"
import { FileTime } from "../file/time"
import DESCRIPTION from "./hashline_edit.txt"
import { Instance } from "../project/instance"
import { assertExternalDirectory } from "./external-directory"
import { applyHashlineEdits, type HashlineEdit, parseAnchor } from "./hashline"

const editSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_line"),
    anchor: z.string().describe('Line anchor e.g. "14丐"'),
    new_text: z.string().describe("Replacement text, or empty string to delete the line"),
  }),
  z.object({
    op: z.literal("replace_lines"),
    start_anchor: z.string().describe('Start anchor e.g. "10乙"'),
    end_anchor: z.string().describe('End anchor e.g. "14丐"'),
    new_text: z.string().describe("Replacement lines, or empty string to delete the range"),
  }),
  z.object({
    op: z.literal("insert_after"),
    anchor: z.string().describe('Line anchor e.g. "14丐"'),
    text: z.string().describe("Text to insert after the anchor line"),
  }),
  z.object({
    op: z.literal("insert_before"),
    anchor: z.string().describe('Line anchor e.g. "14丐"'),
    text: z.string().describe("Text to insert before the anchor line"),
  }),
  z.object({
    op: z.literal("delete_file"),
  }),
])

type EditSchema = z.infer<typeof editSchema>

function parseEdit(edit: EditSchema): HashlineEdit {
  if (edit.op === "set_line") {
    return { op: edit.op, anchor: parseAnchor(edit.anchor), new_text: edit.new_text }
  }
  if (edit.op === "replace_lines") {
    return {
      op: edit.op,
      start_anchor: parseAnchor(edit.start_anchor),
      end_anchor: parseAnchor(edit.end_anchor),
      new_text: edit.new_text,
    }
  }
  if (edit.op === "insert_after") {
    return { op: edit.op, anchor: parseAnchor(edit.anchor), text: edit.text }
  }
  if (edit.op === "insert_before") {
    return { op: edit.op, anchor: parseAnchor(edit.anchor), text: edit.text }
  }
  throw new Error(`Unknown edit operation: ${edit.op}`)
}

export const HashlineEditTool = Tool.define("hashline_edit", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("Absolute path to the file to edit"),
    edits: z.array(editSchema).min(1).describe("List of edits to apply atomically"),
  }),
  async execute(params, ctx) {
    const filepath = path.isAbsolute(params.filePath) ? params.filePath : path.join(Instance.directory, params.filePath)

    await assertExternalDirectory(ctx, filepath)

    await ctx.ask({
      permission: "edit",
      patterns: [path.relative(Instance.worktree, filepath)],
      always: ["*"],
      metadata: {
        filepath,
      },
    })

    const isDeleteFile = params.edits.length === 1 && params.edits[0].op === "delete_file"

    if (isDeleteFile) {
      await FileTime.withLock(filepath, async () => {
        try {
          await FileTime.assertHashlineRead(ctx.sessionID, filepath)
        } catch (error) {
          // If file doesn't exist, that's an ENOENT error from stat()
          // Wrap it in a clean message
          if (error instanceof Error && error.message.includes("no such file")) {
            throw new Error(`File not found: ${filepath}`)
          }
          throw error
        }
        const file = Bun.file(filepath)
        const exists = await file.exists().catch(() => false)
        if (!exists) throw new Error(`File not found: ${filepath}`)
        await file.delete().catch((error) => {
          throw new Error(`File not found: ${filepath}`)
        })
        // Clear FileTime state for this file
        const { hashlineRead } = FileTime.state()
        hashlineRead[ctx.sessionID] = hashlineRead[ctx.sessionID] || {}
        delete hashlineRead[ctx.sessionID][filepath]
      })

      return {
        title: path.relative(Instance.worktree, filepath),
        output: `File deleted successfully: ${params.filePath}`,
        metadata: {},
      }
    }

    const parsedEdits = params.edits.map(parseEdit)

    await FileTime.withLock(filepath, async () => {
      const file = Bun.file(filepath)
      const stats = await file.stat().catch(() => {})
      if (!stats) throw new Error(`File not found: ${filepath}`)
      if (stats.isDirectory()) throw new Error(`Path is a directory: ${filepath}`)
      await FileTime.assertHashlineRead(ctx.sessionID, filepath)

      const contentOld = await file.text()
      const contentNew = applyHashlineEdits(contentOld, parsedEdits)
      await Bun.write(filepath, contentNew)
      FileTime.hashlineRead(ctx.sessionID, filepath)
    })

    return {
      title: path.relative(Instance.worktree, filepath),
      output: `Edit applied successfully to ${params.filePath}`,
      metadata: {},
    }
  },
})
