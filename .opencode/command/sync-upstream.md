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

### Step 5 — Merge upstream

```bash
git merge anomalyco/dev --no-edit
```

If there are merge conflicts, resolve them using this hierarchy:

1. **bun.lock** → accept upstream (`git checkout --theirs bun.lock && bun install`)
2. **docs/\*.md** → accept upstream
3. **Manifest modifiedFiles** → careful manual resolution:
   - Preserve all `criticalCode` markers from the manifest
   - If both sides changed the same function, **STOP and ask the user**
   - Never silently drop fork code in these files
4. **`.opencode/` directory** → keep ours (fork-specific configuration)
5. **All other files** → accept upstream
6. **Unresolvable conflicts** → STOP and ask the user

After resolving, stage and continue: `git add -A && git merge --continue`

### Step 6 — Run feature verification

```bash
bun test .fork-features/verify.ts
```

If tests fail:

1. Read the failure output carefully
2. Identify which feature/check failed
3. Attempt to fix (usually a merge resolution error)
4. Re-run the test
5. If it still fails: **STOP and present the failure to the user**

### Step 7 — Run full test suite

```bash
cd packages/opencode && bun test
```

Analyze any failures. If they relate to fork features, fix them. If they're pre-existing upstream failures, note them in the report but don't block.

### Step 8 — Run typecheck

```bash
cd packages/opencode && bunx tsc --noEmit
```

Fix any type errors introduced by the merge. Note pre-existing ones in the report.

### Step 9 — Write sync report

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

## Feature Verification

- ✅ async-tasks: all checks pass
- ✅ rg-tool: all checks pass
- ⚠️ 1m-context: absorption signal detected (decision: ...)

## Absorption Alerts

List any signals that fired, with user decisions.

## Decisions Made

Record every decision the user made during this sync.

## Pain Points

What was hard, what could be improved.

## Recommendations for Next Sync

Specific things to watch for next time.
```

### Step 10 — Present summary

Show the user:

- Number of upstream commits merged
- Conflicts resolved (count and files)
- Feature verification results
- Any absorption alerts and decisions
- Test suite / typecheck results

If everything is green, recommend:

```
All checks pass. Recommend merging sync branch to dev:
  git checkout dev && git merge sync/upstream-YYYY-MM-DD
```

If there are issues, explain what needs attention before merging.

## Key Rules

- **NEVER** silently resolve conflicts in manifest `modifiedFiles` — these contain fork features
- **ALWAYS** pause on absorption signals — the user must decide what to do
- **ALWAYS** write the sync report, even if the sync failed partway through
- **Read past reports** before every sync — they contain institutional memory about recurring issues
