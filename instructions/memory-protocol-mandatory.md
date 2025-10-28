# Mandatory Memory Protocol for All Agents

**This protocol is MANDATORY for ALL agents (primary and subagents) without exception.**

## Core Principle

Remory is the **primary mechanism for continuity** across:
- Agent sessions (same agent, different invocations)
- Agent handoffs (different agents, same project)
- Project evolution (knowledge accumulation over time)

Every agent MUST use memory as their external persistent brain for project context.

## Three-Phase Memory Workflow (MANDATORY)

### Phase 1: SEARCH (Before ANY work)

**REQUIRED AT SESSION START:**

Use Remory CLI for all memory operations:
```bash
remory search "project context" --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --limit 3
remory search "project_id current work" --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --limit 3
remory search "project_id domain-specific context" --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --limit 3
```

**CRITICAL:** Use inline `$(cat .project-id ...)` pattern. DO NOT use separate `export PROJECT_ID=...` commands as environment variables don't persist between bash tool invocations.

See `instructions/remory-cli-reference.md` for quick command reference.

**PROHIBITION:**
- NEVER begin work without searching project memory first
- NEVER assume clean slate - always load existing context
- NEVER skip memory search "to save time" - context is critical

### Phase 2: WORK (During task execution)

**CONTINUOUS MEMORY UPDATES:**

1. **Track Important Findings:**
   - Architectural decisions made
   - Problems discovered and solutions found
   - Patterns that prove successful
   - Blockers encountered

2. **Monitor Agent Interactions:**
   - Record delegation decisions (PM agent)
   - Document handoff context between agents
   - Track coordination patterns

3. **Maintain Session State:**
   - Current focus and active tasks
   - Dependencies and integration points
   - Work-in-progress status

**BEST PRACTICES:**
- Use Remory's LLM-powered consolidation for similar findings
- Create relations between related entities for knowledge graph
- Update `last_accessed` timestamp in observations
- Store memories incrementally, not just at end

### Phase 3: STORE (After work completion)

**REQUIRED BEFORE COMPLETION:**

Store work outcomes using Remory CLI:
```bash
remory add "Project: ${PROJECT_ID}. Agent: <agent-name>. Task: <task-description>. 
Outcome: <what-was-accomplished>. Lessons: <what-was-learned>. 
Successful approaches: <patterns>. Blockers: <any issues encountered>." \
--user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --infer false
```

Document in storage:
- Successful approaches for similar future tasks
- Anti-patterns to avoid
- Integration patterns with other agents
- Problems solved and solutions implemented
- Performance optimizations discovered

**PROHIBITION:**
- NEVER complete work without storing findings
- NEVER lose context that future sessions need
- NEVER skip memory storage "because task was small"

## Project-Scoped Memory Architecture

### Mandatory Naming Convention

**ALL memory operations MUST use project-scoped identifiers:**

```
Search Queries: ${PROJECT_ID} <context>
Memory Content: "Project: ${PROJECT_ID}. [Details]"
```

**Examples of memory content:**
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

## Agent-Specific Memory Responsibilities

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

## Compliance Verification

**Self-Check Questions (Every Agent, Every Session):**

1. ✓ Did I search project memory before starting work?
2. ✓ Did I load my domain-specific context?
3. ✓ Am I storing important findings as I work?
4. ✓ Will I store complete outcomes before completing?
5. ✓ Are all my memory operations project-scoped?

**Quality Gate Integration:**
- Memory protocol compliance is a quality requirement
- Work is incomplete without proper memory storage
- Future sessions depend on your memory discipline

## Enforcement

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
