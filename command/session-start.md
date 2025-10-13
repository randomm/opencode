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
PHASE 1: PROJECT IDENTIFICATION
═══════════════════════════════════════════════════════

1. **Detect Project ID**
   - Run: `basename $(pwd)` or extract from git config
   - Format: Use lowercase with hyphens (e.g., "cantoriam-app")

2. **Search Project Memory** (REQUIRED)
   - Search for: `{project-id}_project`
   - Search for: `{project-id}_architecture`
   - Search for: `{project-id}_conventions`
   - Search for: `{project-id}_active_issues`

   If memory exists: Use it as baseline context
   If no memory: Continue to gather fresh context

═══════════════════════════════════════════════════════
PHASE 2: DOCUMENTATION REVIEW (READ-ONLY TOOLS)
═══════════════════════════════════════════════════════

Read project documentation in this order (skip if file doesn't exist):

**MANDATORY reads:**
1. `CLAUDE.md` - Project-specific instructions for AI agents
2. `README.md` - Project overview and setup

**OPTIONAL reads (only if they exist):**
3. `TESTING_CONVENTIONS.md` - Testing standards
4. `CONTRIBUTING.md` - Development workflow
5. `docs/architecture.md` - System architecture
6. `docs/conventions.md` - Code conventions

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

Create/update memory entities with gathered information:

**Entity 1: Project Overview**
- Entity name: `{project-id}_project`
- Entity type: `project`
- Observations:
  - Project name and description (from README)
  - Technology stack
  - Main purpose
  - Setup instructions summary

**Entity 2: Architecture**
- Entity name: `{project-id}_architecture`
- Entity type: `architecture`
- Observations from CLAUDE.md/docs

**Entity 3: Active Issues**
- Entity name: `{project-id}_active_issues`
- Entity type: `issues`
- Observations: List of open issue numbers with titles

**Entity 4: Recent Activity**
- Entity name: `{project-id}_recent_activity`
- Entity type: `activity`
- Observations:
  - Last 5 commit messages
  - Recent PR activity
  - CI/CD status

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
- Use Glob/Read for local file reading
- Delegate to @git-autonomous-agent for ALL GitHub operations
- Search memory FIRST before gathering new context
- Store ALL gathered context in memory for session continuity
- Keep summary brief and actionable

**DO NOT:**
- Use GitHub API directly (https://api.github.com)
- Use WebFetch for GitHub data
- Delegate to @research-specialist for project context
- Use Perplexity for local project information
- Run bash commands yourself (you have no bash access)
- Provide verbose explanations (be concise)

═══════════════════════════════════════════════════════

After completing this protocol, you are ready to receive the user's task.
