import { test, expect } from "bun:test"
import os from "os"
import { PermissionNext } from "../../src/permission/next"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

// fromConfig tests

test("fromConfig - string value becomes wildcard rule", () => {
  const result = PermissionNext.fromConfig({ bash: "allow" })
  expect(result).toEqual([{ permission: "bash", pattern: "*", action: "allow" }])
})

test("fromConfig - object value converts to rules array", () => {
  const result = PermissionNext.fromConfig({ bash: { "*": "allow", rm: "deny" } })
  // With last-match-wins behavior, specific patterns come AFTER wildcards to override them
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },  // 1 wildcard
    { permission: "bash", pattern: "rm", action: "deny" },  // 0 wildcards
  ])
})

test("fromConfig - mixed string and object values", () => {
  const result = PermissionNext.fromConfig({
    bash: { "*": "allow", rm: "deny" },
    edit: "allow",
    webfetch: "ask",
  })
  // With last-match-wins behavior, specific patterns come AFTER wildcards to override them
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },  // 0 fixed chars
    { permission: "bash", pattern: "rm", action: "deny" },  // 2 fixed chars
    { permission: "edit", pattern: "*", action: "allow" },
    { permission: "webfetch", pattern: "*", action: "ask" },
  ])
})

test("fromConfig - empty object", () => {
  const result = PermissionNext.fromConfig({})
  expect(result).toEqual([])
})

