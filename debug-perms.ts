import { PermissionNext } from "./packages/opencode/src/permission/next"

// Recreate the rulesets as they would be built
const defaults = PermissionNext.fromConfig({
  "*": "allow",
  doom_loop: "ask",
  external_directory: {
    "*": "ask",
  },
})

const adversarialSpecific = PermissionNext.fromConfig({
  "*": "deny",
  bash: "allow",
  taskctl: "allow",
})

const merged = PermissionNext.merge(defaults, adversarialSpecific)

console.log("\n=== DEFAULTS ===")
defaults.forEach((r, i) => console.log(`${i}: ${JSON.stringify(r)}`))

console.log("\n=== ADVERSARIAL SPECIFIC ===")
adversarialSpecific.forEach((r, i) => console.log(`${i}: ${JSON.stringify(r)}`))

console.log("\n=== MERGED ===")
merged.forEach((r, i) => console.log(`${i}: ${JSON.stringify(r)}`))

console.log("\n=== TEST EVALUATIONS ===")

// Test 1: doom_loop
const doomLoop = PermissionNext.evaluate("doom_loop", "*", merged)
console.log("\ndoom_loop permission:", doomLoop)
console.log("Expected: ask, Got:", doomLoop.action)

// Test 2: taskctl
const taskctl = PermissionNext.evaluate("taskctl", "*", merged)
console.log("\ntaskctl permission:", taskctl)
console.log("Expected: allow, Got:", taskctl.action)

// Test 3: bash
const bash = PermissionNext.evaluate("bash", "*", merged)
console.log("\nbash permission:", bash)
console.log("Expected: allow, Got:", bash.action)

// Test 4: External directory with * pattern
const extDir = PermissionNext.evaluate("external_directory", "*", merged)
console.log("\nexternal_directory with * pattern:", extDir)
console.log("Expected: ask, Got:", extDir.action)