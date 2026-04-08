# Agent Guidelines

> Lightweight fork of OpenCode by Anomaly, optimized for agentic workflows.

**Stack:** Bun 1.3+, TypeScript, SolidJS, Tauri, Turborepo monorepo
**Default branch:** dev

---

## Fork Workflow (CRITICAL)

**This is a FORK of `anomalyco/opencode`. We do NOT contribute upstream.**

### Repository Structure

- **Upstream:** `anomalyco/opencode` (read-only reference)
- **Our Fork:** `randomm/opencode` (where we work)
- **Origin remote:** Points to our fork

### Correct Workflow

```bash
# 1. Create feature branch from dev
git checkout dev && git pull origin dev
git checkout -b feature/issue-123-description

# 2. Implement with TDD, commit changes
git add . && git commit -m "feat(opencode): description (#123)"

# 3. Push feature branch to our fork
git push -u origin feature/issue-123-description

# 4. Create PR targeting our fork's dev (capture PR number)
PR_NUM=$(gh pr create --repo randomm/opencode --base dev --head feature/issue-123-description --json number -q .number)

# 5. Wait for CI checks to complete
gh pr checks $PR_NUM --watch

# 6. Get approval from @code-review-specialist

# 7. Verify approval received before merge
gh pr view $PR_NUM --json reviewDecision -q .reviewDecision
# Must output: APPROVED

# 8. Verify CI passed
gh pr checks $PR_NUM
# All checks must show passing

# 9. Merge PR (squash merge preferred)
gh pr merge $PR_NUM --squash --delete-branch
```

### PR Rules

- **NEVER** create PRs targeting upstream (`anomalyco/opencode`)
- **ALWAYS** create PRs targeting our fork's `dev` branch
- **ALWAYS** get code-review-specialist approval before merge
- Push feature branches to `origin` (our fork)

### Error Handling

If any step fails:

- **CI fails**: Fix issues, push new commits, wait for CI to pass
- **Approval denied**: Address review feedback, request re-review
- **Merge conflicts**: Rebase on latest dev, resolve conflicts, force-push
- **Command errors**: Check syntax, verify you're in correct repo/branch

### Syncing with Upstream (when needed)

```bash
# Fetch upstream changes
git fetch anomalyco dev

# Rebase our dev onto upstream (if we want their changes)
git checkout dev
git rebase anomalyco/dev
git push origin dev --force-with-lease
```

### Why No Upstream PRs?

PRs to upstream only notify them "we forked and made changes" - they don't merge into our fork. Our work stays in our fork regardless of upstream PR status.

---

## Context7 Protocol

**MANDATORY: Use context7 before ANY programming task.**

```
Before writing code:
1. Resolve library ID with context7
2. Query documentation for current API patterns
3. Verify syntax and best practices

Training data may be outdated. Context7 is authoritative.
```

When to use: Library APIs, framework patterns, configuration options, any code involving external dependencies.

---

## Agent Hierarchy

### Project Manager

- Orchestrates work across specialists
- Delegates tasks, never executes code
- Coordinates multi-agent workflows

### Specialists

| Agent                  | Domain                | Capabilities                     |
| ---------------------- | --------------------- | -------------------------------- |
| developer              | Code implementation   | Write, refactor, test code       |
| git-agent              | Version control       | Commits, branches, PRs           |
| code-review-specialist | Quality assurance     | Review PRs, enforce standards    |
| research-specialist    | Information gathering | Research, documentation          |
| adversarial-developer  | Security testing      | Find vulnerabilities, edge cases |
| explore                | Codebase navigation   | Search, understand architecture  |

### Delegation Rules

PM delegates -> Specialists execute -> Report back to PM. All work traces back to GitHub issues.

---

## Issue-Driven Development

**All work must match GitHub issue content exactly.**

```bash
# Before starting work
gh issue view #123
```

Validate: Does task match issue? Am I adding unrequested features? Refuse work not explicitly listed. If scope needs expansion, update the issue first.

---

## Quality Gates

### Zero Bypasses

**Forbidden in source code:**

```typescript
// @ts-ignore
// @ts-expect-error
// eslint-disable
as any
```

If the type system complains, fix the underlying issue.

### Zero Technical Debt

