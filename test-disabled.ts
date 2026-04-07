import { PermissionNext } from "../src/permission/next"

const defaults = [
  { permission: "*", pattern: "*", action: "ask" as const }
]

const config = PermissionNext.fromConfig({
  "*": "deny",
  "bash": "allow",
  "taskctl": "allow",
})

console.log("Config rules:", JSON.stringify(config, null, 2))

const user: PermissionNext.Ruleset = []
const ruleset = PermissionNext.merge(defaults, config, user)

console.log("\nMerged ruleset:", JSON.stringify(ruleset, null, 2))

console.log("\n--- Testing disabled() ---")

// Test taskctl
const taskctlResult = PermissionNext.disabled(["taskctl"], ruleset)
console.log("taskctl disabled:", taskctlResult.has("taskctl"))

// Test bash
const bashResult = PermissionNext.disabled(["bash"], ruleset)
console.log("bash disabled:", bashResult.has("bash"))

// Test read
const readResult = PermissionNext.disabled(["read"], ruleset)
console.log("read disabled:", readResult.has("read"))