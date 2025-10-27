# Remory CLI Reference for AI Agents

## Quick Commands

**Project ID (once per session):**
```bash
export PROJECT_ID="$(cat .project-id 2>/dev/null || uuidgen | tee .project-id)"
```

**Search (semantic, use this primarily):**
```bash
remory search "query about project" --user-id "$PROJECT_ID" --limit 5
```

**Get (retrieve full memory by ID):**
```bash
remory get --user-id "$PROJECT_ID" <memory-id>
```
Use this to retrieve the full content of a specific memory found via search.

**Store (auto-consolidation enabled):**
```bash
remory add "Natural language description of what you learned" --user-id "$PROJECT_ID" --infer false
```

**List (avoid, use search instead):**
```bash
remory list --user-id "$PROJECT_ID" --limit 20
```

## When to Remember

- Architecture decisions and why
- Solutions to problems encountered
- Performance optimizations that worked
- Testing/linting configurations
- Things to avoid (anti-patterns)
- Integration patterns with other components

## Natural Language Format

No entity types or structured data needed. Just plain text:
- "Decision: Using PostgreSQL because ACID + JSON support needed"
- "Pattern: Repository pattern with DI for testability"
- "Avoid: N+1 queries - use eager loading instead"

## Auto-Consolidation

The `--infer` flag (default: true) uses LLM to:
- Extract facts from your text
- Merge with similar existing memories
- Remove duplicates automatically

## Environment Requirements

- `DATABASE_URL`: PostgreSQL connection (required)
- `OPENAI_API_KEY`: For LLM consolidation (optional, recommended)
- `remory` CLI in PATH

See remory documentation for advanced usage.