**Forbidden in source code:**

```typescript
// TODO
// FIXME
// HACK
// XXX
```

If work must be deferred, create a GitHub issue. The issue IS the TODO.

### Fix What You Find

**When you encounter a pre-existing issue while working on code, you MUST fix it.**

- Don't leave bugs, malformed structure, or technical debt for future discoverers
- If scope is large, file a separate GitHub issue AND fix what you can in the current PR
- Pre-existing issues are NOT an excuse to leave broken code
- "But I didn't write it that way" is not acceptable

**Examples:**
- Found malformed indentation during review → Fix it
- Spotted unreachable code while implementing feature → Fix it
- Discovered incorrect error handling in adjacent function → Fix it

---

## Pre-Push Verification

**CI is for VERIFICATION, not DISCOVERY.**

Before ANY `git push`, all checks must pass locally:

```bash
# In packages/opencode directory
bun run typecheck   # 0 errors (uses tsgo --noEmit)
bun test            # 0 failures

# From repo root
bun typecheck       # Runs turbo typecheck across workspace
```

Never push to "see if CI catches anything." Fix locally first.

---

## Minimalist Engineering

**Every line of code is a liability.**

Before creating anything:

1. **Is this explicitly required** by the GitHub issue?
2. **Can existing code/tools** solve this instead?
3. **What's the SIMPLEST** solution?
4. **Am I building for hypothetical** future needs?

If you cannot justify necessity, DO NOT CREATE IT.

```
❌ "This might be useful later"
❌ "Future-proofing"
✅ "The issue explicitly requires this"
✅ "Simplest working solution"
```

---

## Module Size Limits

| Type         | Hard Limit | Ideal     |
| ------------ | ---------- | --------- |
| Source files | 500 lines  | 300 lines |
| Test files   | 800 lines  | 500 lines |

Refactor trigger: File exceeds 500 lines OR has 3+ distinct responsibilities.

---

## Monorepo Structure

```
packages/
├── opencode/     # Core CLI and TUI
├── app/          # Web UI (SolidJS)
├── desktop/      # Tauri desktop app
├── web/          # Documentation site
├── ui/           # Shared UI components
├── util/         # Shared utilities
├── sdk/js/       # JavaScript SDK
├── plugin/       # Plugin system
├── function/     # Cloud functions
├── identity/     # Auth services
├── console/      # Admin console
└── enterprise/   # Enterprise features
```

---

## Development Commands

### From repo root

```bash
bun install              # Install all dependencies
bun typecheck            # Type check entire workspace
bun dev                  # Run TUI (defaults to packages/opencode)
```

### From packages/opencode

```bash
bun dev                  # Run TUI
bun dev -- serve         # Headless API server (port 4096)
bun run typecheck        # Type check (tsgo --noEmit)
bun test                 # Run tests
bun run build            # Build binaries
```

### From packages/app

```bash
bun dev                  # Start web UI dev server
bun test:e2e:local       # Run Playwright E2E tests
```

---

## taskctl: Autonomous Task Pipeline

`taskctl` is a built-in tool that automates the development loop for GitHub issues.
PM calls `taskctl start <issueNumber>` and the pipeline handles decomposition, development, review, and committing automatically.

### How it works

1. **Composer** — decomposes the GitHub issue into a dependency graph of tasks
2. **Pulse** — a 5-second deterministic loop that schedules developer agents, monitors progress, and processes review verdicts
3. **developer-pipeline** — implements tasks with TDD, signals completion via `taskctl comment`
4. **adversarial-pipeline** — reviews code and writes structured verdict via `taskctl verdict`
5. **Steering** — assessed every 15 minutes: sends guidance or replaces stuck developers
6. **@ops** — commits approved work to the feature branch

PM is only interrupted when a task fails after 3 adversarial cycles, or when all tasks complete.

### PM workflow with taskctl

```bash
taskctl start <issueNumber>           # Decompose issue and start pipeline
taskctl status <issueNumber>          # Live dashboard — tasks, states, Pulse health
taskctl inspect <taskId>              # Full history of a specific task
taskctl stop <jobId>                  # Gracefully halt pipeline (work preserved)
taskctl resume <jobId>                # Resume a stopped or crashed pipeline
taskctl retry <taskId>                # Reset a stuck task for fresh attempt
taskctl override <taskId> --skip      # Skip a task, unblock dependents
taskctl override <taskId> --commit-as-is   # Commit despite issues (PM responsibility)
```

