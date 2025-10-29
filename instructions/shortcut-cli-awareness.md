# Shortcut CLI Integration - Work Machine Only

This instruction is ONLY loaded on the work machine configuration. It provides Shortcut CLI awareness for project coordination and work item tracking.

## Available on This Machine

The Shortcut CLI (`short`) is installed and configured for accessing Shortcut.com work items. This tool enables direct integration between Shortcut project management and GitHub development workflow.

## Project Manager Responsibilities

**@project-manager** has direct access to both `short` CLI and `gh` CLI for workflow orchestration.

### When to Use Short CLI Directly

The PM can query Shortcut directly for:
- Searching stories: `short search "authentication bug"`
- Viewing story details: `short story sc-12345`
- Listing epics: `short epics`
- Listing projects: `short projects`
- Checking workspaces: `short workspace "current sprint"`

### When to Use gh Issue CLI Directly

The PM can manage GitHub issues directly for:
- Viewing issues: `gh issue view 123`
- Listing issues: `gh issue list --limit 20`
- Creating issues: `gh issue create --title "..." --body "..."`
- Editing issues: `gh issue edit 123 --add-label "shortcut:sc-45678"`

### What PM Still Delegates to Git Agent

ALL version control operations go to @git-autonomous-agent:
- Git operations: commit, push, pull, branch, merge, rebase
- Pull requests: gh pr create, gh pr merge, gh pr review
- CI monitoring: gh run watch, gh run view

**Rationale:** PM orchestrates work coordination (Shortcut ↔ GitHub), git-agent handles version control.

### Typical Workflow Pattern

```
1. User: "Check Shortcut for authentication work"

2. PM: short search "authentication"
   → Finds: sc-45678 "Add OAuth 2.0 authentication"

3. PM: short story sc-45678
   → Reads full story details, requirements, acceptance criteria

4. PM decides if investigation needed:
   - Simple implementation → Skip to step 6
   - Complex/unclear → Delegate to @research-specialist

5. @research-specialist (if delegated):
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

9. @git-autonomous-agent: Creates commits
   → Includes both references: "feat(#123): add OAuth [sc-45678]"

10. PM: Updates Shortcut manually or notes completion
```

### Example Commands

```bash
# Search for stories with filters (efficient)
short search "authentication" --owner "@me" --state "in-progress"
short search "payment" --type "bug" --project "backend" --state "started"

# Or create workspace for repeated use
short search "authentication" --owner "@me" -S "my-auth-work"
short workspace "my-auth-work"  # Then reuse this

# View specific story
short story sc-45678

# List epics with filters (avoid listing all epics)
short epics --started              # Only active epics
short epics --title "Authentication" # Specific epic by name
short epics --completed            # Only completed epics

# List projects (usually OK, but can filter)
short projects --title "backend"   # Specific project
short projects                     # Projects are typically small list

# View saved workspace query
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

### ✅ Context-Efficient Patterns

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

**Filtered Searches:**
```bash
short search --owner "@me" --state "in-progress"
short search --project "backend" --state "review"
short epics --started
short projects --title "auth"
```

### ❌ Context-Consuming Anti-Patterns (AVOID)

**Never do these - they dump large result sets:**
```bash
# ❌ AVOID: Broad text searches without filters
short search "authentication"     # Could return 100+ stories
short search "bug"                # Way too many results

# ❌ AVOID: Unfiltered listings
short epics                       # Lists ALL epics (including archived)
short members                     # Lists ALL team members

# ❌ AVOID: Very broad filter combinations
short search --state "in-progress"  # All in-progress (could be 50+ stories)
```

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

### When to Use Short CLI

- PM delegates Shortcut investigation
- Need to analyze story details for research
- Gather context about related work items
- Investigate story history or linked stories

### Usage Pattern

```
1. Receive delegation from PM: "Investigate sc-45678 for technical approach"

2. Use short CLI to gather details:
   short story sc-45678

3. Use search to find related stories:
   short search "OAuth" --project "Authentication"

4. Store findings in memory:
   remory add "Investigated Shortcut story sc-45678 for OAuth implementation.
   Story requires OAuth 2.0 with PKCE flow. Related stories: sc-45670 (user model),
   sc-45671 (API endpoints). Recommended approach: Use authlib library.
   Estimated complexity: 3 days. Dependencies identified." \
   --user-id "$PROJECT_ID" --infer false

5. Return analysis to PM with:
   - Story summary and requirements
   - Technical approach recommendations
   - Related work items
   - Estimated complexity
   - Dependencies or blockers