test("fromConfig - expands tilde to home directory", () => {
  const result = PermissionNext.fromConfig({ external_directory: { "~/projects/*": "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: `${os.homedir()}/projects/*`, action: "allow" }])
})

test("fromConfig - expands $HOME to home directory", () => {
  const result = PermissionNext.fromConfig({ external_directory: { "$HOME/projects/*": "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: `${os.homedir()}/projects/*`, action: "allow" }])
})

test("fromConfig - expands $HOME without trailing slash", () => {
  const result = PermissionNext.fromConfig({ external_directory: { $HOME: "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: os.homedir(), action: "allow" }])
})

test("fromConfig - does not expand tilde in middle of path", () => {
  const result = PermissionNext.fromConfig({ external_directory: { "/some/~/path": "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: "/some/~/path", action: "allow" }])
})

test("fromConfig - expands exact tilde to home directory", () => {
  const result = PermissionNext.fromConfig({ external_directory: { "~": "allow" } })
  expect(result).toEqual([{ permission: "external_directory", pattern: os.homedir(), action: "allow" }])
})

test("evaluate - matches expanded tilde pattern", () => {
  const ruleset = PermissionNext.fromConfig({ external_directory: { "~/projects/*": "allow" } })
  const result = PermissionNext.evaluate("external_directory", `${os.homedir()}/projects/file.txt`, ruleset)
  expect(result.action).toBe("allow")
})

test("evaluate - matches expanded $HOME pattern", () => {
  const ruleset = PermissionNext.fromConfig({ external_directory: { "$HOME/projects/*": "allow" } })
  const result = PermissionNext.evaluate("external_directory", `${os.homedir()}/projects/file.txt`, ruleset)
  expect(result.action).toBe("allow")
})

// merge tests

test("merge - simple concatenation", () => {
  const result = PermissionNext.merge(
    [{ permission: "bash", pattern: "*", action: "allow" }],
    [{ permission: "bash", pattern: "*", action: "deny" }],
  )
  // merge() does flat() concatenation: later ruleset comes after earlier
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "*", action: "deny" },
  ])
})

test("merge - adds new permission", () => {
  const result = PermissionNext.merge(
    [{ permission: "bash", pattern: "*", action: "allow" }],
    [{ permission: "edit", pattern: "*", action: "deny" }],
  )
  // merge() does flat() concatenation
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "edit", pattern: "*", action: "deny" },
  ])
})

test("merge - concatenates rules for same permission", () => {
  const result = PermissionNext.merge(
    [{ permission: "bash", pattern: "foo", action: "ask" }],
    [{ permission: "bash", pattern: "*", action: "deny" }],
  )
  // merge() does flat() concatenation
  expect(result).toEqual([
    { permission: "bash", pattern: "foo", action: "ask" },
    { permission: "bash", pattern: "*", action: "deny" },
  ])
})

test("merge - multiple rulesets", () => {
  const result = PermissionNext.merge(
    [{ permission: "bash", pattern: "*", action: "allow" }],
    [{ permission: "bash", pattern: "rm", action: "ask" }],
    [{ permission: "edit", pattern: "*", action: "allow" }],
  )
  // merge() does flat() concatenation
  expect(result).toEqual([
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "ask" },
    { permission: "edit", pattern: "*", action: "allow" },
  ])
})

test("merge - empty ruleset does nothing", () => {
  const result = PermissionNext.merge([{ permission: "bash", pattern: "*", action: "allow" }], [])
  expect(result).toEqual([{ permission: "bash", pattern: "*", action: "allow" }])
})

test("merge - preserves order for last-match-wins precedence", () => {
  const result = PermissionNext.merge(
    [
      { permission: "edit", pattern: "src/*", action: "allow" },
      { permission: "edit", pattern: "src/secret/*", action: "deny" },
    ],
    [{ permission: "edit", pattern: "src/secret/ok.ts", action: "allow" }],
  )
  // merge() does flat() concatenation: later ruleset comes after earlier
  expect(result).toEqual([
    { permission: "edit", pattern: "src/*", action: "allow" },
    { permission: "edit", pattern: "src/secret/*", action: "deny" },
    { permission: "edit", pattern: "src/secret/ok.ts", action: "allow" },
  ])
})

test("merge - wildcard permission has last-match precedence", () => {
  // Simulates: defaults have "*": "ask", config sets bash: "allow"
  const defaults: PermissionNext.Ruleset = [{ permission: "*", pattern: "*", action: "ask" }]
  const config: PermissionNext.Ruleset = [{ permission: "bash", pattern: "*", action: "allow" }]
  const merged = PermissionNext.merge(defaults, config)

  // After merge (flat concat): [{*, *, ask}, {bash, *, allow}]
  // Both rules have wildcard patterns, so last-match-wins: {bash, *, allow}
  expect(PermissionNext.evaluate("bash", "ls", merged).action).toBe("allow")
  expect(PermissionNext.evaluate("edit", "foo.ts", merged).action).toBe("ask")
})

test("merge - config specific permission overrides default", () => {
  // Simulates: defaults have bash: "allow", config sets bash: "ask"
  const defaults: PermissionNext.Ruleset = [{ permission: "bash", pattern: "*", action: "allow" }]
  const config: PermissionNext.Ruleset = [{ permission: "bash", pattern: "*", action: "ask" }]
  const merged = PermissionNext.merge(defaults, config)

  // After merge: [{bash, *, allow}, {bash, *, ask}]
  // Both rules have same permission and pattern (wildcard), so last-match-wins applies
  expect(PermissionNext.evaluate("bash", "ls", merged).action).toBe("ask")
})

// evaluate tests

test("evaluate - exact pattern match", () => {
  const result = PermissionNext.evaluate("bash", "rm", [{ permission: "bash", pattern: "rm", action: "deny" }])
  expect(result.action).toBe("deny")
})

test("evaluate - wildcard pattern match", () => {
  const result = PermissionNext.evaluate("bash", "rm", [{ permission: "bash", pattern: "*", action: "allow" }])
  expect(result.action).toBe("allow")
})

test("evaluate - last matching rule wins", () => {
  const result = PermissionNext.evaluate("bash", "rm", [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "rm", action: "deny" },
  ])
  // Exact pattern matches have priority over wildcard pattern matches
  // So {bash, rm, deny} takes precedence over {bash, *, allow}
  expect(result.action).toBe("deny")
})

test("evaluate - exact pattern takes precedence over wildcard pattern", () => {
  const result = PermissionNext.evaluate("bash", "rm", [
    { permission: "bash", pattern: "rm", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  // With pure last-match-wins, the last matching rule wins regardless of specificity
  // Since "*" allow appears last, it wins: result is "allow"
  expect(result.action).toBe("allow")
})

test("evaluate - glob pattern match", () => {
  const result = PermissionNext.evaluate("edit", "src/foo.ts", [
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  expect(result.action).toBe("allow")
})

test("evaluate - last matching glob wins", () => {
  const result = PermissionNext.evaluate("edit", "src/components/Button.tsx", [
    { permission: "edit", pattern: "src/*", action: "deny" },
    { permission: "edit", pattern: "src/components/*", action: "allow" },
  ])
  // Both rules match, last in array wins: {edit, src/components/*, allow}
  expect(result.action).toBe("allow")
})

test("evaluate - order matters for specificity", () => {
  // Last matching rule wins, regardless of specificity
  const result = PermissionNext.evaluate("edit", "src/components/Button.tsx", [
    { permission: "edit", pattern: "src/components/*", action: "allow" },
    { permission: "edit", pattern: "src/*", action: "deny" },
  ])
  // Both patterns match, last in array wins: {edit, src/*, deny}
  expect(result.action).toBe("deny")
})

test("evaluate - unknown permission returns ask", () => {
  const result = PermissionNext.evaluate("unknown_tool", "anything", [
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result.action).toBe("ask")
})

test("evaluate - empty ruleset returns ask", () => {
  const result = PermissionNext.evaluate("bash", "rm", [])
  expect(result.action).toBe("ask")
})

test("evaluate - no matching pattern returns ask", () => {
  const result = PermissionNext.evaluate("edit", "etc/passwd", [
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  expect(result.action).toBe("ask")
})

test("evaluate - empty rules array returns ask", () => {
  const result = PermissionNext.evaluate("bash", "rm", [])
  expect(result.action).toBe("ask")
})

test("evaluate - exact pattern takes precedence over glob patterns", () => {
  const result = PermissionNext.evaluate("edit", "src/secret.ts", [
    { permission: "edit", pattern: "*", action: "ask" },
    { permission: "edit", pattern: "src/*", action: "allow" },
    { permission: "edit", pattern: "src/secret.ts", action: "deny" },
  ])
  // Exact pattern (src/secret.ts) takes precedence over glob patterns (* and src/*)
  expect(result.action).toBe("deny")
})

test("evaluate - specific glob pattern takes precedence over wildcard", () => {
  const result = PermissionNext.evaluate("edit", "src/foo.ts", [
    { permission: "edit", pattern: "*", action: "ask" },
    { permission: "edit", pattern: "test/*", action: "deny" },
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  // Glob pattern (src/*) takes precedence over wildcard (*) because it's more specific
  expect(result.action).toBe("allow")
})

test("evaluate - exact match after wildcard denies", () => {
  const result = PermissionNext.evaluate("bash", "/bin/rm", [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "/bin/rm", action: "deny" },
  ])
  // Both rules match, last in array wins: {bash, /bin/rm, deny}
  expect(result.action).toBe("deny")
})

test("evaluate - exact pattern overrides wildcard even when wildcard appears later", () => {
  const result = PermissionNext.evaluate("bash", "/bin/rm", [
    { permission: "bash", pattern: "/bin/rm", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  // With pure last-match-wins, "*" allow is the last matching rule, so it wins
  expect(result.action).toBe("allow")
})

// wildcard permission tests

test("evaluate - wildcard permission matches any permission", () => {
  const result = PermissionNext.evaluate("bash", "rm", [{ permission: "*", pattern: "*", action: "deny" }])
  expect(result.action).toBe("deny")
})

test("evaluate - wildcard permission with specific pattern", () => {
  const result = PermissionNext.evaluate("bash", "rm", [{ permission: "*", pattern: "rm", action: "deny" }])
  expect(result.action).toBe("deny")
})

test("evaluate - glob permission pattern", () => {
  const result = PermissionNext.evaluate("mcp_server_tool", "anything", [
    { permission: "mcp_*", pattern: "*", action: "allow" },
  ])
  expect(result.action).toBe("allow")
})

test("evaluate - specific permission comes after wildcard", () => {
  const result = PermissionNext.evaluate("bash", "rm", [
    { permission: "*", pattern: "*", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  // With last-match-wins, the last matching rule ("bash" allow) takes precedence
  expect(result.action).toBe("allow")
})

test("evaluate - wildcard permission before specific allow", () => {
  const result = PermissionNext.evaluate("edit", "src/foo.ts", [
    { permission: "*", pattern: "*", action: "deny" },
    { permission: "edit", pattern: "src/*", action: "allow" },
  ])
  // With last-match-wins, the last matching rule ("edit" allow) takes precedence
  expect(result.action).toBe("allow")
})

test("evaluate - exact permission overrides glob permission", () => {
  const result = PermissionNext.evaluate("mcp_dangerous", "anything", [
    { permission: "*", pattern: "*", action: "ask" },
    { permission: "mcp_*", pattern: "*", action: "allow" },
    { permission: "mcp_dangerous", pattern: "*", action: "deny" },
  ])
  // Exact permission (mcp_dangerous) takes precedence over glob permission (mcp_*)
  expect(result.action).toBe("deny")
})

test("evaluate - wildcard permission fallback for unknown tool", () => {
  const result = PermissionNext.evaluate("unknown_tool", "anything", [
    { permission: "*", pattern: "*", action: "ask" },
    { permission: "bash", pattern: "*", action: "allow" },
  ])
  expect(result.action).toBe("ask")
})

test("evaluate - wildcard pattern last-match-wins across permissions", () => {
  // specific permission listed before wildcard, so wildcard wins (last-match)
  const result = PermissionNext.evaluate("bash", "rm", [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "*", pattern: "*", action: "deny" },
  ])
  // Both rules have wildcard patterns, so last-match-wins: {*, *, deny}
  expect(result.action).toBe("deny")
})

test("evaluate - merges multiple rulesets", () => {
  const config: PermissionNext.Ruleset = [{ permission: "bash", pattern: "*", action: "allow" }]
  const approved: PermissionNext.Ruleset = [{ permission: "bash", pattern: "rm", action: "deny" }]
  // approved comes after config, merge reverses: [{rm:deny}, {*:allow}]
  // Both match "rm", last exact match wins: {bash, rm, deny}
  const result = PermissionNext.evaluate("bash", "rm", config, approved)
  expect(result.action).toBe("deny")
})

// disabled tests

test("disabled - returns empty set when all tools allowed", () => {
  const result = PermissionNext.disabled(["bash", "edit", "read"], [{ permission: "*", pattern: "*", action: "allow" }])
  expect(result.size).toBe(0)
})

test("disabled - wildcard pattern last-match-wins allows tool", () => {
  const result = PermissionNext.disabled(
    ["bash", "edit", "read"],
    [
      { permission: "bash", pattern: "*", action: "deny" },
      { permission: "*", pattern: "*", action: "allow" },
    ],
  )
  // Both rules have wildcard patterns, so last-match-wins: {*, *, allow}
  // bash is NOT disabled, same as edit and read
  expect(result.has("bash")).toBe(false)
  expect(result.has("edit")).toBe(false)
  expect(result.has("read")).toBe(false)
})

test("disabled - wildcard pattern last-match-wins allows edit tools", () => {
  const result = PermissionNext.disabled(
    ["edit", "write", "patch", "multiedit", "bash"],
    [
      { permission: "edit", pattern: "*", action: "deny" },
      { permission: "*", pattern: "*", action: "allow" },
    ],
  )
  // Both rules have wildcard patterns, so last-match-wins: {*, *, allow}
  // All tools are NOT disabled
  expect(result.has("edit")).toBe(false)
  expect(result.has("write")).toBe(false)
  expect(result.has("patch")).toBe(false)
  expect(result.has("multiedit")).toBe(false)
  expect(result.has("bash")).toBe(false)
})

test("disabled - does not disable when partially denied", () => {
  const result = PermissionNext.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "*", action: "allow" },
      { permission: "bash", pattern: "rm *", action: "deny" },
    ],
  )
  expect(result.has("bash")).toBe(false)
})

test("disabled - does not disable when action is ask", () => {
  const result = PermissionNext.disabled(["bash", "edit"], [{ permission: "*", pattern: "*", action: "ask" }])
  expect(result.size).toBe(0)
})

test("disabled - does not disable when wildcard deny before specific allow", () => {
  const result = PermissionNext.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "*", action: "deny" },
      { permission: "bash", pattern: "echo *", action: "allow" },
    ],
  )
  // Tool should NOT be disabled because there is an allow rule for this permission
  expect(result.has("bash")).toBe(false)
})

test("disabled - does not disable when specific deny before wildcard allow", () => {
  const result = PermissionNext.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "rm *", action: "deny" },
      { permission: "bash", pattern: "*", action: "allow" },
    ],
  )
  // With last-match-wins, the last matching rule is wildcard allow, so bash is NOT disabled
  expect(result.has("bash")).toBe(false)
})

test("disabled - disables multiple tools", () => {
  const result = PermissionNext.disabled(
    ["bash", "edit", "webfetch"],
    [
      { permission: "bash", pattern: "*", action: "deny" },
      { permission: "edit", pattern: "*", action: "deny" },
      { permission: "webfetch", pattern: "*", action: "deny" },
    ],
  )
  expect(result.has("bash")).toBe(true)
  expect(result.has("edit")).toBe(true)
  expect(result.has("webfetch")).toBe(true)
})

test("disabled - wildcard permission denies all tools", () => {
  const result = PermissionNext.disabled(["bash", "edit", "read"], [{ permission: "*", pattern: "*", action: "deny" }])
  expect(result.has("bash")).toBe(true)
  expect(result.has("edit")).toBe(true)
  expect(result.has("read")).toBe(true)
})

test("disabled - specific allow overrides wildcard deny", () => {
  // With wildcard matching, "*" matches everything including "bash", "edit", "read"
  // The last matching rule ({ bash, *, allow }) overrides the wildcard deny
  const result = PermissionNext.disabled(
    ["bash", "edit", "read"],
    [
      { permission: "*", pattern: "*", action: "deny" },
      { permission: "bash", pattern: "*", action: "allow" },
    ],
  )
  // bash is NOT disabled because the last matching rule for bash is the wildcard allow
  expect(result.has("bash")).toBe(false)
  // edit and read ARE disabled because their last matching rule is the wildcard deny
  expect(result.has("edit")).toBe(true)
  expect(result.has("read")).toBe(true)
})

test("disabled - tool with per-subagent deny/allow is visible", () => {
  // Tests the exact bug from issue #401
  const result = PermissionNext.disabled(
    ["task"],
    PermissionNext.fromConfig({
      task: { "*": "deny", "ops": "allow", "developer": "allow" },
    }),
  )
  // Tool should be visible because at least one subagent (ops, developer) is allowed
  expect(result.has("task")).toBe(false)
})

test("disabled - tool with deny-only config is hidden", () => {
  const result = PermissionNext.disabled(
    ["task"],
    PermissionNext.fromConfig({
      task: { "*": "deny" },
    }),
  )
  // Tool should be hidden because no subagent is allowed
  expect(result.has("task")).toBe(true)
})

test("disabled - edit tool with deny and glob allow is visible", () => {
  const result = PermissionNext.disabled(
    ["edit"],
    [
      { permission: "edit", pattern: "*", action: "deny" },
      { permission: "edit", pattern: "src/*", action: "allow" },
    ],
  )
  // Edit should be visible because src/* allow exists
  expect(result.has("edit")).toBe(false)
})

test("disabled - consistency with evaluate for wildcard deny-only", () => {
  // If disabled() says tool is disabled, evaluate() must also deny
  const ruleset = PermissionNext.fromConfig({
    task: { "*": "deny" },
  })
  const disabled = PermissionNext.disabled(["task"], ruleset)
  const evalResult = PermissionNext.evaluate("task", "*", ruleset)
  expect(disabled.has("task")).toBe(true)
  expect(evalResult.action).toBe("deny")
  // Verify consistency
  expect(disabled.has("task")).toBe(evalResult.action === "deny")
})

test("disabled - consistency with evaluate for per-subagent allow", () => {
  // If disabled() says tool is NOT disabled, evaluate() should allow for at least one pattern
  const ruleset = PermissionNext.fromConfig({
    task: { "*": "deny", "ops": "allow" },
  })
  const disabled = PermissionNext.disabled(["task"], ruleset)
  const evalForWildcard = PermissionNext.evaluate("task", "*", ruleset)
  const evalForOps = PermissionNext.evaluate("task", "ops", ruleset)
  expect(disabled.has("task")).toBe(false)
  expect(evalForWildcard.action).toBe("deny") // default is deny
  expect(evalForOps.action).toBe("allow") // ops specifically allowed
})

test("disabled - tool with all deny rules regardless of pattern", () => {
  const result = PermissionNext.disabled(
    ["bash"],
    [
      { permission: "bash", pattern: "*", action: "deny" },
      { permission: "bash", pattern: "rm", action: "deny" },
    ],
  )
  // All rules are deny, tool should be disabled
  expect(result.has("bash")).toBe(true)
})

test("disabled - wildcard permission collision: visible but denied at runtime", () => {
  // A tool with a specific allow rule but wildcard permission deny:
  // disabled() shows the tool (hasAllow = true), but evaluate() denies for
  // patterns not specifically allowed. This is by design — visibility shows
  // "this tool can be used for SOME subagent", enforcement checks per-action.
  // Note: Order matters for last-match-wins - wildcard must come before specific rules
  const ruleset: PermissionNext.Ruleset = [
    { permission: "*", pattern: "*", action: "deny" },
    { permission: "task", pattern: "*", action: "deny" },
    { permission: "task", pattern: "ops", action: "allow" },
  ]
  const disabled = PermissionNext.disabled(["task"], ruleset)
  // Tool is visible because task+ops allow rule exists
  expect(disabled.has("task")).toBe(false)
  // But evaluate() denies for non-ops subagents
  expect(PermissionNext.evaluate("task", "developer", ruleset).action).toBe("deny")
  // And evaluate() allows for ops specifically
  expect(PermissionNext.evaluate("task", "ops", ruleset).action).toBe("allow")
})

test("disabled and evaluate consistency - Security check", () => {
  // This test ensures disabled() and evaluate() use the same matching logic
  // Both prioritize exact pattern matches over wildcard pattern matches
  const ruleset = PermissionNext.fromConfig({
    read: {
      "*": "allow",
      "*.env": "ask",
    },
  })

  // With fromConfig, order is: [{read, *, allow}, {read, *.env, ask}]

  // If disabled() says tool is available (allowed), evaluate() must also allow
  const disabledTools = PermissionNext.disabled(["read"], ruleset)
  expect(disabledTools.has("read")).toBe(false) // read is not disabled

  // Therefore, evaluate() must allow it too for non-.env files
  const wildcardResult = PermissionNext.evaluate("read", "other.txt", ruleset)
  expect(wildcardResult.action).toBe("allow") // Only wildcard matches

  // For .env files, exact pattern match should win (exact-pattern precedence)
  const result = PermissionNext.evaluate("read", ".env", ruleset)
  expect(result.action).toBe("ask") // Exact pattern {read, *.env, ask} wins over {read, *, allow}
})

test("disabled and evaluate consistency - wildcard pattern last-match-wins", () => {
  // This test ensures disabled() and evaluate() use same wildcard pattern logic
  // Both use last-match-wins when only wildcard patterns are present
  const ruleset: PermissionNext.Ruleset = [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "*", pattern: "*", action: "deny" }
  ]

  const disabled = PermissionNext.disabled(["bash"], ruleset)
  const evalResult = PermissionNext.evaluate("bash", "rm", ruleset)

  // Both rules have wildcard patterns, so last-match-wins: {*, *, deny}
  expect(disabled.has("bash")).toBe(true) // bash IS disabled
  expect(evalResult.action).toBe("deny") // bash is denied

  // Verify consistency: if disabled() says disabled, evaluate() must deny
  expect(disabled.has("bash")).toBe(evalResult.action === "deny")
})

test("disabled and evaluate consistency - wildcard permission first", () => {
  // When wildcard permission comes first, both functions should deny
  const ruleset: PermissionNext.Ruleset = [
    { permission: "*", pattern: "*", action: "deny" },
    { permission: "bash", pattern: "*", action: "allow" }
  ]

  const disabled = PermissionNext.disabled(["bash"], ruleset)
  const evalResult = PermissionNext.evaluate("bash", "rm", ruleset)

  // With last-match-wins, last match is bash allow
  expect(disabled.has("bash")).toBe(false) // bash is NOT disabled
  expect(evalResult.action).toBe("allow") // bash is allowed

  // Verify consistency
  expect(disabled.has("bash")).toBe(evalResult.action === "deny")
})



// ask tests

test("ask - resolves immediately when action is allow", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const result = await PermissionNext.ask({
        sessionID: "session_test",
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "allow" }],
      })
      expect(result).toBeUndefined()
    },
  })
})

test("ask - throws RejectedError when action is deny", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await expect(
        PermissionNext.ask({
          sessionID: "session_test",
          permission: "bash",
          patterns: ["rm -rf /"],
          metadata: {},
          always: [],
          ruleset: [{ permission: "bash", pattern: "*", action: "deny" }],
        }),
      ).rejects.toBeInstanceOf(PermissionNext.DeniedError)
    },
  })
})

