import { PermissionNext } from "./src/permission/next.ts"
import { Wildcard } from "./src/util/wildcard"

console.log("=== Testing wildcard matching ===")
console.log("Wildcard.match('edit', '*'):", Wildcard.match("edit", "*"))
console.log("Wildcard.match('*', 'edit'):", Wildcard.match("*", "edit"))

console.log("\n=== Testing fromConfig sorting ===")
const defaults = PermissionNext.fromConfig({
  "*": "allow",
  taskctl: "allow",
  task: "allow",
})

console.log("Defaults ruleset:")
defaults.forEach((r, i) => console.log(`  ${i}: permission='${r.permission}' pattern='${r.pattern}' action='${r.action}'`))

const plan = PermissionNext.fromConfig({
  edit: {
    "*": "deny",
    ".opencode/plans/*.md": "allow",
  },
  task: "deny",
  taskctl: "deny",
})

console.log("\nPlan ruleset:")
plan.forEach((r, i) => console.log(`  ${i}: permission='${r.permission}' pattern='${r.pattern}' action='${r.action}'`))

console.log("\n=== Testing merge without reverse ===")
const mergedNoReverse = [...defaults, ...plan]
mergedNoReverse.forEach((r, i) => console.log(`  ${i}: permission='${r.permission}' pattern='${r.pattern}' action='${r.action}'`))

console.log("\n=== Testing merge with reverse ===")
const mergedWithReverse = [...plan, ...defaults]
mergedWithReverse.forEach((r, i) => console.log(`  ${i}: permission='${r.permission}' pattern='${r.pattern}' action='${r.action}'`))

console.log("\n=== Testing evaluate ===")
console.log("With [defaults, plan]:")
const result1 = PermissionNext.evaluate("edit", "*", mergedNoReverse)
console.log(`  evaluate('edit', '*') = ${result1.action}`)
const result2 = PermissionNext.evaluate("taskctl", "*", mergedNoReverse)
console.log(`  evaluate('taskctl', '*') = ${result2.action}`)

console.log("\nWith [plan, defaults]:")
const result3 = PermissionNext.evaluate("edit", "*", mergedWithReverse)
console.log(`  evaluate('edit', '*') = ${result3.action}`)
const result4 = PermissionNext.evaluate("taskctl", "*", mergedWithReverse)
console.log(`  evaluate('taskctl', '*') = ${result4.action}`)