# Conditional Rules System

## Overview

Language-specific rules are loaded from `.opencode/rules/` directory using glob patterns. These rules complement agent prompts with language-specific conventions and quality standards that apply universally across all agents.

## How Rules Are Loaded

OpenCode's `instructions` array in `opencode.*.json` includes:

```json
"instructions": [
  "instructions/memory-and-remory.md",
  "instructions/workflow-standards.md",
  "instructions/agent-responsibilities.md",
  "instructions/agent-output-protocol.md",
  "instructions/quality-standards.md",
  "instructions/tool-preferences.md",
  "instructions/context7-library-documentation.md",
  "instructions/shortcut-cli-awareness.md",
  "instructions/postgres-mcp-databases.md",
  "instructions/rollbar-mcp-integration.md",
  ".opencode/rules/*.md"
]
```

The `.opencode/rules/*.md` glob pattern loads all rule files from the rules directory.

## Rule File Guidelines

- **Location**: `.opencode/rules/{language}-{focus}.md`
- **Size**: Under 500 characters (token embedding limits)
- **Scope**: Language-specific conventions and quality standards
- **Format**: Markdown with clear, actionable rules
- **Precedence**: Loaded after global instructions, before agent-specific prompts

## Current Rules

**Language-Specific Quality Standards:**

- `python-quality.md` - Linting with ruff, type checking, pytest, docstrings
- `rust-safety.md` - Memory safety, clippy, unsafe block documentation
- `rails-conventions.md` - Rails Way, RSpec, strong parameters, N+1 prevention
- `go-idioms.md` - Go proverbs, table-driven tests, interface design
- `react-patterns.md` - Functional components, TypeScript strict mode, testing
- `shell-portability.md` - POSIX compliance, ShellCheck, variable quoting

## Adding New Rules

**Process:**

1. Create file in `.opencode/rules/` directory
2. Name: `{language}-{focus}.md` (e.g., `python-quality.md`)
3. Content: Actionable rules for that language/context
4. Size: Keep under 500 characters
5. Both configs auto-load: No manual updating needed

**Example Rule File Structure:**

```markdown
# Language Name Rules

When working with [language] files ([extensions]):
- First principle/guideline
- Second principle/guideline
- Third principle/guideline
- Zero tolerance items (quality gates, suppressions)
```

## Architecture: Dual-Config Design

Both `opencode.work.json` and `opencode.personal.json` load the same rules directory. This ensures:

- **Consistency**: Same rules apply regardless of machine
- **Portability**: Rules don't depend on work-only integrations (Shortcut, Rollbar)
- **Simplicity**: Single source of truth for language standards
- **Scalability**: New rules automatically available to all agents

Rules may reference work-only tools, but should not require them for understanding.

## Rule Precedence in Agent Context

Instructions are loaded in order:

1. **Global Instructions** (core protocols)
   - memory-and-remory.md
   - workflow-standards.md
   - agent-responsibilities.md
   - agent-output-protocol.md
   - quality-standards.md
   - tool-preferences.md
   - context7-library-documentation.md

2. **Machine-Specific Instructions** (work machine only)
   - shortcut-cli-awareness.md
   - postgres-mcp-databases.md
   - rollbar-mcp-integration.md

3. **Conditional Rules** (language-specific)
   - .opencode/rules/*.md (all rule files loaded)

4. **Agent-Specific Prompts** (from prompts/ directory)
   - Loaded after all instructions
   - Can reference and build upon rules

5. **Project Configuration** (AGENTS.md)
   - Highest precedence for agent-specific behavior

## Using Rules in Agent Prompts

Agent prompts can reference rules loaded in instructions:

```
This agent works within the constraints of language-specific quality rules
loaded from .opencode/rules/. For Python work, see python-quality.md rules.
For shell work, see shell-portability.md rules.
```

Agents have implicit access to all loaded instructions - no special referencing needed.

## Maintenance

**Rule Updates:**

- Edit `.opencode/rules/{language}-{focus}.md` directly
- Changes apply immediately to all agents on next session
- No config changes required
- Both machines load updated rules automatically

**Rule Deletion:**

- Remove file from `.opencode/rules/` directory
- Glob pattern will no longer load it
- Both configs auto-reflect the change

**Size Constraints:**

- Embedding token limit: 256 tokens (~1000 characters absolute max)
- Recommended: 300-500 characters per rule file
- Keep rules focused and actionable
- If larger content needed, split into multiple files

## Integration with Quality Gates

Language-specific rules inform quality gate enforcement:

- **Linting**: Rules specify which linters to use (ruff for Python, clippy for Rust)
- **Testing**: Rules specify testing frameworks and coverage targets
- **Type Checking**: Rules specify type checking requirements
- **Zero Tolerance**: Rules identify items that cannot be suppressed

All quality gates referenced in rules must be passed before completion.

## Examples

**Python Working:**
Agent reads python-quality.md rule → understands ruff linting, mypy typing, pytest required → applies these to Python files being modified

**Rust Working:**
Agent reads rust-safety.md rule → understands clippy zero warnings, unsafe documentation, no unwrap() in production → applies these to Rust files

**Shell Working:**
Agent reads shell-portability.md rule → understands POSIX compliance, ShellCheck, proper quoting → applies these to shell scripts

## Future Extensibility

Rules system supports adding:
- Framework-specific rules (Django, FastAPI, Express)
- Project-specific conventions
- Team-specific standards
- Performance guidelines
- Security guidelines

All without modifying configs - just add `{framework}-{focus}.md` to rules directory.
