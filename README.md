# OpenCode Configuration Repository

This repository contains configuration for OpenCode AI agents, providing specialized development assistance across multiple technology stacks with integrated MCP (Model Context Protocol) services.

## Overview

OpenCode is configured with specialized AI agents for different development domains, each with tailored prompts and tool access. This configuration enables automated, high-quality development workflows with emphasis on:

- Test-Driven Development (TDD) with 80%+ coverage requirements
- Code quality enforcement through linting and type checking
- Secure credential management
- Version control best practices
- Cloud-native database operations

## Available Agents

### Core Development Agents

1. **@python-best-practices-architect** - Python development with TDD and quality gates
2. **@git-autonomous-agent** - Git and GitHub workflow management
3. **@rails-architect** - Ruby on Rails applications with RSpec
4. **@react-frontend-specialist** - React/TypeScript frontend development
5. **@javascript-typescript-architect** - Full-stack JavaScript/TypeScript

### Database Specialists

6. **@postgres-database-expert** - PostgreSQL schema design and optimization
7. **@aws-rds-postgresql-expert** - AWS RDS Aurora PostgreSQL DBA (NEW)
   - Aurora cluster management and optimization
   - Performance tuning with Aurora-specific features
   - High availability and disaster recovery
   - Migration and upgrade strategies

### Infrastructure & Architecture

8. **@api-design-architect** - RESTful and GraphQL API design
9. **@devops-infrastructure** - CI/CD, Docker, Kubernetes
10. **@code-review-quality** - Security and performance analysis
11. **@github-pr-reviewer** - Automated PR review and feedback

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-private-repo-url> ~/.config/opencode
cd ~/.config/opencode
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual credentials
nano .env  # or use your preferred editor
```

Required environment variables:
- `PERPLEXITY_API_KEY` - For AI-powered research
- Database URLs for each environment (see .env.example)
- Optional: AWS credentials for RDS operations
- Optional: GitHub token for repository operations

### 3. Security Configuration

**IMPORTANT**: The repository includes two configuration files:
- `opencode.json` - Your active configuration (DO NOT COMMIT WITH CREDENTIALS)
- `opencode.json.secure` - Template using environment variables (safe to commit)

To activate the secure configuration:
```bash
# Backup current config if needed
cp opencode.json opencode.json.backup

# Use the secure version
cp opencode.json.secure opencode.json

# Ensure your .env file has all required variables
```

### 4. MCP Services Setup

The configuration includes several MCP services:

#### Memory Service
Provides persistent context storage for agents:
```bash
# Install the memory service (if not already installed)
pip install mcp-memory-service

# Service will use paths defined in environment:
# MCP_MEMORY_CHROMA_PATH (default: ~/.claude_chroma_db)
# MCP_MEMORY_BACKUPS_PATH (default: ~/.claude_chroma_backups)
```

#### Database Services
All database connections are configured as read-only MCP services. Ensure Docker is installed for database connectivity.

## Usage

### Invoking Agents

In Claude Code, invoke specialized agents using the @ symbol:

```
@python-best-practices-architect - Help me create a Python package with proper testing
@aws-rds-postgresql-expert - Optimize this query for Aurora PostgreSQL
@git-autonomous-agent - Create commits for all my changes
```

### Development Workflow

1. **Starting a Feature**
   - Use appropriate technology agent for implementation
   - Agent will enforce TDD practices automatically

2. **Database Work**
   - Use `@aws-rds-postgresql-expert` for Aurora-specific tasks
   - Use `@postgres-database-expert` for general PostgreSQL work

3. **Committing Changes**
   - Always delegate to `@git-autonomous-agent`
   - Agent will create atomic, well-structured commits

### Key Principles

#### Test-Driven Development (TDD)
- Write tests BEFORE implementation
- Maintain 80%+ coverage for new code
- 95%+ coverage for critical paths

#### Code Quality
- All code must pass linting before commits
- Type checking enforced where applicable
- Dead code removal is mandatory

#### Security
- Never hardcode credentials
- Use environment variables for all secrets
- Review .gitignore before committing

## Repository Structure

```
~/.config/opencode/
├── prompts/                 # Agent-specific instruction sets
│   ├── python-best-practices.txt
│   ├── git-autonomous.txt
│   ├── aws-rds-postgresql.txt
│   └── ...
├── instructions/            # Shared workflow instructions
│   ├── commit-all-changes.md
│   └── test-driven-development.md
├── agent.backup/           # Backup of agent configurations
├── providers/              # Provider-specific configs (if any)
├── opencode.json          # Active configuration (DO NOT COMMIT)
├── opencode.json.secure   # Secure template (safe to commit)
├── .env.example           # Environment variable template
├── .env                   # Your actual credentials (DO NOT COMMIT)
├── .gitignore            # Git ignore rules
├── CLAUDE.md             # Claude Code instructions
└── README.md             # This file
```

## Best Practices

### Adding New Agents

1. Create a prompt file in `prompts/` directory
2. Add agent configuration to `opencode.json.secure`
3. Define appropriate tool access
4. Document in README and CLAUDE.md

### Credential Management

1. **Never** commit credentials to the repository
2. Always use environment variables
3. Rotate credentials regularly
4. Use AWS IAM roles when possible

### Version Control

1. Keep `opencode.json` in .gitignore
2. Only commit `opencode.json.secure`
3. Document all configuration changes
4. Use semantic versioning for major updates

## Troubleshooting

### Common Issues

**Agent not responding**: 
- Check if agent name is spelled correctly
- Verify agent is defined in opencode.json

**Database connection failures**:
- Verify credentials in .env file
- Check network connectivity to RDS instances
- Ensure Docker is running for MCP services

**Memory service errors**:
- Check paths exist and have write permissions
- Verify uv/Python installation

## Contributing

1. Create feature branch
2. Test changes thoroughly
3. Update documentation
4. Submit PR with clear description

## Security Notice

This repository may contain references to sensitive infrastructure. Always:
- Review changes before committing
- Use private repository for storage
- Implement least-privilege access
- Audit agent permissions regularly

## Support

For issues or questions:
1. Check CLAUDE.md for Claude Code specific guidance
2. Review agent prompts for capabilities
3. Consult instruction files for workflows

## License

Private repository - All rights reserved