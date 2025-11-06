# Memory Management Protocol with Remory CLI

**This document covers both WHEN/WHY to use memory (protocol) and HOW to use Remory CLI (commands).**

Remory is the **primary mechanism for continuity** across agent sessions, handoffs, and project evolution.

---

## Part 1: Memory Protocol (Mandatory)

### Core Principle
Every agent MUST use memory as external persistent brain for project context.

### Three-Phase Memory Workflow

#### Phase 1: SEARCH (Before ANY work)
**Purpose:** Load existing project context before starting work

**REQUIRED AT SESSION START:**
```bash
remory search "project context" --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --limit 3
remory search "current work" --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --limit 3
```

**CRITICAL:** Use inline `$(cat .project-id ...)` pattern. DO NOT use separate `export PROJECT_ID=...` commands as environment variables don't persist between bash tool invocations.

**PROHIBITION:**
- NEVER begin work without searching project memory first
- NEVER assume clean slate - always load existing context
- NEVER skip memory search "to save time"

#### Phase 2: WORK (During task execution)
**CONTINUOUS MEMORY UPDATES:**
Track important findings as you work:
- Architectural decisions made and WHY
- Problems discovered and solutions found
- Patterns that prove successful
- Blockers encountered

**BEST PRACTICES:**
- Use Remory's LLM-powered consolidation for similar findings
- Create relations between related entities for knowledge graph
- Update last_accessed timestamp in observations
- Store memories incrementally, not just at end

#### Phase 3: STORE (After work completion)
**REQUIRED BEFORE COMPLETION:**

Store work outcomes:
```bash
remory add "Project: ${PROJECT_ID}. Agent: <agent-name>. Task: <task-description>. 
Outcome: <what-was-accomplished>. Lessons: <what-was-learned>. 
Successful approaches: <patterns>. Blockers: <any issues encountered>." \
--user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --infer false
```

**Document in storage:**
- Successful approaches for similar future tasks
- Anti-patterns to avoid
- Integration patterns with other agents
- Problems solved and solutions implemented
- Performance optimizations discovered

**PROHIBITION:**
- NEVER complete work without storing findings
- NEVER lose context that future sessions need
- NEVER skip memory storage "because task was small"

---

## Part 2: Remory CLI Reference

### Quick Command Reference

**Search (semantic, use this primarily):**
```bash
remory search "query about project" --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --limit 5
```

**Get (retrieve full memory by ID):**
```bash
remory get --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" <memory-id>
```

**Store (with auto-consolidation):**
```bash
remory add "Natural language description of what you learned" \
--user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --infer false
```

**List (avoid - use search instead):**
```bash
remory list --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --limit 20
```

### When to Remember
- Architecture decisions and why
- Solutions to problems encountered
- Performance optimizations that worked
- Testing/linting configurations
- Things to avoid (anti-patterns)
- Integration patterns with other components

### Natural Language Format
No entity types or structured data needed. Just plain text:
- "Decision: Using PostgreSQL because ACID + JSON support needed"
- "Pattern: Repository pattern with DI for testability"
- "Avoid: N+1 queries - use eager loading instead"

### Auto-Consolidation
The `--infer false` flag disables auto-consolidation. When enabled, Remory's LLM automatically:
- Extracts facts from your text
- Merges with similar existing memories
- Removes duplicates automatically

### Environment Requirements
- `DATABASE_URL`: PostgreSQL connection (required)
- `OPENAI_API_KEY`: For LLM consolidation (optional, recommended)
- `remory` CLI in PATH

---

## Part 3: Project-Scoped Memory Architecture

### Mandatory Naming Convention

ALL memory operations MUST use project-scoped identifiers:
```
Search Queries: ${PROJECT_ID} <context>
Memory Content: "Project: ${PROJECT_ID}. [Details]"
```

**Examples:**
```
Project: myapp. Python testing configuration...
Project: myapp. CI/CD pipeline setup...
Project: blog_site. Deployment strategy...
Project: api_service. Database schema design...
```

### Remory Capabilities

Leverage Remory's advanced features:
1. **Semantic Search:** Find relevant patterns even with different wording
2. **Knowledge Graph:** Track complex relationships between memories
3. **LLM Consolidation:** Automatically organize similar memories
4. **Conflict Resolution:** Intelligently merge conflicting observations
5. **Multi-Agent Concurrency:** Safe parallel access across agents

---

## Part 4: Agent-Specific Memory Responsibilities

### Primary Agent (project-manager)

**SEARCH FOR:**
- Delegation patterns and successful routing decisions
- Multi-agent coordination history and workflows
- Quality gate results and testing/linting outcomes
- Agent performance and specialist effectiveness

**STORE:**
- Every delegation decision with rationale
- Cross-agent coordination patterns
- Quality gate results and trends
- Project-wide architectural decisions

### Specialist Agents (All Subagents)

**SEARCH FOR:**
- Domain-specific configuration and setup
- Proven approaches and patterns for your domain
- Known problems and solutions encountered
- Context from previous agents working on this project

**STORE:**
- Domain-specific configurations and decisions
- Solutions to technical problems encountered
- Patterns that proved effective
- Context for next agent in workflow

---

## Part 5: Troubleshooting

### Environment Variable Persistence Issues

**Problem:** `export PROJECT_ID=...` doesn't work across bash tool calls

**Explanation:** Each bash tool invocation is a fresh shell session. Variables exported in one call don't persist to the next call.

**Solution:** Use inline command substitution pattern:
```bash
remory add "..." --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))"
```

### Permission Errors

**If remory fails with "permission denied":**
1. Verify .project-id exists: `cat .project-id`
2. If missing, inline pattern creates it automatically
3. Try hardcoded UUID: `--user-id "your-uuid-from-step-1"`
4. Check DATABASE_URL environment variable is set

### Memory Search Returning Nothing

**Common causes:**
- Wrong project ID used
- Memory not stored in previous sessions
- Search query too specific

**Solutions:**
- Use broader search terms
- Check .project-id matches previous sessions
- Use `remory list` to browse all memories

---

## Part 6: Compliance Verification

**Self-Check Questions (Every Agent, Every Session):**
1. ✓ Did I search project memory before starting work?
2. ✓ Did I load my domain-specific context?
3. ✓ Am I storing important findings as I work?
4. ✓ Will I store complete outcomes before completing?
5. ✓ Are all my memory operations project-scoped?

### Quality Gate Integration
- Memory protocol compliance is a quality requirement
- Work is incomplete without proper memory storage
- Future sessions depend on your memory discipline

### Enforcement

**THIS IS NOT OPTIONAL:**
- Memory protocol violations are equivalent to quality gate violations
- Agents that skip memory operations create context loss
- Context loss cascades across sessions and agents
- Memory discipline is a core competency requirement

**Zero Tolerance:**
- No work begins without memory search
- No work completes without memory storage
- No exceptions for "small tasks"
- No assumptions about "fresh start"

---

**Remember:** You are not alone. Your work builds on past sessions and informs future ones. Memory is how we achieve compound intelligence across time and agents.
