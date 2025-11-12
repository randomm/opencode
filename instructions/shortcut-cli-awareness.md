# Shortcut CLI Integration - Work Machine Only

This instruction is ONLY loaded on the work machine configuration. It provides Shortcut CLI awareness for project coordination and work item tracking.

## Available on This Machine

The Shortcut CLI (`short`) is installed and configured for accessing Shortcut.com work items. This tool enables direct integration between Shortcut project management and GitHub development workflow.

## ⚠️ CRITICAL: Shortcut API Constraints (READ THIS FIRST)

### Hard API Limit: 1000 Results Maximum

Shortcut's API enforces a **server-side hard limit of 1000 search results**. Queries exceeding this limit fail with:

```
HTTP 400 Bad Request
Error: "maximum-results-exceeded"
Message: "A maximum of 1000 search results are supported. 
Request fewer results or refine your search query."
```

**This is not optional guidance - it's enforced by Shortcut's servers.** Agents cannot bypass this limit.

### Measured Output Sizes (Empirical Data)

Based on actual measurements from work machine testing:

| Command Pattern | Output Size | Item Count | Context % | Classification |
|----------------|-------------|------------|-----------|----------------|
| `short story sc-12345` | 5-10 KB | 1 | <1% | 🟢 Always Safe |
| `short workflows` | 6 KB | 13 | <1% | 🟢 Always Safe |
| `short members` | 16 KB | 42 | 2% | 🟢 Always Safe |
| `short epics` | 216 KB | 227 | 27% | 🟢 Safe (but large) |
| Search with 2+ filters | <100 KB | 50-300 | <13% | 🟡 Safe with filters |
| Search with 1 filter | API ERROR | >1000 | N/A | 🔴 Likely fails |
| Unfiltered search | API ERROR | >1000 | N/A | 🔴 FORBIDDEN |

*Context % based on 200K token limit ≈ 800 KB available context*

### Command Safety Classification

**🟢 GREEN - Always Safe (No pre-flight check needed):**
- ✅ `short story sc-12345` - Direct lookups by ID
- ✅ `short epic epic-123` - Direct epic lookup by ID
- ✅ `short workflows` - List all workflows (13 items, 6 KB)
- ✅ `short members` - List team members (42 items, 16 KB)
- ✅ `short workspace "<name>"` - Access saved workspace
- ✅ `short epics` - List epics (227 items, 216 KB - safe but consumes 27% context)

**🟡 YELLOW - Safe with Conditions (Pre-flight check REQUIRED):**
- ⚠️ `short search` with **2+ filters** (examples: --owner + --state, --project + --epic, --type + --state)
- ⚠️ New workspace creation with proper filters

**🔴 RED - FORBIDDEN (API will reject with 400 error):**
- ❌ `short search "text"` - Text search with no filters
- ❌ `short search --state "started"` - Single filter only
- ❌ `short search "bug" --owner "@me"` - Text + 1 filter (insufficient on large workspaces)

### MANDATORY Pre-Flight Checklist

**Before executing ANY `short search` command, verify ALL of these:**

- [ ] **Is this a direct lookup by ID?** (`short story sc-12345` or `short epic epic-123`) → GREEN, proceed immediately
- [ ] **Is this a saved workspace?** (`short workspace "workspace-name"`) → GREEN, proceed immediately  
- [ ] **Does it have 2 or more filters?** (--owner + --state, --project + --type, --epic + --state) → YELLOW, verify filters then proceed
- [ ] **Will I run this search more than once?** → If YES, create workspace FIRST with `-S "workspace-name"`
- [ ] **Am I using text search with fewer than 2 filters?** → If YES, STOP - add more filters or use workspace

**If you cannot verify all applicable boxes: STOP. Add filters, create workspace, or ask PM for guidance.**

### Why This Matters

1. **Primary Concern:** API errors waste time and break workflows. Unfiltered searches return 400 errors on workspaces with >1000 matching stories.
2. **Secondary Concern:** Large outputs (like `short epics` at 216 KB) consume significant context window space (27%).
3. **Solution:** Always use 2+ filters for searches, or create/use workspaces for repeated queries.

### Filter Effectiveness (Empirical Data)

Each additional filter typically reduces results by 50-80%:
- Text only: >1000 results (API error)
- Text + 1 filter: 200-800 results (risky, may hit limit)
- Text + 2 filters: 50-300 results (safe, stays under limit)
- 2 filters (no text): 20-200 results (very safe)

