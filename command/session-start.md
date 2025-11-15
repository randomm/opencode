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

**🎯 YOUR ROLE**: You are the orchestrator. Use read-only tools (Glob, Read, remory CLI) and delegate to @git-agent for GitHub operations. Do NOT execute tasks directly.

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

**MANDATORY - Discover and read (Priority Order):**

1. **README.md** - Project overview and setup
   - Pattern: `README.md` (root), `docs/README.md`
   - This is your primary source of project understanding

2. **Project-specific AI/agent instructions** - If they exist:
   - Patterns to discover: `CLAUDE.md`, `AGENTS.md`, `.claude/**/*.md`, `.github/AGENT*.md`
   - These define how AI agents should work with this project
   - Use Glob: Look for `CLAUDE.md` OR `AGENTS.md` OR patterns in `.claude/` OR `.github/`
   - Example: `glob: "CLAUDE.md"` or `glob: "AGENTS.md"` or `glob: ".claude/**/*.md"` or `glob: ".github/AGENT*.md"`
   - **Don't assume these exist** - skip if not found

3. **Project workflow and contribution guidelines (optional - fallback to AGENTS.md):**
    - Patterns to discover: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/contributing.md`, `.github/CONTRIBUTING.md`
   - Use Glob: `CONTRIBUTING.md` or `glob: "docs/contributing.md"` or `glob: ".github/CONTRIBUTING.md"`
   - These files define:
     - Commit message conventions
     - PR process and review requirements
     - Communication style and tone
     - Quality gates and testing requirements
     - Branch naming and workflow
    - **CRITICAL**: You must understand the workflow before doing any work
    - If found: Read in full. If not found: Extract workflow from AGENTS.md instead

**IMPORTANT:** Many projects use AGENTS.md as comprehensive workflow documentation instead of CONTRIBUTING.md. If CONTRIBUTING.md doesn't exist, extract all workflow information (commit formats, PR process, branch naming, communication style) from AGENTS.md for memory storage in Phase 4.

**OPTIONAL - Discover if they exist (Priority Order):**

4. **Testing conventions:**
   - Patterns: `TESTING.md`, `docs/testing.md`, `test/README.md`, `tests/README.md`
   - Use Glob: `TESTING.md` or `glob: "docs/testing.md"` or `glob: "test{s,}/README.md"`
   - Defines test requirements, coverage targets, testing approach

5. **Architecture and technical documentation:**
   - Patterns: `ARCHITECTURE.md`, `docs/architecture.md`, `docs/design.md`, `docs/technical-specification.md`
   - Use Glob: `glob: "docs/{architecture,design,technical-specification}.md"` or `ARCHITECTURE.md`
   - Explains system design, patterns, technical decisions

6. **Coding standards and conventions:**
   - Patterns: `STANDARDS.md`, `docs/conventions.md`, `style-guide.md`, `.editorconfig`
   - Use Glob: `glob: "docs/conventions.md"` or `STANDARDS.md`
   - Defines language-specific standards, naming, formatting

7. **GitHub-specific documentation:**
   - Patterns: `.github/*.md` (EXCLUDE workflow files in `.github/workflows/`)
   - Examples: `AGENT_PROTOCOLS.md`, `CI_IMPLEMENTATION_SUMMARY.md`, `CI_MONITORING_PROTOCOLS.md`
   - Use Glob: `glob: ".github/*.md"` (skip `.github/workflows/`)
   - Contains agent coordination patterns, CI/CD documentation

8. **Infrastructure patterns** (for DevOps/infrastructure projects):
   - Check for these directories: `config/`, `lib/`, `scripts/`
   - Use List: Check if directories exist with `list: "config/"`, `list: "lib/"`, `list: "scripts/"`
   - If 2+ directories exist: Note "Infrastructure project - review configs"
   - Pattern examples: `docs/blue-green-deployment.md`, `docs/s3-setup-guide.md`

**Discovery Approach (Use These Tools):**

1. **Start with mandatory files:**
   ```
   Read: README.md
   Glob: "CLAUDE.md" (if missing, try "AGENTS.md")
   Glob: "CONTRIBUTING.md"
   ```

2. **Check for agent-specific documentation:**
   ```
   Glob: ".claude/**/*.md"
   Glob: ".github/AGENT*.md" or ".github/CI*.md" (exclude workflows/)
   ```

3. **Discover documentation directories:**
   ```
   List: docs/
   If exists, Glob: "docs/*.md"
   Prioritize: docs/contributing.md, docs/testing.md, docs/architecture.md
   ```

4. **Check for infrastructure patterns:**
   ```
   List: config/, lib/, scripts/
   If 2+ exist: Note "Infrastructure project - review deployment configs"
   ```

**File Discovery Order:**
1. README.md (mandatory)
2. AGENTS.md or CLAUDE.md (try both - if neither exists, continue)
3. CONTRIBUTING.md (optional - use AGENTS.md if missing)
4. docs/*.md (prioritize: testing, architecture, technical-specification)
5. .github/*.md excluding workflows/ (if present)
6. .claude/**/*.md (if present)

**Use Glob/Read/List tools only** - No bash commands for reading files

═══════════════════════════════════════════════════════
PHASE 3: GITHUB CONTEXT (DELEGATION REQUIRED)
═══════════════════════════════════════════════════════

**YOU CANNOT ACCESS GITHUB DIRECTLY - DELEGATE TO @git-agent**

Delegate with this EXACT request format:

```
@git-agent: Gather GitHub project context

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

