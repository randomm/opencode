import z from "zod"
import { Tool } from "./tool"
import { Ripgrep } from "../file/ripgrep"
import { Instance } from "../project/instance"
import path from "path"
import { assertExternalDirectory } from "./external-directory"

const MAX_LINE_LENGTH = 2000

export const RgTool = Tool.define("rg", {
  description: `Search file contents or list files using ripgrep.

Two modes:
1. Content search (default): Search for pattern in file contents
   Example: rg({ pattern: "function.*export", include: "*.ts" })

2. File listing: List files matching a glob pattern
   Example: rg({ pattern: "*.ts", files_only: true })

Parameters:
- pattern: Regex pattern for content search, or glob pattern for file listing
- path: Directory to search (default: project root)
- include: File glob filter (e.g. "*.ts", "*.{js,jsx}")
- files_only: If true, list matching files instead of searching content`,

  parameters: z.object({
    pattern: z.string().describe("Regex pattern for content search, or glob pattern when files_only=true"),
    path: z.string().optional().describe("Directory to search. Defaults to project root."),
    include: z.string().optional().describe('File pattern filter (e.g. "*.ts", "*.{js,tsx}")'),
    files_only: z.boolean().optional().describe("If true, list files matching pattern instead of searching content"),
  }),

  async execute(params, ctx) {
    if (!params.files_only && !params.pattern) {
      throw new Error("pattern is required when files_only is false")
    }

    if (params.files_only && !params.pattern && !params.include) {
      throw new Error("files_only mode requires either 'pattern' or 'include' to specify which files to list")
    }

    await ctx.ask({
      permission: params.files_only ? "glob" : "grep",
      patterns: params.pattern ? [params.pattern] : [],
      always: ["*"],
      metadata: {
        pattern: params.pattern,
        path: params.path,
        include: params.include,
        files_only: params.files_only,
      },
    })

    let searchPath = params.path ?? Instance.directory
    searchPath = path.isAbsolute(searchPath) ? searchPath : path.resolve(Instance.directory, searchPath)
    await assertExternalDirectory(ctx, searchPath, { kind: "directory" })

    const rgPath = await Ripgrep.filepath()
    const args: string[] = []

    if (params.files_only) {
      args.push("--files", "--hidden", "--follow")
      const globPattern = params.include || params.pattern
      if (globPattern) {
        args.push("--glob", globPattern)
      }
      args.push(searchPath)
    } else {
      args.push(
        "-nH",
        "--hidden",
        "--follow",
        "--no-messages",
        "--field-match-separator=|",
        "--regexp",
        params.pattern!,
      )
      if (params.include) {
        args.push("--glob", params.include)
      }
      args.push(searchPath)
    }

    const proc = Bun.spawn([rgPath, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })

    const output = await new Response(proc.stdout).text()
    const errorOutput = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    const title = params.pattern ?? params.include ?? "Files matching pattern"

    if (exitCode !== 0 && exitCode !== 1 && exitCode !== 2) {
      const errorMsg = errorOutput.toLowerCase().includes("regex")
        ? `Invalid regex pattern: ${errorOutput}`
        : `ripgrep failed: ${errorOutput}`
      throw new Error(errorMsg)
    }

    const hasErrors = exitCode === 2
    const noMatches = exitCode === 1 || (exitCode === 2 && !output.trim())

    if (noMatches) {
      return {
        title,
        metadata: { matches: 0, truncated: false },
        output: "No files found",
      }
    }

    if (params.files_only) {
      const lines = output.trim().split(/\r?\n/)
      const matches = []

      for (const line of lines) {
        if (!line) continue
        matches.push(line)
      }

      const limit = 100
      const truncated = matches.length > limit
      const finalMatches = truncated ? matches.slice(0, limit) : matches

      const outputLines = [`Found ${finalMatches.length} files`]
      outputLines.push(...finalMatches)

      if (truncated) {
        outputLines.push("")
        outputLines.push("(Results are truncated. Consider using a more specific path or pattern.)")
      }

      if (hasErrors) {
        outputLines.push("")
        outputLines.push("(Some paths were inaccessible and skipped)")
      }

      return {
        title,
        metadata: {
          matches: finalMatches.length,
          truncated,
        },
        output: outputLines.join("\n"),
      }
    }

    const lines = output.trim().split(/\r?\n/)
    const matches = []

    for (const line of lines) {
      if (!line) continue

      const [filePath, lineNumStr, ...lineTextParts] = line.split("|")
      if (!filePath || !lineNumStr || lineTextParts.length === 0) continue

      const lineNum = parseInt(lineNumStr, 10)
      const lineText = lineTextParts.join("|")

      const file = Bun.file(filePath)
      const stats = await file.stat().catch(() => null)
      if (!stats) continue

      matches.push({
        path: filePath,
        modTime: stats.mtime.getTime(),
        lineNum,
        lineText,
      })
    }

    matches.sort((a, b) => b.modTime - a.modTime)

    const limit = 100
    const truncated = matches.length > limit
    const finalMatches = truncated ? matches.slice(0, limit) : matches

    if (finalMatches.length === 0) {
      return {
        title,
        metadata: { matches: 0, truncated: false },
        output: "No files found",
      }
    }

    const outputLines = [`Found ${finalMatches.length} matches`]

    let currentFile = ""
    for (const match of finalMatches) {
      if (currentFile !== match.path) {
        if (currentFile !== "") {
          outputLines.push("")
        }
        currentFile = match.path
        outputLines.push(`${match.path}:`)
      }
      const truncatedLineText =
        match.lineText.length > MAX_LINE_LENGTH ? match.lineText.substring(0, MAX_LINE_LENGTH) + "..." : match.lineText
      outputLines.push(`  Line ${match.lineNum}: ${truncatedLineText}`)
    }

    if (truncated) {
      outputLines.push("")
      outputLines.push("(Results are truncated. Consider using a more specific path or pattern.)")
    }

    if (hasErrors) {
      outputLines.push("")
      outputLines.push("(Some paths were inaccessible and skipped)")
    }

    return {
      title,
      metadata: {
        matches: finalMatches.length,
        truncated,
      },
      output: outputLines.join("\n"),
    }
  },
})