**Rule of thumb:** Need 2+ filters to reliably stay under 1000-result API limit on large workspaces.

## Project Manager Responsibilities

**@project-manager** has direct access to both `short` CLI and `gh` CLI for workflow orchestration.

### When to Use Short CLI Directly

The PM can query Shortcut directly for:
- Searching stories with 2+ filters: `short search "authentication" --owner "@me" --state "in-progress"`
- Viewing story details: `short story sc-12345`
- Listing epics: `short epics`
- Listing projects: `short projects`
- Checking workspaces: `short workspace "current sprint"`

### When to Use gh Issue CLI Directly (Read-Only)

The PM can query GitHub issues directly for:
- Viewing issues: `gh issue view 123`
- Listing issues: `gh issue list --limit 20`

The PM must delegate to @git-agent for:
- Creating issues: Delegate with title and body
- Editing issues: Delegate for label/state changes

### What PM Still Delegates to Git Agent

ALL version control operations go to @git-agent:
- Git operations: commit, push, pull, branch, merge, rebase
- Pull requests: gh pr create, gh pr merge, gh pr review
- CI monitoring: gh run watch, gh run view

**Rationale:** PM orchestrates work coordination (Shortcut ↔ GitHub), git-agent handles version control.

### Typical Workflow Pattern

```
1. User: "Check Shortcut for authentication work"

2. PM: short search "authentication" --owner "@me" --state "in-progress"
   → Finds: sc-45678 "Add OAuth 2.0 authentication"

3. PM: short story sc-45678
   → Reads full story details, requirements, acceptance criteria

4. PM decides if investigation needed:
   - Simple implementation → Skip to step 6
   - Complex/unclear → Delegate to @research-specialist

5. @research-specialist (if delegated):
   - Creates workspace for investigation
   - Uses short CLI to gather context
   - Investigates technical approach
   - Stores findings in remory
   - Returns analysis to PM

6. PM: gh issue create --title "Add OAuth 2.0 authentication" \
      --body "Implements Shortcut story sc-45678\n\n[Story details]"
   → Creates GitHub issue #123

7. PM: Delegates implementation to specialist (e.g., @python-best-practices-architect)
   → Provides GitHub issue #123

8. Specialist implements with tests, following GitHub issue

9. @git-agent: Creates commits
   → Includes both references: "feat(#123): add OAuth [sc-45678]"

10. PM: Updates Shortcut manually or notes completion
```

### Example Commands

```bash
# Search for stories with 2+ filters (REQUIRED: prevents API errors)
short search "authentication" --owner "@me" --state "in-progress"
short search "payment" --type "bug" --project "backend" --state "started"

# Create workspace for repeated use (REQUIRED for repeated queries)
short search "authentication" --owner "@me" --state "in-progress" -S "my-auth-work"
short workspace "my-auth-work"  # Reuse this instead of repeating search

# View specific story (always safe)
short story sc-45678

# List epics with filters (reduces output from 216 KB to smaller size)
short epics --started              # Only active epics
short epics --title "Authentication" # Specific epic by name
short epics --completed            # Only completed epics

# List projects (always safe - small list)
short projects --title "backend"   # Specific project
short projects                     # All projects (typically <20 items)

# View saved workspace (always safe - pre-filtered)
short workspace "current sprint"
short workspace "bugs backlog"
short workspace -l                 # List all saved workspaces

# Create GitHub issue from Shortcut story
short story sc-45678 --format="%i: %t" | \
  xargs -I {} gh issue create --title "{}" \
  --body "Shortcut Story: sc-45678"
```

## Performance & Context Efficiency

**CRITICAL:** Some Shortcut CLI operations can consume large amounts of context. Follow these patterns:

### 🟢 Context-Efficient Patterns

**Direct Lookups (Most Efficient):**
```bash
short story sc-45678        # Single story by ID
short epic epic-123         # Single epic by ID
```

**Workspaces (Highly Efficient - Reusable):**
```bash
# Create once (saves search locally)
short search -o "@me" -s "in-progress" -S "my-current-work"

# Use repeatedly (no repeated API calls)
short workspace "my-current-work"
short workspace -l  # List all saved workspaces
```

**Filtered Searches (2+ filters required):**
```bash
short search --owner "@me" --state "in-progress"
short search --project "backend" --state "review"
short epics --started
short projects --title "auth"
```

