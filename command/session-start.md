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

**🎯 YOUR ROLE**: You are the orchestrator. Use read-only tools (Glob, Read, remory CLI) and delegate to @git-autonomous-agent for GitHub operations. Do NOT execute tasks directly.

**📋 Track progress with TodoWrite:**
```
Session initialization: memory search → docs → GitHub → memory storage → summary
```

═══════════════════════════════════════════════════════
PHASE 1: PROJECT IDENTIFICATION & MEMORY SEARCH
═══════════════════════════════════════════════════════

**🔥 CRITICAL: YOU HAVE DIRECT REMORY CLI ACCESS - USE IT! 🔥**

**Setup PROJECT_ID and search memory:**

```bash
export PROJECT_ID="$(cat .project-id 2>/dev/null || uuidgen | tee .project-id)"
```

**Then search project memories with SPECIFIC semantic queries:**
```bash
remory search "what is this project technology stack purpose" --user-id "$PROJECT_ID" --limit 3
remory search "architecture patterns design decisions components" --user-id "$PROJECT_ID" --limit 3
remory search "coding standards quality gates testing requirements" --user-id "$PROJECT_ID" --limit 3
remory search "contribution guidelines workflow conventions" --user-id "$PROJECT_ID" --limit 3
```

**What to look for in memory (examples):**
- Project overview, technology stack, purpose
- Architecture patterns and design decisions
- Recent issues worked on, current status
- Development conventions and preferences
- Past solutions, patterns, and learnings

**If memory exists**: Use it as baseline context - DON'T repeat work already done
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
PHASE 4: MEMORY UPDATE (MANDATORY)
═══════════════════════════════════════════════════════

**🔥 CRITICAL: STORE ALL CONTEXT IN MEMORY - THIS IS NON-NEGOTIABLE! 🔥**

**Store project context using remory CLI with --infer false to preserve full detail:**

```bash
# Store project overview (DETAILED - preserve everything from README)
remory add "Project: {name} - {full description from README including all key features}. Stack: {complete technology stack with versions}. Purpose: {main purpose and goals}. Key features: {list main features}" --user-id "$PROJECT_ID" --infer false
```
```bash
# Store architecture insights (DETAILED - preserve all patterns and decisions)
remory add "Architecture: {detailed architectural patterns from docs}. Design decisions: {all key decisions with rationale}. Components: {component structure and interactions}. Data flow: {how data flows through system}" --user-id "$PROJECT_ID" --infer false
```
```bash
# Store current status (DETAILED - preserve activity context)
remory add "Status: {X} open issues, {Y} open PRs. Recent commits: {detailed recent activity from git log including commit messages}. CI/CD: {current CI state and any issues}" --user-id "$PROJECT_ID" --infer false
```
```bash
# Store conventions (DETAILED - preserve all standards and requirements)
remory add "Coding standards: {complete coding standards from docs}. Testing requirements: {all testing requirements including coverage targets}. Quality gates: {all quality gates that must pass}. Workflow: {development workflow patterns and conventions}. Contribution guidelines: {key contribution guidelines}" --user-id "$PROJECT_ID" --infer false
```

**CRITICAL:** Use `--infer false` to preserve FULL TEXT without LLM extraction/shortening.

**What to store (be COMPREHENSIVE):**
- Project overview: name, complete description, full technology stack with versions, purpose, key features
- Architecture: all patterns, all design decisions with rationale, component structure, data flow
- Current status: open issues, PRs, detailed recent commits, CI/CD state
- Conventions: complete coding standards, all testing requirements, all quality gates, workflow patterns
- Recent learnings: detailed solutions found, patterns discovered, decisions made with context
- **Everything important for future sessions** - be thorough, not summary!

**Why this matters:**
- Future sessions get FULL context immediately, not extracted facts
- Prevents repeating research and discovery
- Builds institutional knowledge across sessions with full detail
- Enables continuity and consistency

═══════════════════════════════════════════════════════
PHASE 5: SUCCESS VERIFICATION & SUMMARY
═══════════════════════════════════════════════════════

**SESSION READY CHECKLIST:**
- [x] PROJECT_ID established
- [x] Memory searched with specific queries
- [x] Documentation reviewed (README, CLAUDE.md, conventions)
- [x] GitHub context gathered via @git-autonomous-agent
- [x] All context stored in memory with --infer false
- [x] TodoWrite tracking complete

**Provide CONCISE summary to user (5-8 lines maximum):**

```
📋 **Project**: {name} ({type})
🔧 **Stack**: {technologies}
📊 **Status**: {X} open issues, {Y} open PRs
🏗️  **Recent**: {brief recent activity}
✅ **Ready**: Context loaded, awaiting your instructions
```

═══════════════════════════════════════════════════════
AFTER INITIALIZATION - NEXT STEPS
═══════════════════════════════════════════════════════

**User will provide a task or question. When they do:**

1. **Use CLARIFICATION PROTOCOL** (from your system prompt):
   - Verify GitHub issue number or ask if you should create one
   - Confirm task type (research, planning, implementation)
   - Clarify scope boundaries and deliverables

2. **Search memory FIRST** before delegating:
   ```bash
   remory search "{relevant keywords from task}" --user-id "$PROJECT_ID" --limit 3
   ```

3. **Delegate to appropriate specialist** based on task domain

4. **Update memory DURING SESSION** as you learn:
   ```bash
   remory add "{new learning or decision}" --user-id "$PROJECT_ID" --infer false
   ```

═══════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════

**DO:**
- Use Glob/Read for local file reading with flexible patterns
- Delegate to @git-autonomous-agent for ALL GitHub operations (gh CLI)
- **Use remory CLI DIRECTLY - YOU HAVE ACCESS**
- Search memory FIRST with specific semantic queries
- Store ALL gathered context with `--infer false` to preserve full detail
- Use detailed, comprehensive descriptions (not summaries)
- Update TodoWrite after each phase
- Keep user summary brief and actionable

**DO NOT:**
- Use `--infer true` or omit `--infer` flag (defaults to true, shortens memories)
- Use vague search queries like "recent work" or "project context"
- Use GitHub API directly (https://api.github.com)
- Use WebFetch for GitHub data
- Use Perplexity for local project information
- Use hardcoded filenames - use Glob patterns to discover files
- Skip memory storage - it's MANDATORY for session continuity

═══════════════════════════════════════════════════════

After completing this protocol, you are ready to receive the user's task.
