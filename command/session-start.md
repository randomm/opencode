---
description: Initialize new coding session with full project context
agent: project-manager
---

🚨 **THIS IS A READ-ONLY RESEARCH TASK - NOT DEVELOPMENT WORK** 🚨

**CRITICAL INSTRUCTIONS:**
- ❌ DO NOT create GitHub issues
- ❌ DO NOT create feature branches
- ❌ DO NOT make any commits
- ❌ DO NOT push anything to remote
- ✅ READ-ONLY operations only (Glob, Read, Memory, Delegation)
- ✅ Gather context and report to user

This is a **session initialization task** exempt from GitHub workflow requirements.

═══════════════════════════════════════════════════════

You are starting a new coding session. Follow this MANDATORY protocol to establish project context:

═══════════════════════════════════════════════════════
PHASE 1: PROJECT IDENTIFICATION & MEMORY SEARCH
═══════════════════════════════════════════════════════

**Delegate to ANY bash-capable agent (e.g., @git-autonomous-agent):**

```
Please run these commands to set up project memory:

# Setup PROJECT_ID
export PROJECT_ID="$(cat .project-id 2>/dev/null || uuidgen | tee .project-id)"

# Search existing project memories
remory search "project context" --user-id "$PROJECT_ID" --limit 3
remory search "architecture" --user-id "$PROJECT_ID" --limit 3
remory search "recent work" --user-id "$PROJECT_ID" --limit 3
```

**Examples of what to look for in memory:**
- Project overview, technology stack, purpose
- Architecture patterns and design decisions
- Recent issues worked on, current status
- Development conventions and preferences

**If memory exists**: Use it as baseline context
**If no memory**: Continue to gather fresh context in following phases

═══════════════════════════════════════════════════════
PHASE 2: DOCUMENTATION REVIEW (READ-ONLY TOOLS)
═══════════════════════════════════════════════════════

**Use Glob to discover documentation (flexible patterns):**

**MANDATORY reads:**
1. `CLAUDE.md` - Project-specific instructions for AI agents
2. `README.md` - Project overview and setup

**OPTIONAL - Use Glob to discover what exists:**
3. **Contributing guides**: `**/*contribut*.md` (e.g., CONTRIBUTING.md, CONTRIBUTION_GUIDE.md, docs/contributing.md)
4. **Testing docs**: `**/*test*convention*.md`, `**/TEST*.md` (e.g., TESTING_CONVENTIONS.md, docs/testing.md)
5. **Architecture docs**: `**/*architecture*.md`, `**/ARCHITECTURE.md` (e.g., docs/architecture.md, ARCHITECTURE.md)
6. **Convention docs**: `**/*convention*.md`, `**/*standard*.md` (e.g., docs/conventions.md, coding-standards.md)

**Approach:**
- Use Glob patterns to find files, not hardcoded paths
- Read what exists, skip what doesn't
- Be flexible - projects name files differently
- Use Read tool for file contents

**Use Glob/Read tools only** - No bash commands for reading files

═══════════════════════════════════════════════════════
PHASE 3: GITHUB CONTEXT (DELEGATION REQUIRED)
═══════════════════════════════════════════════════════

**YOU CANNOT ACCESS GITHUB DIRECTLY - DELEGATE TO @git-autonomous-agent**

Delegate with this EXACT request format:

```
@git-autonomous-agent: Gather GitHub project context

Please collect the following using gh CLI:

1. Open issues (last 20):
   gh issue list --limit 20 --json number,title,state,createdAt,labels

2. Recently closed issues (last 10):
   gh issue list --state closed --limit 10 --json number,title,closedAt

3. Open pull requests:
   gh pr list --json number,title,state,createdAt

4. Recent commits (last 10):
   git log --oneline -10

5. CI/CD status for main branch:
   gh run list --branch main --limit 5 --json status,conclusion,name,createdAt

Return all results in a structured format for memory storage.
```

**WAIT for @git-autonomous-agent response before continuing**

═══════════════════════════════════════════════════════
PHASE 4: MEMORY UPDATE (REQUIRED)
═══════════════════════════════════════════════════════

**Delegate to ANY bash-capable agent (e.g., @git-autonomous-agent) to store memories:**

Provide natural language summaries for the agent to store using remory CLI:

```
Please store the following project context in memory using remory CLI:

# Ensure PROJECT_ID is set
export PROJECT_ID="$(cat .project-id 2>/dev/null || uuidgen | tee .project-id)"

# Store project overview
remory add "Project: {name} - {description from README}. Stack: {technologies}. Purpose: {main purpose}" --user-id "$PROJECT_ID"

# Store architecture insights
remory add "Architecture: {key architectural patterns from docs}. {Design decisions noted}" --user-id "$PROJECT_ID"

# Store current status
remory add "Status: {X} open issues, {Y} open PRs. Recent: {brief recent activity from git log}" --user-id "$PROJECT_ID"

# Store any conventions found
remory add "Conventions: {testing requirements, code standards, workflow patterns from docs}" --user-id "$PROJECT_ID"
```

**What to store (examples, not prescriptions):**
- Project overview: name, description, technology stack, purpose
- Architecture: patterns, design decisions, component structure
- Current status: open issues, PRs, recent commits, CI/CD state
- Conventions: testing requirements, code standards, workflow preferences
- Anything else important for context continuity

**Format**: Natural language descriptions, not structured entities
**Tool**: remory CLI via bash-capable agent delegation

═══════════════════════════════════════════════════════
PHASE 5: CONTEXT SUMMARY (REPORT TO USER)
═══════════════════════════════════════════════════════

Provide a CONCISE summary (5-8 lines maximum):

```
📋 **Project**: {name} ({type})
🔧 **Stack**: {technologies}
📊 **Status**: {X} open issues, {Y} open PRs
🏗️  **Recent**: {brief recent activity}
✅ **Ready**: Context loaded, awaiting your instructions
```

═══════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════

**DO:**
- Use Glob/Read for local file reading with flexible patterns
- Delegate to @git-autonomous-agent (or any bash-capable agent) for:
  - ALL GitHub operations (gh CLI)
  - ALL memory operations (remory CLI)
- Search memory FIRST before gathering new context
- Store ALL gathered context in memory via delegation for session continuity
- Use natural language for memory storage (not structured entities)
- Keep summary brief and actionable

**DO NOT:**
- Use GitHub API directly (https://api.github.com)
- Use WebFetch for GitHub data
- Delegate to @research-specialist for memory operations (no bash access)
- Use Perplexity for local project information
- Run bash commands yourself (you have no bash access)
- Use hardcoded filenames - use Glob patterns to discover files
- Use MCP memory entity syntax - use remory CLI natural language
- Provide verbose explanations (be concise)

═══════════════════════════════════════════════════════

After completing this protocol, you are ready to receive the user's task.