### 🔴 FORBIDDEN Patterns (API will reject with 400 error)

**Never execute these - they exceed 1000-result API limit:**

```bash
# ❌ FORBIDDEN: Broad text searches without sufficient filters
short search "authentication"     # API ERROR: >1000 results
short search "bug"                # API ERROR: >1000 results

# ❌ FORBIDDEN: Single filter on large workspaces
short search --state "in-progress"  # API ERROR: >1000 results on large workspace
short search "feature" --owner "@me"  # RISKY: May exceed 1000 if user has many stories

# ❌ FORBIDDEN: Unfiltered listings
short members                     # Not typically safe to list all
```

**Consequence:** API returns HTTP 400 error "maximum-results-exceeded". Query fails, wastes time, breaks workflow.

**Alternative:** Add 2+ filters or create workspace with proper constraints.

### Search Operator Reference

Use these official Shortcut search operators to narrow results:

- `-o, --owner [name]` - Stories assigned to person (use `@me` for yourself)
- `-s, --state [name]` - Filter by workflow state
- `-p, --project [id|name]` - Filter by project
- `--epic [id|name]` - Filter by epic
- `-t, --text [name]` - Text search in title
- `-y, --type [name]` - Filter by type (feature/bug/chore)
- `-l, --label [name]` - Filter by label
- `-i, --iteration [name]` - Filter by sprint/iteration

## Research Specialist Support

**@research-specialist** has `short` CLI access for investigation tasks.

### REQUIRED: Workspace Creation Before Investigation

**Before investigating ANY topic, research specialist MUST create workspace:**

```bash
# REQUIRED first step for all research tasks
short search "<topic>" --owner "@me" --state "started" -S "research-<topic>"

# Use ONLY the workspace for all subsequent queries
short workspace "research-<topic>"
```

**Maximum searches per investigation:** 3-5 workspace accesses depending on scope. Avoid repeated searches - use single workspace.

### Usage Pattern

```
1. Receive delegation from PM: "Investigate sc-45678 for technical approach"

2. Create research workspace (REQUIRED):
   short search "OAuth" --owner "@me" --state "started" -S "research-oauth"

3. Use workspace to gather details:
   short workspace "research-oauth"

4. Access specific story:
   short story sc-45678

5. Store findings in memory:
   remory add "Investigated Shortcut story sc-45678 for OAuth implementation.
   Story requires OAuth 2.0 with PKCE flow. Related stories: sc-45670 (user model),
   sc-45671 (API endpoints). Recommended approach: Use authlib library.
   Estimated complexity: 3 days. Dependencies identified." \
   --user-id "$PROJECT_ID" --infer false

6. Return analysis to PM with:
   - Story summary and requirements
   - Technical approach recommendations
   - Related work items
   - Estimated complexity
   - Dependencies or blockers
```

## Git Autonomous Agent Integration

**@git-agent** has `short` CLI access for commit linking.

### When to Use Short CLI

- Creating commits that reference Shortcut stories
- Need to verify Shortcut story exists before linking
- Gathering story title/description for commit messages

### Commit Message Pattern

Use both GitHub issue and Shortcut story references for complete traceability:

```
feat(#123): add OAuth 2.0 authentication [sc-45678]

Implements OAuth 2.0 authentication with PKCE flow for enhanced security.
Users can now log in via Google, GitHub, or Microsoft accounts.

GitHub Issue: #123
Shortcut Story: sc-45678

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Workflow

```
1. PM provides both references:
   "Implement authentication. GitHub issue #123, Shortcut story sc-45678"

2. Git agent verifies story exists:
   short story sc-45678

3. Git agent creates commit with both references:
   - GitHub: #123 (for issue tracking)
   - Shortcut: [sc-45678] (for project management)

4. Both systems can track the same work
```

### Workspace Best Practices

**Workspaces are REQUIRED for repeated queries.** They save complex searches locally and prevent:
- ❌ Repeated API calls (inefficient, wastes rate limit)
- ❌ Risk of different results across queries (inconsistency)
- ❌ Wasted context on duplicate outputs

**Setup Pattern (Do This BEFORE investigating):**
```bash
# REQUIRED: Create workspace before research tasks
short search -o "@me" -s "in-progress" -S "my-active-work"
short search -o "@me" -s "review" -S "needs-my-review"
short search --epic "authentication" -s "started" -S "auth-work"
short search -p "backend" --type "bug" -S "backend-bugs"

