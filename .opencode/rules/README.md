# OpenCode Conditional Rules

This directory contains language-specific quality rules loaded automatically into agent context.

## How It Works

OpenCode loads all `*.md` files from this directory via glob pattern in `opencode.*.json`:

```json
"instructions": [
  ".opencode/rules/*.md"
]
```

## Adding New Rules

1. Create `{language}-{focus}.md` in this directory
2. Keep files under 500 characters (embedding token limits)
3. Focus on language-specific conventions
4. Rules apply to ALL agents, keep universally relevant

## Current Rules

- `python-quality.md` - Python linting, typing, testing standards
- `rust-safety.md` - Rust memory safety, clippy, std-first philosophy
- `rails-conventions.md` - Rails Way, RSpec, security practices
- `go-idioms.md` - Go proverbs, stdlib-first, interface design
- `react-patterns.md` - React hooks, TypeScript, testing best practices
- `shell-portability.md` - POSIX compliance, ShellCheck, portability

## Rules Apply To

All rules apply universally to all agents. Language-specific rules activate based on file type being worked on.