test("ask - returns pending promise when action is ask", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const promise = PermissionNext.ask({
        sessionID: "session_test",
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "ask" }],
      })
      // Promise should be pending, not resolved
      expect(promise).toBeInstanceOf(Promise)
      // Don't await - just verify it returns a promise
    },
  })
})

// reply tests

test("reply - once resolves the pending ask", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const askPromise = PermissionNext.ask({
        id: "permission_test1",
        sessionID: "session_test",
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      })

      await PermissionNext.reply({
        requestID: "permission_test1",
        reply: "once",
      })

      await expect(askPromise).resolves.toBeUndefined()
    },
  })
})

test("reply - reject throws RejectedError", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const askPromise = PermissionNext.ask({
        id: "permission_test2",
        sessionID: "session_test",
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      })

      await PermissionNext.reply({
        requestID: "permission_test2",
        reply: "reject",
      })

      await expect(askPromise).rejects.toBeInstanceOf(PermissionNext.RejectedError)
    },
  })
})

test("reply - always persists approval and resolves", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const askPromise = PermissionNext.ask({
        id: "permission_test3",
        sessionID: "session_test",
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: ["ls"],
        ruleset: [],
      })

      await PermissionNext.reply({
        requestID: "permission_test3",
        reply: "always",
      })

      await expect(askPromise).resolves.toBeUndefined()
    },
  })
  // Re-provide to reload state with stored permissions
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // Stored approval should allow without asking
      const result = await PermissionNext.ask({
        sessionID: "session_test2",
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      })
      expect(result).toBeUndefined()
    },
  })
})

