import { PermissionNext } from "./src/permission/next"

const config = { read: { "*": "allow", "*.env": "ask", "*.env.*": "ask", "*.env.example": "allow" } }
const rules = PermissionNext.fromConfig(config)
console.log(JSON.stringify(rules, null, 2))

const testPaths = [".env", ".env.local", ".env.production", ".env.example", ".envrc", "environment.ts"]

console.log("\nTest results:")
for (const path of testPaths) {
  const result = PermissionNext.evaluate("read", path, rules)
  console.log(`  ${path}: ${result.action}`)
}