# List all your workspaces
short workspace -l
```

**Daily Usage (Efficient and Safe):**
```bash
short workspace "my-active-work"
short workspace "needs-my-review"
short workspace "auth-work"
```

**Why Workspaces are REQUIRED:**
- ✅ Saved locally - zero API calls for repeated access
- ✅ Complex filters stored once, reused forever
- ✅ Consistent results across sessions
- ✅ Minimal context consumption
- ✅ Can be shared in team documentation

**Note:** Workspaces are still subject to the 1000-result API limit. The underlying filter combination must keep results under 1000.

## Shortcut ↔ GitHub Integration Best Practices

### Story Reference Format

**Consistent formatting across all contexts:**
- GitHub issues: `#123`
- Shortcut stories: `sc-45678` or `[sc-45678]`
- Commit messages: Include both for full traceability

### Linking Pattern

**GitHub Issue Body Template:**
```markdown
## Shortcut Story

**Story:** [sc-45678](https://app.shortcut.com/workspace/story/45678)
**Title:** Add OAuth 2.0 authentication

## Requirements

[Copy requirements from Shortcut story]

## Acceptance Criteria

[Copy acceptance criteria from Shortcut story]

## Technical Notes

[Add technical implementation details]
```

### Query Optimization (REQUIRED Patterns)

**🏆 REQUIRED: Workspaces for repeated queries**
```bash
short workspace "my-active-work"     # Pre-filtered, saved locally, reusable
```

**✅ EXCELLENT: Multiple filters (2+) for all searches**
```bash
short search --owner "@me" --state "in-progress"
short search --project "backend" --state "review"
```

**✅ GOOD: Text search WITH multiple filters**
```bash
short search "OAuth" --owner "@me" --state "started"
short search "payment bug" --project "backend" --type "bug"
```

**🔴 FORBIDDEN: Broad searches (API will reject)**
```bash
short search "authentication"        # API ERROR: >1000 results
short search "bug"                   # API ERROR: >1000 results
short search --state "in-progress"   # API ERROR: >1000 on large workspace
```

**Workspace Setup Pattern (REQUIRED before research):**
```bash
# Create workspace ONCE with proper filters
short search -o "@me" -s "in-progress" -S "my-current-work"
short search --epic "User Management" -s "started" -S "auth-epic"
short search -p "backend" --type "bug" -S "backend-bugs"

# Use workspace for ALL subsequent queries
short workspace "my-current-work"
short workspace "auth-epic"
```

### Memory Storage Best Practices

When using Shortcut CLI, store comprehensive context:

```bash
remory add "Working on Shortcut story sc-45678: OAuth 2.0 authentication.
State: started. Owner: team-backend. Epic: User Management (epic-123).
Dependencies: sc-45670 (user model - completed), sc-45671 (API endpoints - in progress).
GitHub issue #123 created for implementation. Technical approach: authlib library
with PKCE flow. Estimated: 3 days. Blockers: None." \
--user-id "$PROJECT_ID" --infer false
```

**Why comprehensive storage:**
- Future sessions can resume without re-querying Shortcut
- Context includes dependencies and blockers
- Links between Shortcut, GitHub, and technical decisions preserved

## Complete Workflow Example

### Scenario: User requests feature from Shortcut

```
USER: "Check Shortcut for the OAuth authentication story and create a GitHub issue"

PM: Let me check Shortcut for OAuth authentication work.
    [Executes: short search "OAuth authentication" --owner "@me" --state "started"]

PM: Found story sc-45678: "Add OAuth 2.0 authentication"
    [Executes: short story sc-45678]

PM: This story requires OAuth 2.0 with Google and GitHub providers.
    Let me create a GitHub issue for implementation.
    [Executes: gh issue create --title "Add OAuth 2.0 authentication" \
               --body "Implements Shortcut story sc-45678..."]

PM: Created GitHub issue #123. This requires investigation of OAuth libraries.
    Delegating to @research-specialist for technical approach.

RESEARCH: [Receives delegation]
          [Creates workspace: short search "OAuth" --owner "@me" -S "research-oauth"]
          [Uses: short workspace "research-oauth"]
          [Executes: short story sc-45678 for context]
          [Researches OAuth libraries]
          [Stores findings in remory]
          Returns: "Recommend authlib with PKCE flow. 3-day estimate."

PM: Thank you @research-specialist. Delegating implementation to
    @python-best-practices-architect with GitHub issue #123.

PYTHON: [Receives GitHub issue #123]
        [Implements OAuth with tests]
        [Delegates to @git-agent for commit]

GIT: [Receives implementation]
     [Executes: short story sc-45678 to verify]
     [Creates commit: "feat(#123): add OAuth 2.0 [sc-45678]"]
     [Creates PR]

PM: Feature implemented in PR #456. Shortcut story sc-45678 linked.
    Work is ready for review.
```

