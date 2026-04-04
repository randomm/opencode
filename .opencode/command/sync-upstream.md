---
description: "Sync fork with upstream anomalyco/opencode, preserving fork features"
---

## Context

@.fork-features/manifest.json
@.fork-features/README.md

Recent sync reports:
!`ls -t .fork-features/reports/ 2>/dev/null | grep -v .gitkeep | head -3`

Upstream gap:
!`git fetch anomalyco 2>&1 && git log --oneline anomalyco/dev --not dev | head -50`

Divergence point:
!`git merge-base dev anomalyco/dev`

Current dev HEAD:
!`git rev-parse dev`

User arguments: $ARGUMENTS

## Instructions

### Pre-flight

Check `$ARGUMENTS` first:

- If it contains **"dry-run"**: execute steps 1–3 only, then stop. No merge, no branch.
- If it contains **"report-only"**: read the last 3 reports in `.fork-features/reports/`, summarize them, and stop.

### Step 1 — Read past reports

Read the last 3 reports in `.fork-features/reports/` (by date, newest first). Extract:

- What areas had conflicts last time
- Any ongoing absorption alerts
- API drift items that needed manual fixing
- Pain points and recommendations from previous syncs

This gives you institutional memory before starting.

### Step 2 — Analyze upstream gap

Look at the upstream commits shown in the context above. Group them by area:

- **provider** — model definitions, API calls, provider config
- **session** — conversation flow, message handling, compaction
- **tool** — tool definitions, registry, implementations
- **config** — user config, app config, settings
- **tui** — terminal UI, components, rendering
- **infra** — build, CI, packaging, dependencies
- **docs** — documentation, README, changelog
- **other** — anything else

For each area: count commits and write a one-line summary of what changed.

⚠️ **Watch for effectification commits** (prefixed `refactor(effect):` or `refactor(todo):` etc.). These typically rename or remove exports from modules our fork files import. Flag them now — they will cause typecheck failures after merge.

### Step 3 — Absorption signal check

This is the most critical step. For each active feature in the manifest:

1. Get its `upstreamTracking.absorptionSignals`
2. Search upstream's new/changed code for those signals
3. If ANY signal is found in upstream code:

**⛔ STOP. Do not proceed to merge.**

Present the finding to the user:

- Which feature is affected
- Which signal triggered
- Show the upstream code snippet containing the signal
- Show our code that implements the feature
- Ask: **"Keep ours, adopt upstream's, or merge both?"**

Wait for the user's decision. Record the decision for the sync report.

Only proceed when all absorption signals are cleared or user has made decisions.

### Step 4 — Create sync branch

```bash
git checkout -b sync/upstream-$(date +%Y-%m-%d)
```

If a branch with today's date already exists (e.g., from a failed earlier attempt), delete it first: `git branch -D sync/upstream-YYYY-MM-DD` then recreate.

### Step 5 — Merge upstream (sweep-restore pattern)

```bash
git merge anomalyco/dev --no-edit
```

If there are merge conflicts, use the **sweep-restore pattern** — do NOT try to resolve conflicts file by file:

#### 5a. Sweep everything to upstream

```bash
git checkout anomalyco/dev -- .
```

This forces every conflicted file to the upstream version. Do not skip this step — partial resolution is what causes committed conflict markers.

#### 5b. Restore fork-protected files

Restore our version for every fork-protected file. Build the list from the manifest:
- All files in `modifiedFiles` arrays of active features
- All `.opencode/` and `.fork-features/` directories

```bash
git checkout dev -- AGENTS.md
git checkout dev -- .opencode/
git checkout dev -- .fork-features/
git checkout dev -- packages/opencode/src/tool/registry.ts
git checkout dev -- packages/opencode/src/tool/task.ts
git checkout dev -- packages/opencode/src/tool/bash.ts
git checkout dev -- packages/opencode/src/session/index.ts
git checkout dev -- packages/opencode/src/session/prompt.ts
git checkout dev -- packages/opencode/src/acp/agent.ts
git checkout dev -- packages/opencode/src/provider/provider.ts
git checkout dev -- packages/opencode/src/provider/sdk/copilot/openai-compatible-error.ts
git checkout dev -- packages/opencode/src/provider/sdk/copilot/chat/openai-compatible-chat-language-model.ts
```

