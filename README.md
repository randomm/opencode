# OpenCode Configuration

Private configuration repository for OpenCode AI agents with secure credential management.

## Quick Setup

```bash
# Clone to OpenCode config directory
git clone git@github.com:randomm/opencode-config.git ~/.config/opencode

# Your credentials are managed in ~/.env (sourced by ~/.zshrc)
# The config uses environment variable substitution: {env:VARIABLE_NAME}
```

## Available Agents

- `@python-best-practices-architect` - Python/TDD expert
- `@git-autonomous-agent` - Git workflow automation  
- `@rails-architect` - Ruby on Rails development
- `@react-frontend-specialist` - React/TypeScript
- `@postgres-database-expert` - PostgreSQL optimization
- `@aws-rds-postgresql-expert` - AWS RDS Aurora DBA
- `@api-design-architect` - REST/GraphQL APIs
- `@devops-infrastructure` - CI/CD, Docker, K8s
- `@javascript-typescript-architect` - Full-stack JS/TS

## Environment Variables Required

Set in `~/.env`:
- `PERPLEXITY_API_KEY`
- `FUZU_METABASE_DB`
- `FUZU_PRODUCTION_DB_RO`
- `FUZU_STAGING_DB`
- `BARONA_PRODUCTION_DB`

## Files

- `opencode.json` - Active configuration (uses env vars)
- `opencode.json.secure` - Template for reference
- `prompts/` - Agent instruction sets
- `instructions/` - Workflow definitions
- `CLAUDE.md` - Claude Code documentation

## Security

- Credentials are stored in `~/.env`, not in this repo
- Config uses `{env:VARIABLE_NAME}` substitution
- `.gitignore` protects sensitive files

## Restore Original Config

If needed:
```bash
cp opencode.json.backup-with-credentials opencode.json
```