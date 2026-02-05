#!/usr/bin/env bun
import path from "path"
import fs from "fs"
import { $ } from "bun"

const ROOT = path.resolve(import.meta.dirname, "..")
const DIST = path.join(ROOT, "dist", "oclite-darwin-arm64")
const BIN = path.join(DIST, "bin")
const HOME_BIN = path.join(process.env.HOME!, "bin")

async function build() {
  console.log("Building oclite...")

  // Clean
  await fs.promises.rm(DIST, { recursive: true, force: true })
  await fs.promises.mkdir(BIN, { recursive: true })

  // Build with NODE_ENV=production to avoid devtools
  // Explicitly set JSX to use React for Ink components.
  // oclite uses React/Ink (src/cli/ink/), not SolidJS (src/cli/cmd/tui/).
  // This overrides the global tsconfig jsxImportSource: "@opentui/solid" setting.
  const result = await Bun.build({
    entrypoints: [path.join(ROOT, "src/cli/ink/entry.ts")],
    outdir: BIN,
    target: "bun",
    minify: false,
    sourcemap: "none",
    naming: "oclite",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    jsx: {
      runtime: "automatic",
      importSource: "react",
    },
  })

  if (!result.success) {
    console.error("Build failed:")
    for (const log of result.logs) {
      console.error(log)
    }
    process.exit(1)
  }

  // Make executable
  await $`chmod +x ${path.join(BIN, "oclite")}`

  // Copy to ~/bin
  await fs.promises.mkdir(HOME_BIN, { recursive: true })
  await fs.promises.copyFile(path.join(BIN, "oclite"), path.join(HOME_BIN, "oclite"))

  // Sign for macOS
  await $`codesign --force --deep --sign - ${path.join(HOME_BIN, "oclite")}`.quiet().nothrow()
  await $`xattr -cr ${path.join(HOME_BIN, "oclite")}`.quiet().nothrow()

  // Get size
  const stat = await fs.promises.stat(path.join(HOME_BIN, "oclite"))
  const sizeMB = (stat.size / 1024 / 1024).toFixed(2)

  console.log(`✓ Built oclite (${sizeMB} MB)`)
  console.log(`✓ Installed to ~/bin/oclite`)
  console.log("\nRun with: ~/bin/oclite")
}

build().catch((err) => {
  console.error(err)
  process.exit(1)
})
