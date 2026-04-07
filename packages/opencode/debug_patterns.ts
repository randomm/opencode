import { PermissionNext } from "./src/permission/next"

const defaults = PermissionNext.fromConfig({
  read: {
    "*": "allow",
    "*.env": "ask",
    "*.env.*": "ask",
    "*.env.example": "allow",
  },
})

console.log("Generated rules for read:")
defaults.forEach((rule, i) => {
  const wildcards = (rule.pattern.match(/\*/g) || []).length + (rule.pattern.match(/\?/g) || []).length
  const fixed = rule.pattern.length - wildcards
  console.log(`[${i}] "${rule.pattern}" action=${rule.action} wildcards=${wildcards} fixed=${fixed}`)
})

const testPaths = [".env", ".env.local", ".env.production", ".env.example", ".envrc", "environment.ts"]

console.log("\nTest results (shouldAsk=true means result.action='ask'):")
for (const path of testPaths) {
  const result = PermissionNext.evaluate("read", path, defaults)
  console.log(`  ${path}: ${result.action} (shouldAsk=${path.startsWith('.env') && !path.endsWith('.example')})`)
}