## Error Handling

### Shortcut CLI Errors

**Not authenticated:**
```
Error: Shortcut API token not configured
Solution: Run `short install` (work machine only, already configured)
```

**Story not found:**
```
Error: Story sc-45678 not found
Verify: Story ID format is correct (sc-XXXXX)
Check: Story may be archived or deleted
```

**API error: maximum-results-exceeded (400 Bad Request):**
```
Error: A maximum of 1000 search results are supported.
Request fewer results or refine your search query.

Cause: Search query returned >1000 results
Solution: Add 2+ filters to narrow results
Example: short search "bug" --project "backend" --state "started"
Or use saved workspace: short workspace "my-bugs"
```

**API rate limits:**
```
Error: Rate limit exceeded
Action: Wait 60 seconds and retry
If persistent: Report to user about Shortcut API limits
```

### Permission Errors on Personal Machine

If Shortcut CLI is attempted on personal machine:

```
PM Response: "Shortcut CLI is only available on work machine.
I cannot access Shortcut stories from this environment.
Please use the work machine for Shortcut integration,
or provide requirements directly without Shortcut references."
```

### GitHub Issue Creation Errors

**Issue already exists:**
```bash
# Check first
gh issue list --search "OAuth authentication" --limit 5

# If exists, reference existing issue instead of creating duplicate
```

**Permission denied:**
```
Error: GitHub API permission denied
Solution: Verify GH_TOKEN or gh auth status
```

## Cross-Agent Communication Patterns

### PM → Research Specialist

```
PM delegates: "Investigate Shortcut story sc-45678 for OAuth implementation.
Create research workspace, analyze technical requirements, identify dependencies,
recommend approach."

Research uses: short CLI (with workspace) + web research + technical analysis
Research returns: Detailed analysis with Shortcut context
Research stores: Findings in remory for future reference
```

### PM → Git Autonomous Agent

```
PM delegates: "Commit implementation for GitHub issue #123,
Shortcut story sc-45678"

Git agent: Verifies story with short CLI
Git agent: Creates commit with dual references
Git agent: Maintains traceability across both systems
```

### Specialist → Git Autonomous Agent

```
Specialist: Completes implementation for GitHub issue #123
Specialist delegates to git agent: Include Shortcut reference sc-45678
Git agent: Adds both references to commit message
```

## Tools Summary

### Project Manager Can Use Directly

- `short *` - All Shortcut CLI commands (with proper filters for searches)
- `gh issue view/list/create/edit` - GitHub issue management
- `remory *` - Memory operations for context storage

### Project Manager Must Delegate

- All `git` commands → @git-agent
- All `gh pr` commands → @git-agent
- All `gh run` commands → @git-agent
- Code implementation → Specialist agents

### Research Specialist Can Use

- `short *` - All Shortcut CLI commands for investigation (REQUIRED: create workspace first)
- `remory *` - Store research findings
- Read-only analysis tools

### Git Autonomous Agent Can Use

- `short *` - Verify stories and gather details for commits
- All `git` commands - Full version control operations
- All `gh` commands - GitHub CLI including PRs and CI

## Remember

1. **Shortcut CLI only on work machine** - This instruction not loaded on personal config
2. **API limit enforced** - Always use 2+ filters for searches or use saved workspaces
3. **PM orchestrates, doesn't execute** - PM coordinates Shortcut↔GitHub, specialists implement
4. **Workspace REQUIRED** - Create workspaces for any repeated queries
5. **Dual tracking** - Always include both GitHub issue and Shortcut story references
6. **Memory preservation** - Store Shortcut context in remory with `--infer false`
7. **Clean separation** - PM handles coordination, git-agent handles version control

This integration enables seamless workflow between Shortcut project management and GitHub development while maintaining clear agent boundaries and delegation patterns.