### Source locations

- Tool commands: `packages/opencode/src/tasks/tool.ts`
- Pipeline engine: `packages/opencode/src/tasks/pulse.ts`
- Agent definitions: `packages/opencode/src/agent/agent.ts`
- Design document: `lievo/plan-v2.md` (git-ignored, local only)

---

## Build & Install Binaries

### Main opencode TUI

**Quick reference — all commands from repo root:**

```bash
# 1. Build (from packages/opencode)
cd packages/opencode && bun run build --single

# 2. Install (from repo root — NOT from packages/opencode)
cd ../.. && ./script/install.sh

# 3. Promote candidate binary to stable
mv ~/bin/opencode-new ~/bin/opencode

# 4. Verify
~/bin/opencode --version
```

**Agent responsibilities:**

| Step | Agent | Commands |
|------|-------|----------|
| Build binary | @ops | `cd packages/opencode && bun run build --single` |
| Run install script | @ops | `./script/install.sh` (from repo root) |
| Promote candidate | User | `mv ~/bin/opencode-new ~/bin/opencode` |

> **Note:** @ops handles build and install because it requires `cp`, `codesign`, and file system operations not available to @developer. The install script runs from the **repo root** (`./script/install.sh`), NOT from `packages/opencode/`.

### How install.sh works

The install script (`./script/install.sh` from repo root) automates:

1. Platform/architecture detection (Darwin/Linux/Windows + arch)
2. Binary verification (size > 10MB, executable flag, symlink resolution)
3. Directory setup (creates `~/bin` if needed)
4. Atomic installation via mktemp + mv (rollback on failure)
5. macOS codesigning (with rollback to previous binary on failure)
6. Verification (`--version` runs successfully)

The script installs to `~/bin/opencode-new` (candidate binary), NOT `~/bin/opencode` (stable binary). This protects your working installation — you must promote manually:

```bash
# Test the candidate
~/bin/opencode-new --version

# If satisfied, promote to stable
mv ~/bin/opencode-new ~/bin/opencode
```

### Manual installation (advanced)

Only if the install script is unavailable:

```bash
# Build for current platform only
cd packages/opencode && bun run build --single

# Copy to ~/bin
cp packages/opencode/dist/opencode-darwin-arm64/bin/opencode ~/bin/opencode-new

# REQUIRED on macOS: ad-hoc codesign (build script does NOT auto-sign)
codesign --force --deep --sign - ~/bin/opencode-new || exit 1

# Verify candidate
~/bin/opencode-new --version

# Promote to stable
mv ~/bin/opencode-new ~/bin/opencode
```

**Critical notes:**

- The build script (`packages/opencode/script/build.ts`) does NOT auto-codesign. The install script handles codesigning.
- The install script lives at **repo root** (`./script/install.sh`), NOT in `packages/opencode/script/`.
- If codesigning fails on macOS, the binary will not execute. The install script detects this and rolls back automatically.
- Always verify with `--version` before promoting the candidate binary.

### JavaScript SDK

To regenerate the JavaScript SDK, run `./packages/sdk/js/script/build.ts`.

---

## Style Guide

### General Principles

- Keep things in one function unless composable or reusable
- Avoid `try`/`catch` where possible
- Avoid using the `any` type
- Prefer single word variable names where possible
- Use Bun APIs when possible, like `Bun.file()`
- Rely on type inference when possible; avoid explicit type annotations or interfaces unless necessary for exports or clarity
- Prefer functional array methods (flatMap, filter, map) over for loops; use type guards on filter to maintain type inference downstream

### Naming

Prefer single word names for variables and functions. Only use multiple words if necessary.

```ts
// Good
const foo = 1
function journal(dir: string) {}

// Bad
const fooBar = 1
function prepareJournal(dir: string) {}
```

Reduce total variable count by inlining when a value is only used once.

```ts
// Good
const journal = await Bun.file(path.join(dir, "journal.json")).json()

// Bad
const journalPath = path.join(dir, "journal.json")
const journal = await Bun.file(journalPath).json()
```