**WAIT for @git-agent response before continuing**

═══════════════════════════════════════════════════════
⚠️  CRITICAL: REMORY TOKEN LIMITS
═══════════════════════════════════════════════════════

**Embedding Model Constraints:**
- Model: sentence-transformers/all-MiniLM-L6-v2
- Default max: 256 tokens (~1,000 characters)
- Hard limit: 512 tokens (~2,000 characters)
- Token ratio: ~1 token per 4 characters (English)

**Safe Memory Size:**
- Target: 800-1,000 characters per memory entry
- Token equivalent: 200-250 tokens (safely under limit with margin)
- Each memory must be semantically complete and independently searchable

**Chunking Strategy:**
Store multiple focused memories instead of one large memory. Split naturally by topic:
- Commit conventions
- GitHub workflow
- PR process
- Quality gates
- Testing requirements
- Memory protocol

═══════════════════════════════════════════════════════
PHASE 4: MEMORY UPDATE (MANDATORY)
═══════════════════════════════════════════════════════

**🔥 CRITICAL: STORE ALL CONTEXT IN MEMORY - THIS IS NON-NEGOTIABLE! 🔥**

**Store project context using remory CLI with --infer false to preserve full detail:**

**Use multi-memory chunking strategy:** Store 5-7 focused memories (800-1,000 chars each) instead of single large memory. This prevents "Failed to generate embedding" errors from exceeding token limits.

```bash
# Memory 1: Project Overview (Keep project basics together, ~800-900 chars max)
remory add "Project: {name} - {concise description}. Stack: {technology stack with versions}. Purpose: {main purpose}. Key features: {main features list}. Architecture: {high-level patterns}. Components: {main components}." --user-id "$PROJECT_ID" --infer false

# Memory 2: Current Status (Project activity snapshot, ~800-900 chars max)
remory add "Status: {X} open issues, {Y} open PRs. Recent commits: {recent activity from git log with commit messages}. CI/CD: {current CI state}. Active work: {current focus areas}." --user-id "$PROJECT_ID" --infer false

# Memory 3: Commit Conventions (If found in CONTRIBUTING.md or AGENTS.md, ~800-900 chars)
remory add "Commit standards and conventions. Use Conventional Commits format: type(scope): description. Types: feat, fix, docs, style, refactor, test, chore, build, ci, perf. Include GitHub issue reference: 'feat: add auth (#123)'. Always atomic changes. Clear descriptions. Present tense, imperative mood. First line <50 chars. Examples from project docs: {examples from CONTRIBUTING/AGENTS}." --user-id "$PROJECT_ID" --infer false

# Memory 4: GitHub Issue Workflow (If found in CONTRIBUTING.md or AGENTS.md, ~800-900 chars)
remory add "GitHub issue workflow and quality template. Every development issue requirements: {list checkboxes from docs - TDD, coverage, linting, etc.}. Validate issue content with 'gh issue view'. All work matches issue exactly. Refuse work not listed. Update issue before expanding scope. Complete only when all checkboxes done. {Additional workflow details from docs}." --user-id "$PROJECT_ID" --infer false

# Memory 5: PR & Review Process (If found in CONTRIBUTING.md or AGENTS.md, ~800-900 chars)
remory add "Pull request and CI verification process. Feature branch workflow: {branch naming conventions from docs}. PR requirements: {title format, description requirements}. Review process: {approval requirements, self-merge policy}. CI verification: {commands used - gh run watch, monitoring requirements}. Merge strategy: {squash/merge/rebase from docs}." --user-id "$PROJECT_ID" --infer false

# Memory 6: Quality Gates & Testing (If found in CONTRIBUTING.md or AGENTS.md, ~800-900 chars)
remory add "Quality gates and testing requirements. Zero-tolerance policy: {suppression rules from docs}. Coverage requirements: {thresholds - 80%+, per-file vs overall}. Linting: {commands and requirements}. Type checking: {requirements}. Testing approach: {TDD requirements, test patterns, mocking strategies from docs}. Local verification: {what must pass before completion}." --user-id "$PROJECT_ID" --infer false

# Memory 7: Communication & Philosophy (If found in CONTRIBUTING.md or AGENTS.md, ~800-900 chars)
remory add "Communication style and development philosophy. Tone: {professional, concise, etc. from docs}. Minimalist principles: {LESS IS MORE, challenge necessity, etc. from docs}. Code quality: {standards from docs}. Documentation: {when to create, approval requirements}." --user-id "$PROJECT_ID" --infer false
```