test("reply - reject cancels all pending for same session", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const askPromise1 = PermissionNext.ask({
        id: "permission_test4a",
        sessionID: "session_same",
        permission: "bash",
        patterns: ["ls"],
        metadata: {},
        always: [],
        ruleset: [],
      })

      const askPromise2 = PermissionNext.ask({
        id: "permission_test4b",
        sessionID: "session_same",
        permission: "edit",
        patterns: ["foo.ts"],
        metadata: {},
        always: [],
        ruleset: [],
      })

      // Catch rejections before they become unhandled
      const result1 = askPromise1.catch((e: unknown) => e)
      const result2 = askPromise2.catch((e: unknown) => e)

      // Reject the first one
      await PermissionNext.reply({
        requestID: "permission_test4a",
        reply: "reject",
      })

      // Both should be rejected
      expect(await result1).toBeInstanceOf(PermissionNext.RejectedError)
      expect(await result2).toBeInstanceOf(PermissionNext.RejectedError)
    },
  })
})

test("ask - denies when exact pattern匹配", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      // "echo hello" matches wildcard allow rule
      // "rm -rf /" matches exact pattern "rm *" deny rule (exact-pattern precedence)
      await expect(
        PermissionNext.ask({
          sessionID: "session_test",
          permission: "bash",
          patterns: ["echo hello", "rm -rf /"],
          metadata: {},
          always: [],
          ruleset: [
            { permission: "bash", pattern: "*", action: "allow" },
            { permission: "bash", pattern: "rm *", action: "deny" },
          ],
        }),
      ).rejects.toBeInstanceOf(PermissionNext.DeniedError)
    },
  })
})

test("ask - allows all patterns when all match allow rules", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const result = await PermissionNext.ask({
        sessionID: "session_test",
        permission: "bash",
        patterns: ["echo hello", "ls -la", "pwd"],
        metadata: {},
        always: [],
        ruleset: [{ permission: "bash", pattern: "*", action: "allow" }],
      })
      expect(result).toBeUndefined()
    },
  })
})

test("DeniedError - includes suggestion when provided", () => {
  const error = new PermissionNext.DeniedError([{ permission: "bash", pattern: "*", action: "deny" }], "ls -la")
  expect(error.message).toContain("Suggested alternative: `ls -la`")
})

test("DeniedError - no suggestion text when not provided", () => {
  const error = new PermissionNext.DeniedError([{ permission: "bash", pattern: "*", action: "deny" }])
  expect(error.message).toContain("The user has specified a rule")
  expect(error.message).not.toContain("Suggested alternative")
})

test("DeniedError - message format with empty string suggestion treated as no suggestion", () => {
  // suggestion="" should not add the Suggested alternative line (falsy check)
  const error = new PermissionNext.DeniedError([{ permission: "bash", pattern: "*", action: "deny" }], undefined)
  expect(error.message).not.toContain("Suggested alternative")
})
