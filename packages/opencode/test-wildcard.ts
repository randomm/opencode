import { Wildcard } from "./src/util/wildcard.ts"

// Test pattern matching
console.log("Testing Wildcard.match:")
console.log('Wildcard.match("*", "*"):', Wildcard.match("*", "*"))
console.log('Wildcard.match("*", "general"):', Wildcard.match("*", "general"))
console.log('Wildcard.match("*", "orchestrator-*"):', Wildcard.match("*", "orchestrator-*"))
console.log('Wildcard.match("general", "*"):', Wildcard.match("general", "*"))
console.log('Wildcard.match("code-reviewer", "*"):', Wildcard.match("code-reviewer", "*"))
console.log('Wildcard.isWildcard("*"):', Wildcard.isWildcard("*"))
console.log('Wildcard.isWildcard("general"):', Wildcard.isWildcard("general"))
console.log('Wildcard.isWildcard("orchestrator-*"):', Wildcard.isWildcard("orchestrator-*"))