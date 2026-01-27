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

  // Discover WASM assets — check bundler output first, then BIN dir, then node_modules
  let wasmFiles: string[] = result.outputs.filter((o) => o.path.endsWith(".wasm")).map((o) => o.path)

  let wasmSource = "bundler output"

  // Fallback: check if Bun placed WASM files in BIN without listing in outputs
  if (wasmFiles.length === 0) {
    const glob = new Bun.Glob("*.wasm")
    for await (const file of glob.scan(BIN)) {
      wasmFiles.push(path.join(BIN, file))
    }
    if (wasmFiles.length > 0) {
      wasmSource = "BIN directory"
    }
  }

  // Final fallback: copy from node_modules
  if (wasmFiles.length === 0) {
    const MONOREPO_ROOT = path.resolve(ROOT, "../..")
    const sources = [
      path.join(MONOREPO_ROOT, "node_modules/web-tree-sitter/tree-sitter.wasm"),
      path.join(MONOREPO_ROOT, "node_modules/tree-sitter-bash/tree-sitter-bash.wasm"),
    ]
    for (const src of sources) {
      const dest = path.join(BIN, path.basename(src))
      const success = await copyWasm(src, dest)
      if (success) {
        wasmFiles.push(dest)
      }
    }
    if (wasmFiles.length > 0) {
      wasmSource = "node_modules fallback"
    }
  }

  if (wasmFiles.length === 0) {
    console.error("Error: No WASM files found. Tree-sitter requires WASM at runtime.")
    process.exit(1)
  }

  // Install binary to ~/bin
  await $`mkdir -p ${HOME_BIN}`
  await Bun.write(path.join(HOME_BIN, "oclite"), Bun.file(path.join(BIN, "oclite")))
  await $`chmod +x ${path.join(HOME_BIN, "oclite")}`

  // Copy WASM assets to ~/bin
  for (const wasm of wasmFiles) {
    const name = path.basename(wasm)
    const success = await copyWasm(wasm, path.join(HOME_BIN, name))
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
  console.log(`✓ Copied ${wasmFiles.length} WASM files (from ${wasmSource})`)
  console.log("\nRun with: ~/bin/oclite")
}

build().catch((err) => {
  console.error(err)
  process.exit(1)
})