Also restore all `newFiles` (our additions that upstream deleted):
```bash
# src/tasks/ and all fork tool files
git checkout dev -- packages/opencode/src/tasks/
git checkout dev -- packages/opencode/src/tool/rg.ts
git checkout dev -- packages/opencode/src/tool/rg.txt
git checkout dev -- packages/opencode/src/tool/task.txt
git checkout dev -- packages/opencode/src/tool/check_task.ts
git checkout dev -- packages/opencode/src/tool/check_task.txt
git checkout dev -- packages/opencode/src/tool/list_tasks.ts
git checkout dev -- packages/opencode/src/tool/list_tasks.txt
git checkout dev -- packages/opencode/src/tool/cancel_task.ts
git checkout dev -- packages/opencode/src/tool/cancel_task.txt
git checkout dev -- packages/opencode/src/session/async-tasks.ts
git checkout dev -- packages/opencode/test/tasks/
git checkout dev -- packages/opencode/test/tool/rg.test.ts
git checkout dev -- packages/opencode/test/tool/bash-workdir.test.ts
git checkout dev -- packages/opencode/test/tool/check_task.test.ts
git checkout dev -- packages/opencode/test/tool/list_tasks.test.ts
git checkout dev -- packages/opencode/test/tool/cancel_task.test.ts
git checkout dev -- packages/opencode/test/tool/task-permission-bubbling.test.ts
git checkout dev -- packages/opencode/test/session/async-tasks.test.ts
git checkout dev -- packages/opencode/test/provider/cerebras-error-schema.test.ts
git checkout dev -- packages/opencode/test/provider/copilot/openai-compatible-error.test.ts
git checkout dev -- packages/opencode/test/provider/copilot/copilot-chat-model.test.ts
```

Enforce minimal-CI policy — remove workflows upstream added that we don't want:
```bash
git rm --ignore-unmatch .github/workflows/beta.yml
git rm --ignore-unmatch .github/workflows/nix-hashes.yml
git rm --ignore-unmatch .github/workflows/containers.yml
git rm --ignore-unmatch .github/workflows/close-stale-prs.yml
git rm --ignore-unmatch .github/workflows/daily-issues-recap.yml
git rm --ignore-unmatch .github/workflows/daily-pr-recap.yml
git rm --ignore-unmatch .github/workflows/pr-management.yml
git rm --ignore-unmatch .github/workflows/pr-standards.yml
git rm --ignore-unmatch .github/workflows/deploy.yml
git rm --ignore-unmatch .github/workflows/publish.yml
git rm --ignore-unmatch .github/workflows/test.yml
```

Enforce deleted-files policy — files we permanently deleted must stay deleted:
```bash
git rm --ignore-unmatch packages/opencode/src/tool/glob.ts
git rm --ignore-unmatch packages/opencode/src/tool/glob.txt
git rm --ignore-unmatch packages/opencode/src/tool/grep.ts
git rm --ignore-unmatch packages/opencode/src/tool/grep.txt
```

#### 5c. Hard conflict-marker gate

**This step is non-negotiable. Do not skip it.**

```bash
git grep -l "<<<<<<< HEAD" -- .
```

**The output MUST be empty.** If any files are listed:
1. For each listed file, check if it is in our fork-protected list → if yes, manually resolve; if no, `git checkout anomalyco/dev -- <file>`
2. Re-run the scan
3. Do not proceed until the scan returns zero results

#### 5d. Commit the merge

```bash
git add -A && git merge --continue --no-edit
```

### Step 6 — Install dependencies

```bash
bun install
```

If `bun install` fails with JSON parse errors, there are still conflict markers in package.json files. Find and fix them:
```bash
git grep -l "<<<<<<< HEAD" -- "*.json"
```
For each listed package.json, accept upstream: `git checkout anomalyco/dev -- <file>`. Then re-run `bun install`.

### Step 7 — Run feature verification

```bash
bun test .fork-features/verify.ts
```

**If tests fail**, triage by failure type:

- **"critical code present" failures** — The manifest's `criticalCode` marker no longer exists verbatim in source. Two possibilities:
  1. The code was dropped by upstream's sweep (the fork file was inadvertently overwritten) → restore from `git checkout dev -- <file>`
  2. The code exists but was refactored (renamed function/constant) → update the manifest `criticalCode` entry to the new literal string

- **"deleted file stays gone" failures** — Upstream re-introduced a file we deleted. Remove it:
  ```bash
  git rm <file> && git commit --amend --no-edit
  ```

- **"new file exists" failures** — One of our fork's new files is missing. Restore from dev:
  ```bash
  git checkout dev -- <file>
  ```

> ⚠️ **criticalCode markers must be literal code strings**, not human-readable descriptions.
> `"reserveTaskSlot"` ✅ — `"Slot-based concurrency"` ❌
> If you add markers, verify they appear verbatim in source before committing.

### Step 8 — Check typecheck (API drift)

```bash
cd packages/opencode && bun run typecheck
```

Upstream actively refactors its codebase (effectification, renamed exports, removed functions). Our fork files that import from upstream modules will break.

