# Fork Features

Governance system for maintaining fork-specific divergences during upstream syncs.

This fork (`randomm/opencode`) tracks upstream (`anomalyco/opencode`). Features declared here survive merges intentionally — nothing gets silently overwritten.

## Directory structure

```
.fork-features/
├── manifest.json    # Feature registry — what we own, how to verify it
├── verify.ts        # Standalone bun test — checks features survived a merge
├── README.md        # This file
└── reports/         # Dated sync run reports (institutional memory)
```

The AI command that drives syncs lives at `.opencode/command/sync-upstream.md`.

## Sync with upstream

Run `/sync-upstream` inside opencode. What happens:

1. Agent reads manifest.json and last 3 sync reports for context
2. Fetches upstream and analyzes the gap (commits grouped by area)
3. Checks absorption signals — if upstream absorbed a feature, STOPS and asks you
4. Creates sync branch, merges upstream
5. Resolves conflicts using manifest knowledge (criticalCode markers)
6. Runs verify.ts to confirm all fork features survived
7. Runs full test suite and typecheck
8. Writes a dated report to `reports/`
9. Presents summary and recommends merge if green

### Dry run

`/sync-upstream dry-run` — analysis only (steps 1-3), no merge.

### Report only

`/sync-upstream report-only` — reads and summarizes past reports.

## Add a new feature

Add an entry to `manifest.json`:

```json
"my-feature": {
  "status": "active",
  "description": "What it does",
  "newFiles": ["packages/opencode/src/my-feature.ts"],
  "modifiedFiles": ["packages/opencode/src/existing.ts"],
  "criticalCode": ["myFeatureFunction", "MY_FEATURE_FLAG"],
  "tests": ["packages/opencode/test/my-feature.test.ts"],
  "upstreamTracking": {
    "absorptionSignals": ["myFeatureFunction", "my.*feature"]
  }
}
```

Run `bun test .fork-features/verify.ts` to baseline.

## Drop a feature

Set `status` to `"dropped"` or `"upstream-absorbed"`. The verifier skips it. Log the reason in the next sync report.

## Absorption detection

During sync, the command checks upstream changes against each feature's `absorptionSignals`. If upstream code matches:

- **Auto-pauses** — presents upstream vs our code
- User decides: **keep ours**, **adopt upstream's**, or **merge both**
- Decision is recorded in the sync report

## Reports

Each sync writes a report to `reports/` (e.g., `2026-02-06-sync.md`). Reports contain:

- Upstream commit range merged
- Conflicts and resolutions
- Feature verification results
- Absorption alerts and decisions
- Pain points and recommendations

The agent reads past reports before each sync for institutional memory.