### Destructuring

Avoid unnecessary destructuring. Use dot notation to preserve context.

```ts
// Good
obj.a
obj.b

// Bad
const { a, b } = obj
```

### Variables

Prefer `const` over `let`. Use ternaries or early returns instead of reassignment.

```ts
// Good
const foo = condition ? 1 : 2

// Bad
let foo
if (condition) foo = 1
else foo = 2
```

### Control Flow

Avoid `else` statements. Prefer early returns.

```ts
// Good
function foo() {
  if (condition) return 1
  return 2
}

// Bad
function foo() {
  if (condition) return 1
  else return 2
}
```

### Schema Definitions (Drizzle)

Use snake_case for field names so column names don't need to be redefined as strings.

```ts
// Good
const table = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
})

// Bad
const table = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
})
```

---

## Testing

- Avoid mocks as much as possible
- Test actual implementation, do not duplicate logic into tests

### Test Organization

```
packages/opencode/
├── src/feature/feature.ts
└── test/feature/feature.test.ts
```

### TDD Workflow

1. Write failing test
2. Write minimal code to pass
3. Refactor
4. Repeat

Run tests: `bun test` or `bun test --coverage`

---

## Skills

Project-local skills are stored in `.opencode/skill/`:

- **bun-file-io**: File I/O patterns and preferred APIs for this repo

---

## Conventional Commits

Format: `type(scope): description`

| Type     | Use Case                    |
| -------- | --------------------------- |
| feat     | New feature                 |
| fix      | Bug fix                     |
| docs     | Documentation only          |
| refactor | Code change, no feature/fix |
| test     | Adding or updating tests    |
| chore    | Maintenance tasks           |
| ci       | CI configuration            |
| perf     | Performance improvement     |

Examples:

```bash
feat(opencode): add file watcher for hot reload
fix(app): prevent crash on empty session
refactor(util): simplify path resolution
chore: update dependencies
```

---

## Git Workflow

### Branch Strategy

```
main <- production releases
dev <- active development (default)
feature/* <- feature branches
fix/* <- bug fix branches
```

### Worktree and PR Policy

**Multiple worktrees, single PR.**

Use git worktrees to develop multiple related fixes in parallel — one worktree per fix. When done, consolidate all changes into **one branch** and open **one PR**.

- ✅ Multiple worktrees for parallel development
- ✅ One PR per logical unit of work (e.g. one feature, one batch of related bug fixes)
- ❌ Multiple PRs touching the same module — causes rebase conflicts and ordering issues

**When to use a separate PR:**
- Fixes are in completely unrelated modules with no shared files
- One fix is a prerequisite that must merge before the other can be written

**When to consolidate into one PR:**
- Fixes touch the same files or tightly coupled modules
- Fixes are part of the same feature or bug-fix batch

### Standard Flow

```bash
# 1. Create branch from dev
git checkout dev && git pull origin dev
git checkout -b feature/issue-123-description

# 2. Implement with TDD
# Write tests -> Write code -> Refactor

# 3. Verify locally
bun run typecheck && bun test

# 4. Commit with conventional format
git add . && git commit -m "feat(opencode): implement feature (#123)"

# 5. Push feature branch to our fork
git push -u origin feature/issue-123-description

# 6. Create PR targeting our fork's dev (capture PR number)
PR_NUM=$(gh pr create --repo randomm/opencode --base dev --head feature/issue-123-description --json number -q .number)

# 7. Wait for CI checks to complete
gh pr checks $PR_NUM --watch

# 8. Get code-review-specialist approval, verify, then merge
gh pr view $PR_NUM --json reviewDecision -q .reviewDecision  # Must be APPROVED
gh pr checks $PR_NUM  # All must pass
gh pr merge $PR_NUM --squash --delete-branch
```

---

## Auto-Merge Policy

After code-review-specialist approval AND CI passes:

- Squash merge immediately
- Delete feature branch
- Close linked issue

Do not wait for additional approvals on reviewed PRs.

---

## No Deprecated Code

**Unreleased software has no backward compatibility requirements.**

```
❌ Mark as deprecated
❌ Keep for compatibility
✅ Delete old code
✅ Update all usages
```