**Common drift patterns to fix:**
- Renamed function: update the call site in our fork file
- Removed function: remove the call or find the replacement
- New branded types: wrap raw strings with `.make()` constructors (e.g., `SessionID.make(str)`)
- Internal-only export: find alternative or create a helper in `src/tasks/session-helper.ts`

**If typecheck shows errors in upstream files** (not our fork files): these are pre-existing upstream issues, note them in the report but do not block.

**If a fork-protected file was fundamentally rewritten by upstream** (like `bash.ts` in April 2026 — ~400 line Effect/ChildProcess rewrite): STOP and present the decision to the user:
- What upstream changed and why
- What our fork adds on top
- Options: (A) port our additions to the new structure, (B) accept upstream's version, (C) keep our old version

Record the user's decision in the sync report.

### Step 9 — Runtime smoke test

```bash
bun dev --help
```

This confirms the binary starts and the CLI is functional. It is faster and more reliable than the full test suite as a gate.

If this fails with an environment variable conflict error, try `bun install` first to refresh dependencies.

### Step 10 — Build

```bash
cd packages/opencode && bun run build
```

Confirm the binary is produced at `dist/opencode-darwin-arm64/bin/opencode` (or platform equivalent).

If build fails with `ENOSPC` (disk space): free up space on the host and retry. This is an environment issue, not a code issue.

If build fails with bun version mismatch (`This script requires bun@^X.Y.Z`): upgrade bun first:
```bash
bun upgrade --version X.Y.Z  # Use the version from root package.json packageManager field
```

### Step 11 — Targeted fork tests

Run fork-specific tests only. The full test suite hangs due to pre-existing upstream issues.

```bash
cd packages/opencode
bun test test/session/async-tasks.test.ts
bun test test/tool/rg.test.ts
bun test test/tool/task.test.ts
bun test test/tool/bash-workdir.test.ts
bun test test/tasks/store.test.ts
bun test test/tasks/scheduler.test.ts
bun test test/tasks/validation.test.ts
bun test test/provider/cerebras-error-schema.test.ts
bun test test/provider/copilot/openai-compatible-error.test.ts
```

All of these must pass. If any fail, fix them before proceeding.

### Step 12 — Write sync report

Write a report to `.fork-features/reports/YYYY-MM-DD-sync.md` with these sections:

```markdown
# Upstream Sync — YYYY-MM-DD

## Summary

One paragraph: what happened, outcome (success/partial/failed).

## Upstream Changes

Commit range merged: `<base>..<new>`
| Area | Commits | Summary |
|------|---------|---------|
| provider | N | ... |
| session | N | ... |
| ... | ... | ... |

## Conflicts Resolved

- `file.ts` — how it was resolved and why

## API Drift Fixed

| Old API | New API | Affected Fork Files |
|---------|---------|---------------------|
| `oldExport` | `newExport` | `src/tasks/foo.ts` |

## Feature Verification

- ✅ async-tasks: all checks pass
- ✅ rg-tool: all checks pass
- ⚠️ bash-workdir-validation: upstream rewrote bash.ts — ported validation (see Decisions Made)

## Absorption Alerts

List any signals that fired, with user decisions.

## Decisions Made

Record every decision the user made during this sync (absorption, API drift, rewrite porting, etc.).

## Pain Points

What was hard, what could be improved.

## Recommendations for Next Sync

Specific things to watch for next time.
```

### Step 13 — Present summary

Show the user:

- Number of upstream commits merged
- Conflicts resolved (count and files)
- API drift fixed (count and what renamed)
- Feature verification results (verify.ts pass count)
- Smoke test / build / fork-test results

If everything is green, recommend pushing the sync branch and merging to dev:

```
All checks pass. Push sync branch and merge to dev:
  git push -u origin sync/upstream-YYYY-MM-DD
  git checkout dev && git merge sync/upstream-YYYY-MM-DD
  git push origin dev
```

If there are issues, explain what needs attention before merging.

## Key Rules

- **NEVER** silently resolve conflicts in manifest `modifiedFiles` — these contain fork features
- **ALWAYS** use the sweep-restore pattern (Step 5) — never try to resolve conflicts file by file
- **ALWAYS** run the conflict-marker hard gate (Step 5c) before committing — zero tolerance
- **ALWAYS** pause on absorption signals — the user must decide what to do
- **ALWAYS** write the sync report, even if the sync failed partway through
- **Read past reports** before every sync — they contain institutional memory about recurring issues
- **criticalCode markers must be literal code strings** — not human-readable descriptions. If a marker is prose ("Slot-based concurrency"), it will never pass verify.ts. Use the actual function/constant name ("reserveTaskSlot").
- **Upstream effectification rewrites break our imports** — expect renamed exports on every sync with `refactor(effect):` commits. Budget time for API drift fixes.