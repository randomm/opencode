import { PermissionNext } from "./src/permission/next"

// Simulate adversarial-pipeline agent permissions
const defaults = PermissionNext.fromConfig({
  "*": "allow",
})

const taskctlConfig = PermissionNext.fromConfig({
  "*": "deny",
  bash: "allow",
  taskctl: "allow",
})

const user = PermissionNext.fromConfig({}) // Empty user permissions

const merged = PermissionNext.merge(defaults, taskctlConfig, user)

console.log("Merged ruleset:", JSON.stringify(merged, null, 2))

console.log("\n--- Test evaluate ---")
console.log("evaluate('taskctl', '*'):", PermissionNext.evaluate("taskctl", "*", merged))
console.log("evaluate('bash', '*'):", PermissionNext.evaluate("bash", "*", merged))
console.log("evaluate('edit', '*'):", PermissionNext.evaluate("edit", "*", merged))

console.log("\n--- Test disabled ---")
const disabled = PermissionNext.disabled(["bash", "taskctl", "edit"], merged)
console.log("disabled tools:", Array.from(disabled))

console.log("\n--- Verify issue #387 ---")
const taskctlAction = PermissionNext.evaluate("taskctl", "*", merged).action
const isTaskctlDisabled = disabled.has("taskctl")
console.log("taskctl action:", taskctlAction)
console.log("taskctl is disabled:", isTaskctlDisabled)
if (taskctlAction === "allow" && isTaskctlDisabled) {
  console.log("❌ ISSUE #387 CONFIRMED: taskctl is ALLOWED by evaluate() but DISABLED by disabled()")
}