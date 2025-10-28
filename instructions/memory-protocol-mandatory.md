# Mandatory Memory Protocol for All Agents

**This protocol is MANDATORY for ALL agents (primary and subagents) without exception.**

## Core Principle

The MCP memory server is the **primary mechanism for continuity** across:
- Agent sessions (same agent, different invocations)
- Agent handoffs (different agents, same project)
- Project evolution (knowledge accumulation over time)

Every agent MUST use memory as their external persistent brain for project context.

## Three-Phase Memory Workflow (MANDATORY)

### Phase 1: SEARCH (Before ANY work)

**REQUIRED AT SESSION START:**

1. **For MCP Memory Tool (most agents):**
   ```
   # MCP tool automatically handles user IDs, no PROJECT_ID needed
   mcp_memory_search_nodes("project_name project context architecture")
   mcp_memory_search_nodes("project_name current work active tasks")
   mcp_memory_search_nodes("project_name session state")
   ```

2. **For Remory CLI (project-manager agent ONLY):**
   ```bash
   remory search "project context" --user-id "$(cat .project-id 2>/dev/null || (uuidgen | tee .project-id))" --limit 3
   ```

   **CRITICAL:** Use inline `$(cat .project-id ...)` pattern in `--user-id` argument. DO NOT use separate `export PROJECT_ID=...` commands as environment variables don't persist between bash tool invocations.

3. **Search Domain-Specific Context (MANDATORY - PER AGENT TYPE):**
   - Each agent searches for their domain-specific memories
   - Examples in agent-specific sections below
   - Leverage Remory's semantic search for pattern matching

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

1. **Store Work Outcomes:**
   ```
   mcp_memory_create_entities([{
     "name": "${PROJECT_ID}_<DOMAIN>_<DESCRIPTION>",
     "entityType": "${PROJECT_ID}_<CATEGORY>",
     "observations": [
       "Project: ${PROJECT_ID}",
       "Agent: <agent-name>",
       "Task: <task-description>",
       "Outcome: <what-was-accomplished>",
       "Lessons: <what-was-learned>",
       "Timestamp: <ISO-8601-datetime>"
     ]
   }])
   ```

2. **Update Session State:**
   ```
   mcp_memory_add_observations({
     "entityName": "${PROJECT_ID}_session_state",
     "observations": [
       "Last work: <brief-description>",
       "Status: <current-project-status>",
       "Next focus: <what-comes-next>"
     ]
   })
   ```

3. **Document Patterns (if applicable):**
   - Successful approaches for similar future tasks
   - Anti-patterns to avoid
   - Integration patterns with other agents
   - Performance optimizations discovered

**PROHIBITION:**
- NEVER complete work without storing findings
- NEVER lose context that future sessions need
- NEVER skip memory storage "because task was small"

## Project-Scoped Memory Architecture

### Mandatory Naming Convention

**ALL memory operations MUST use project-scoped identifiers:**

```
Entity Names: ${PROJECT_ID}_<component>_<description>
Entity Types: ${PROJECT_ID}_<category>
Search Queries: ${PROJECT_ID} <context>
```

**Examples:**
```
myapp_python_testing_config
myapp_ci_cd_pipeline
blog_site_deployment_strategy
api_service_database_schema
```

### Universal Entity Categories

Available for all agents (with PROJECT_ID prefix):

- `_project_context` - Overall project architecture and state
- `_session_state` - Current session focus and active work
- `_architectural_decision` - Design choices and rationale
- `_integration_pattern` - Cross-component coordination
- `_lessons_learned` - Problems solved and patterns discovered
- `_active_tasks` - Current work items and dependencies
- `_agent_handoff` - Context passed between agents
- `_quality_gate_result` - Test/lint/review outcomes

### Remory-Specific Capabilities

Leverage Remory's advanced features:

1. **Semantic Search:** Find relevant patterns even with different wording
2. **Knowledge Graph:** Track complex relationships between entities
3. **LLM Consolidation:** Automatically organize similar memories
4. **Conflict Resolution:** Intelligently merge conflicting observations
5. **Multi-Agent Concurrency:** Safe parallel access across agents

## Agent-Specific Memory Responsibilities

### Primary Agent (project-manager)

**SEARCH FOR:**
- `${PROJECT_ID}_delegation_patterns` - Successful routing decisions
- `${PROJECT_ID}_coordination_history` - Multi-agent workflows
- `${PROJECT_ID}_quality_gate_results` - Testing/linting outcomes
- `${PROJECT_ID}_agent_performance` - Specialist effectiveness

**STORE:**
- Every delegation decision with rationale
- Cross-agent coordination patterns
- Quality gate results and trends
- Project-wide architectural decisions

### Specialist Agents (All Subagents)

**SEARCH FOR:**
- `${PROJECT_ID}_<domain>_config` - Domain-specific configuration
- `${PROJECT_ID}_<domain>_patterns` - Proven approaches
- `${PROJECT_ID}_<domain>_issues` - Known problems and solutions
- `${PROJECT_ID}_agent_handoff` - Context from previous agents

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