**CRITICAL:** Use `--infer false` to preserve FULL TEXT without LLM extraction/shortening.

**Store comprehensive context using MULTIPLE focused memories (800-1,000 chars each):**

**Core Project Info (2 memories):**
- Memory 1: Project overview - name, description, stack, purpose, architecture, components
- Memory 2: Current status - open issues, PRs, recent commits, CI/CD state, active work

**Workflow Documentation (5-6 memories from CONTRIBUTING.md or AGENTS.md):**
- Memory 3: Commit conventions - format, types, examples, issue references
- Memory 4: GitHub issue workflow - quality template, checkboxes, scope control
- Memory 5: PR & review process - branch naming, PR requirements, CI verification
- Memory 6: Quality gates & testing - coverage, linting, TDD, local verification
- Memory 7: Communication & philosophy - tone, minimalist principles, standards

**Chunking Guidelines:**
- Each memory: 800-1,000 characters (safely under 256-token embedding limit with margin)
- Semantically complete: Each memory understandable independently
- Topic-focused: One coherent concept per memory
- Searchable: Use clear topic names for future retrieval
- Natural boundaries: Split at logical sections, not mid-paragraph

**Why Chunking:**
Remory's embedding model (sentence-transformers/all-MiniLM-L6-v2) enforces 256-token default limit (200-250 tokens safe with margin = 800-1,000 chars). Long texts (2,500+ chars = 600+ tokens) fail with "Failed to generate embedding" errors. Multiple focused memories succeed where single large memory fails.

**Why this matters:**
- ✅ Each memory successfully embeds (under token limits)
- ✅ Semantically searchable across separate memories
- ✅ Future agents find relevant concepts easily
- ✅ Easier to update individual topics
- ✅ Reduces cognitive load (focused topics vs sprawling docs)
- ✅ Prevents embedding failures that block session initialization

═══════════════════════════════════════════════════════
PHASE 5: SUCCESS VERIFICATION & SUMMARY
═══════════════════════════════════════════════════════

**SESSION READY CHECKLIST:**
- [x] PROJECT_ID established
- [x] Memory searched with specific queries
- [x] Documentation reviewed (README, agent instructions if present, conventions)
- [x] GitHub context gathered via @git-agent
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
- Delegate to @git-agent for ALL GitHub operations (gh CLI)
- **Use remory CLI DIRECTLY - YOU HAVE ACCESS**
- Search memory FIRST with specific semantic queries
- Store ALL gathered context with `--infer false` to preserve full detail
- Use detailed, comprehensive descriptions (not summaries)
- Split large memories into focused chunks (800-1,000 chars each)
- Verify each memory is semantically complete and independently searchable
- Use natural topic boundaries (commit conventions, PR process, quality gates)
- Update TodoWrite after each phase
- Keep user summary brief and actionable

**DO NOT:**
- Use `--infer true` or omit `--infer` flag (defaults to true, shortens memories)
- Use vague search queries like "recent work" or "project context"
- Use GitHub API directly (https://api.github.com)
- Use WebFetch for GitHub data
- Use Perplexity for local project information
- **Use hardcoded filenames** - ALWAYS use Glob patterns to discover files (e.g., don't assume CLAUDE.md exists)
- Assume documentation structure - adapt to what the project actually has
- Skip files that don't exist - read what's there, not what you expect
- Skip memory storage - it's MANDATORY for session continuity
- Store memories exceeding 1,000 characters (risk embedding failure)
- Create single large "Project workflow" memory (will fail at 2,500+ chars)
- Split mid-paragraph or mid-sentence (breaks semantic coherence)

═══════════════════════════════════════════════════════

After completing this protocol, you are ready to receive the user's task.
