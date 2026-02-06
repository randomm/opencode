/**
 * Fork Feature Verification Tests
 *
 * Standalone bun test that validates all active fork features
 * survived an upstream merge. Run with: bun test .fork-features/verify.ts
 *
 * Checks:
 * - New files exist on disk
 * - Deleted files stay deleted
 * - Critical code markers are present in relevant files
 * - Test files exist
 * - Upstream absorption signals (warnings only, never failures)
 */
import { describe, test, expect } from "bun:test"
import path from "path"
import fs from "fs"

// Load manifest from same directory as this test file
const manifestPath = path.resolve(import.meta.dir, "manifest.json")
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))

// Basic manifest validation
if (!manifest.features || typeof manifest.features !== "object") {
  throw new Error("manifest.json missing 'features' object")
}
if (!manifest.upstream?.remote || !manifest.upstream?.branch) {
  throw new Error("manifest.json missing 'upstream.remote' or 'upstream.branch'")
}

// Project root is one level up from .fork-features/
const PROJECT_ROOT = path.resolve(import.meta.dir, "..")

// Collect absorption warnings across all features for final summary
const absorptionWarnings: { feature: string; signal: string; file: string }[] = []

// Filter to active features only
const activeFeatures = Object.entries(manifest.features as Record<string, any>).filter(
  ([, feat]) => feat.status === "active",
)

// ---------- Per-feature test suites ----------

for (const [featureName, feat] of activeFeatures) {
  describe(`Feature: ${featureName}`, () => {
    // --- New files must exist ---
    if (feat.newFiles?.length) {
      for (const file of feat.newFiles) {
        test(`new file exists: ${file}`, () => {
          const abs = path.resolve(PROJECT_ROOT, file)
          expect(fs.existsSync(abs)).toBe(true)
        })
      }
    }

    // --- Deleted files must stay deleted ---
    if (feat.deletedFiles?.length) {
      for (const file of feat.deletedFiles) {
        test(`deleted file stays gone: ${file}`, () => {
          const abs = path.resolve(PROJECT_ROOT, file)
          expect(fs.existsSync(abs)).toBe(false)
        })
      }
    }

    // --- Critical code markers present in source files ---
    if (feat.criticalCode?.length) {
      const sourceFiles = [...(feat.newFiles || []), ...(feat.modifiedFiles || [])]

      for (const marker of feat.criticalCode) {
        test(`critical code present: "${marker}"`, () => {
          let found = false

          for (const file of sourceFiles) {
            const abs = path.resolve(PROJECT_ROOT, file)
            // Skip files that don't exist (e.g. deleted during refactor)
            if (!fs.existsSync(abs)) continue
            try {
              const content = fs.readFileSync(abs, "utf-8")
              if (content.includes(marker)) {
                found = true
                break
              }
            } catch {
              // Gracefully skip unreadable files
            }
          }

          expect(found).toBe(true)
        })
      }
    }

    // --- Test files exist ---
    if (feat.tests?.length) {
      for (const testFile of feat.tests) {
        test(`test file exists: ${testFile}`, () => {
          const abs = path.resolve(PROJECT_ROOT, testFile)
          expect(fs.existsSync(abs)).toBe(true)
        })
      }
    }

    // --- Absorption signal scan (warnings only, always passes) ---
    if (feat.upstreamTracking?.absorptionSignals?.length) {
      test(`absorption scan (warnings only)`, () => {
        // Get files changed upstream since our divergence point
        const upstreamRef = `${manifest.upstream.remote}/${manifest.upstream.branch}`
        const result = Bun.spawnSync(["git", "diff", "--name-only", `HEAD...${upstreamRef}`], {
          cwd: PROJECT_ROOT,
          stdout: "pipe",
          stderr: "pipe",
        })

        if (result.exitCode !== 0) {
          // Remote may not be available — skip silently
          console.log(`  ℹ️  Skipping absorption scan for ${featureName}: git diff failed (remote unavailable?)`)
          expect(true).toBe(true)
          return
        }

        const upstreamFiles = result.stdout.toString().split("\n").filter(Boolean)

        // Exclude our own files so we don't false-positive on ourselves
        const ourFiles = new Set([
          ...(feat.newFiles || []),
          ...(feat.modifiedFiles || []),
          ...(feat.deletedFiles || []),
        ])
        const externalFiles = upstreamFiles.filter((f) => !ourFiles.has(f))

        // Search each upstream-only file for absorption signals
        for (const file of externalFiles) {
          const abs = path.resolve(PROJECT_ROOT, file)
          if (!fs.existsSync(abs)) continue

          let content: string
          try {
            content = fs.readFileSync(abs, "utf-8")
          } catch {
            continue
          }

          for (const signal of feat.upstreamTracking.absorptionSignals) {
            // Signals are plain strings — check includes and regex
            let matched = false
            if (content.includes(signal)) {
              matched = true
            } else {
              try {
                const re = new RegExp(signal)
                if (re.test(content)) matched = true
              } catch {
                // Not a valid regex, already checked as literal
              }
            }

            if (matched) {
              absorptionWarnings.push({ feature: featureName, signal, file })
            }
          }
        }

        const featureWarnings = absorptionWarnings.filter((w) => w.feature === featureName)
        if (featureWarnings.length > 0) {
          console.log(`\n${"=".repeat(60)}\n⚠️  ABSORPTION DETECTED for ${featureName}\n${"=".repeat(60)}`)
          for (const w of featureWarnings) {
            console.log(`  ⚠️  signal "${w.signal}" found in upstream file: ${w.file}`)
          }
          console.log("=".repeat(60))
        }

        // Absorption tests always pass — they are informational
        expect(true).toBe(true)
      })
    }
  })
}

// ---------- Final absorption summary ----------

describe("Absorption Summary", () => {
  test("report collected warnings", () => {
    if (absorptionWarnings.length > 0) {
      console.log(`\n${"#".repeat(60)}`)
      console.log(`#  ⚠️  ABSORPTION WARNINGS: ${absorptionWarnings.length} signal(s) detected`)
      console.log(`${"#".repeat(60)}`)
      for (const w of absorptionWarnings) {
        console.log(`  ⚠️  [${w.feature}] "${w.signal}" in ${w.file}`)
      }
      console.log(`${"#".repeat(60)}`)
      console.log(`\nRun /sync-upstream to review upstream changes before merging.\n`)
    } else {
      console.log("\n✅ No absorption signals detected. Fork features are safe.\n")
    }
    expect(true).toBe(true)
  })
})
