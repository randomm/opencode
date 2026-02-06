---
description: "Analyze gap between our fork and upstream opencode"
---

## Upstream Gap Analysis

You are the project manager for the opencode fork at `randomm/opencode`. Analyze the gap between our fork's `dev` branch and the upstream `anomalyco/opencode` `dev` branch.

### Steps

1. **Fetch upstream:**
   !`git fetch anomalyco 2>&1 || echo "Add remote first: git remote add anomalyco git@github.com:anomalyco/opencode.git"`

2. **Get the divergence point:**
   !`git merge-base dev anomalyco/dev`

3. **List upstream commits we don't have** (grouped by date):
   !`git log --oneline --no-merges anomalyco/dev --not dev -- packages/opencode/ | head -80`

4. **Count by area:**
   !`git log --oneline --no-merges anomalyco/dev --not dev -- packages/opencode/src/provider/ | wc -l`
   !`git log --oneline --no-merges anomalyco/dev --not dev -- packages/opencode/src/session/ | wc -l`
   !`git log --oneline --no-merges anomalyco/dev --not dev -- packages/opencode/src/tool/ | wc -l`
   !`git log --oneline --no-merges anomalyco/dev --not dev -- packages/opencode/src/agent/ | wc -l`
   !`git log --oneline --no-merges anomalyco/dev --not dev -- packages/opencode/src/config/ | wc -l`
   !`git log --oneline --no-merges anomalyco/dev --not dev -- packages/opencode/src/mcp/ | wc -l`
   !`git log --oneline --no-merges anomalyco/dev --not dev -- packages/opencode/src/permission/ | wc -l`
   !`git log --oneline --no-merges anomalyco/dev --not dev -- packages/sdk/ | wc -l`

5. **Our fork's unique changes** (not in upstream):
   !`git log --oneline --no-merges dev --not anomalyco/dev -- packages/opencode/ | head -40`

### Analysis Instructions

Based on the above data:

1. **Create a summary table** of upstream changes grouped by area, with commit count and description of what changed
2. **Flag conflicts** - identify areas where BOTH our fork AND upstream made changes (these need careful 3-way merge)
3. **Recommend priority** - rank which upstream changes are most valuable to port:
   - CRITICAL: Security fixes, major bug fixes
   - HIGH: New features we need (e.g., SDK upgrades, new providers)
   - MEDIUM: Improvements and refactors
   - LOW: Minor fixes, cosmetic changes
4. **Note already ported** - identify any upstream changes we already manually ported

Present the results and ask the user which items they want to port.

$ARGUMENTS
