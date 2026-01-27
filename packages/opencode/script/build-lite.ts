#!/usr/bin/env bun
import path from "path"
import { $ } from "bun"

const ROOT = path.resolve(import.meta.dirname, "..")
const DIST = path.join(ROOT, "dist", "oclite-darwin-arm64")
const BIN = path.join(DIST, "bin")

const home = process.env.HOME
if (!home) {
  console.error("Error: HOME environment variable not set")
  process.exit(1)
}
const HOME_BIN = path.join(home, "bin")

async function copyWasm(src: string, dest: string): Promise<boolean> {
  try {
    await Bun.write(dest, Bun.file(src))
    return true
  } catch {
    return false
  }
}

async function build() {
  console.log("Building oclite...")

  await $`rm -rf ${DIST}`
  await $`mkdir -p ${BIN}`

  const result = await Bun.build({
    entrypoints: [path.join(ROOT, "src/cli/lite/index.ts")],
    outdir: BIN,
    target: "bun",
    minify: true,
    sourcemap: "none",
    naming: "oclite",
  })

  if (!result.success) {
    console.error("Build failed:")
    for (const log of result.logs) {
      console.error(log)
    }
    process.exit(1)
  }

  await $`chmod +x ${path.join(BIN, "oclite")}`

  // Discover WASM assets produced by bundler
  const wasmOutputs = result.outputs.filter((o) => o.path.endsWith(".wasm"))
  if (wasmOutputs.length === 0) {
    console.error("Error: No WASM files in build output. Tree-sitter requires WASM at runtime.")
    process.exit(1)
  }

  // Install binary to ~/bin
  await $`mkdir -p ${HOME_BIN}`
  await Bun.write(path.join(HOME_BIN, "oclite"), Bun.file(path.join(BIN, "oclite")))
  await $`chmod +x ${path.join(HOME_BIN, "oclite")}`

  // Copy WASM assets to ~/bin
  for (const wasm of wasmOutputs) {
    const name = path.basename(wasm.path)
    const success = await copyWasm(wasm.path, path.join(HOME_BIN, name))
    if (!success) {
      console.error(`Error: Failed to copy WASM file: ${name}`)
      process.exit(1)
    }
  }

  await $`codesign --force --deep --sign - ${path.join(HOME_BIN, "oclite")}`.quiet().nothrow()
  await $`xattr -cr ${path.join(HOME_BIN, "oclite")}`.quiet().nothrow()

  const size = Bun.file(path.join(HOME_BIN, "oclite")).size
  const sizeMB = (size / 1024 / 1024).toFixed(2)

  console.log(`✓ Built oclite (${sizeMB} MB)`)
  console.log(`✓ Installed to ~/bin/oclite`)
  console.log(`✓ Copied ${wasmOutputs.length} WASM files`)
  console.log("\nRun with: ~/bin/oclite")
}

build().catch((err) => {
  console.error(err)
  process.exit(1)
})