```

## Git Autonomous Agent Integration

**@git-autonomous-agent** has `short` CLI access for commit linking.

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

**Workspaces are the PRIMARY pattern for repeated queries.** They save complex searches locally and avoid repeated API calls.

**Setup Pattern (Do This First):**
```bash
# Create workspaces for your common queries
short search -o "@me" -s "in-progress" -S "my-active-work"
short search -o "@me" -s "review" -S "needs-my-review"
short search --epic "authentication" -s "started" -S "auth-work"
short search -p "backend" --type "bug" -S "backend-bugs"

# List all your workspaces
short workspace -l
```

**Daily Usage (Efficient):**
```bash
short workspace "my-active-work"
short workspace "needs-my-review"
short workspace "auth-work"
```

**Why Workspaces are Critical:**
- ✅ Saved locally - no API call needed
- ✅ Complex filters stored once
- ✅ Consistent results across sessions
- ✅ Minimal context consumption
- ✅ Can be shared in documentation

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

### Query Optimization

**Best practice: Use filters, not broad text searches**

```bash
# 🏆 BEST: Workspaces for frequent searches (most efficient)
short workspace "my-active-work"     # Pre-filtered, saved locally

# ✅ EXCELLENT: Filters only (no text search)
short search --owner "@me" --state "in-progress"
short search --project "backend" --state "review"

# ✅ GOOD: Text search WITH filters
short search "OAuth" --owner "@me" --state "started"
short search "payment bug" --project "backend"

# ⚠️ OK but less efficient: Text search with some filters
short search "authentication bug" --state "started"

# ❌ AVOID: Broad text searches (context-consuming)
short search "authentication"        # Could return 100+ results
short search "bug"                   # Way too many results
short search "feature"               # Extremely broad

# ❌ AVOID: Very broad single filters
short search --state "in-progress"   # Could be 50+ stories
```

**Workspace Setup (One-Time Cost, Infinite Reuse):**
```bash
# Create workspaces for common queries
short search -o "@me" -s "in-progress" -S "my-current-work"
short search --epic "User Management" -s "started" -S "auth-epic"
short search -p "backend" -s "review" -S "backend-reviews"

# List all saved workspaces
short workspace -l

# Use workspaces (efficient)
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
    [Executes: short search "OAuth authentication"]

PM: Found story sc-45678: "Add OAuth 2.0 authentication"
    [Executes: short story sc-45678]

PM: This story requires OAuth 2.0 with Google and GitHub providers.
    Let me create a GitHub issue for implementation.
    [Executes: gh issue create --title "Add OAuth 2.0 authentication" \
               --body "Implements Shortcut story sc-45678..."]

PM: Created GitHub issue #123. This requires investigation of OAuth libraries.
    Delegating to @research-specialist for technical approach.

RESEARCH: [Receives delegation]
          [Executes: short story sc-45678 for context]
          [Researches OAuth libraries]
          [Stores findings in remory]
          Returns: "Recommend authlib with PKCE flow. 3-day estimate."

PM: Thank you @research-specialist. Delegating implementation to
    @python-best-practices-architect with GitHub issue #123.

PYTHON: [Receives GitHub issue #123]
        [Implements OAuth with tests]
        [Delegates to @git-autonomous-agent for commit]

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
Analyze technical requirements, identify dependencies, recommend approach."

Research uses: short CLI + web research + technical analysis
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

- `short *` - All Shortcut CLI commands (read-only queries)
- `gh issue view/list/create/edit` - GitHub issue management
- `remory *` - Memory operations for context storage

### Project Manager Must Delegate

- All `git` commands → @git-autonomous-agent
- All `gh pr` commands → @git-autonomous-agent
- All `gh run` commands → @git-autonomous-agent
- Code implementation → Specialist agents

### Research Specialist Can Use

- `short *` - All Shortcut CLI commands for investigation
- `remory *` - Store research findings
- Read-only analysis tools

### Git Autonomous Agent Can Use

- `short *` - Verify stories and gather details for commits
- All `git` commands - Full version control operations
- All `gh` commands - GitHub CLI including PRs and CI

## Remember

1. **Shortcut CLI only on work machine** - This instruction not loaded on personal config
2. **PM orchestrates, doesn't execute** - PM coordinates Shortcut↔GitHub, specialists implement
3. **Dual tracking** - Always include both GitHub issue and Shortcut story references
4. **Memory preservation** - Store Shortcut context in remory with `--infer false`
5. **Clean separation** - PM handles coordination, git-agent handles version control

This integration enables seamless workflow between Shortcut project management and GitHub development while maintaining clear agent boundaries and delegation patterns.