When changing APIs: Find all usages -> Update them -> Remove old code -> Single commit.

---

## Documentation Policy

### The 200-PR Test

Before creating documentation, ask: **"Will this be true in 200 PRs?"**

| Answer | Action                       |
| ------ | ---------------------------- |
| YES    | Document the principle (WHY) |
| NO     | Skip or use code comments    |

**Forbidden:** Issue drafts, implementation summaries, fix notes, scratch files.

**Allowed:** README.md, AGENTS.md, API documentation, ADRs.

---

## Error Handling

### Prefer Result Types

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }

function parse(input: string): Result<Config> {
  if (!input) return { ok: false, error: new Error("Empty input") }
  return { ok: true, value: JSON.parse(input) }
}
```

### Early Returns

```typescript
function process(data: Input) {
  if (!data) return null
  if (!data.valid) return null
  return transform(data)
}
```

---

## Environment Variables

### Required

```bash
ANTHROPIC_API_KEY    # For Anthropic models
OPENAI_API_KEY       # For OpenAI models
```

### Development

```bash
OPENCODE_TEST_HOME             # Test data directory
OPENCODE_DISABLE_MODELS_FETCH  # Skip model API calls
OPENCODE_DISABLE_SHARE         # Disable sharing features
OPENCODE_CLIENT                # Client identifier (app, cli)
```

---

## MCP Server Integration

```json
{
  "mcpServers": {
    "server-name": {
      "command": "path/to/server",
      "args": ["--flag"],
      "env": { "API_KEY": "value" }
    }
  }
}
```

Built-in tools: File operations, shell execution, search (glob, grep), web fetch.

---

## Security Guidelines

**Never Commit:** `.env`, `*.pem`, `*.key`, `credentials.json`

- Use environment variables for secrets
- Never hardcode API keys
- Review dependencies before adding

---

## CI Workflows

| Workflow | Trigger  | Purpose                       |
| -------- | -------- | ----------------------------- |
| ci.yml   | PR, push | Type checking, tests, linting |

Monitor with: `gh run watch [run-id]`

---

## Agent Communication

### Handoff Protocol

1. Provide GitHub issue reference
2. Specify exact scope
3. Define success criteria
4. Request completion report

### Status Reports

Specialists report: What was done, what was tested, any blockers, ready for review?

---

## Common Pitfalls

```
❌ Pushing without local verification
❌ Expanding scope beyond issue
❌ Adding "helpful" features
❌ Leaving TODO comments
❌ Using @ts-ignore
❌ Committing .env files

✅ Local verification before push
✅ Strict issue scope adherence
✅ Minimal viable solution
✅ GitHub issues for future work
✅ Proper type definitions
✅ Environment variables for secrets
```

---

## Quick Reference

### Before Writing Code

```bash
# Check context7 for current documentation
gh issue view #123
```

### Before Pushing

```bash
bun run typecheck && bun test
```

### Before Merging

- CI passes
- Code review approved
- Issue requirements met
- Conventional commit used

---

## Summary

1. **Use context7** before any code
2. **Follow issue scope** exactly
3. **Verify locally** before push
4. **No bypasses** or technical debt
5. **Minimalist** - every line justified
6. **Conventional commits** always
7. **Auto-merge** after approval + CI
8. **Delete** don't deprecate

---

## Fork Governance

This is a fork of `anomalyco/opencode`. All intentional divergences from upstream MUST be tracked in `.fork-features/`.

- **Before any change that diverges from upstream**: Add or update the relevant feature entry in `.fork-features/manifest.json`
- **New fork features**: Create a new entry following the schema in `.fork-features/README.md` (`status`, `description`, `issue`, `newFiles`, `deletedFiles`, `modifiedFiles`, `criticalCode`, `tests`, and `upstreamTracking.absorptionSignals`)
- **Deleted upstream files**: Record in the feature's `deletedFiles` array
- **AGENTS.md itself**: This file is a fork customization. Changes here must be reflected in the manifest
- **CI/workflow changes**: Document which upstream workflows are kept/deleted/disabled
- **Verification**: Run `bun run .fork-features/verify.ts` after any fork-feature change to ensure all features are intact
- **On upstream sync**: All `criticalCode` markers must survive the merge. The verify script is the gate.
