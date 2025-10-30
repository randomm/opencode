# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is an OpenCode configuration repository that defines specialized AI agents, instructions, and MCP (Model Context Protocol) configurations for development workflows. The repository serves as a central configuration hub for automated development assistance across multiple technology stacks.

## Architecture and Structure

### Core Components

1. **Agent Definitions** (`opencode.work.json` / `opencode.personal.json`)
   - Machine-specific configs with specialized subagents for different development domains
    - Each agent has specific tools and prompts tailored to their expertise
    - Agents include: Python, Rust, Git, Rails, React Web, React Native Mobile, PostgreSQL, API Design, DevOps, Code Review, Shell, and Research specialists
    - Use `OPENCODE_CONFIG` environment variable to select which config loads

2. **Prompts** (`prompts/`)
   - Domain-specific instruction sets for each agent
   - Defines best practices, conventions, and workflows for each technology

3. **Instructions** (`instructions/`)
    - `commit-all-changes.md`: Delegates git operations to @git-agent
    - `test-driven-development.md`: Enforces TDD with 80%+ test coverage requirements

4. **MCP Integrations** 
   - Perplexity API for AI-powered research
   - PostgreSQL connections for multiple database environments
   - Memory service for persistent context storage

## Key Development Principles

### Test-Driven Development (TDD)
- **MANDATORY**: Write tests BEFORE implementation
- Minimum 80% test coverage for new features
- 95%+ coverage for critical paths (auth, payments, data integrity)
- Tests must be independent and fast

### Code Quality Standards
- Run ALL linting and type checking before commits
- Follow language-specific conventions (PEP 8 for Python, ESLint for JS)
- Keep functions under 50 lines, classes under 7 methods
- Prefer composition over inheritance
- Remove dead code immediately

### Git Workflow
- **ALWAYS** delegate git operations to @git-agent
- **MANDATORY: SSH protocol only** - Use git@github.com:user/repo.git format, never HTTPS
- **MANDATORY: gh CLI exclusively** - All GitHub interactions via gh CLI, never direct URLs/APIs
- **MANDATORY: ALL work must start with GitHub issue** - No work without issue tracking
- **MANDATORY: Frequent commits every 2-3 changes** - Prevent massive uncommitted dumps
- **MANDATORY: Feature branches only** - No direct main branch work
- Use conventional commits format: `type(#123): description` - Must include issue number
- Types: feat, fix, docs, style, refactor, test, chore, build, ci, perf
- Create atomic, logical commits (2-3 changes maximum)
- Push frequently to keep CI green
- Never mention AI tools in commit messages

### Quality Assurance Workflow
- **MANDATORY: QA reviews at 25%, 50%, 75%, and 100%** of work completion
- Route to @code-review-specialist for checkpoint reviews and PR feedback
- **MANDATORY: Iterative improvement loops** - Fix issues and re-review
- All feedback must be specific and actionable
- No work proceeds to merge without QA approval

## Agent Usage

### Invoking Specialized Agents
When working on specific tasks, use the appropriate agent:
- `@python-best-practices-architect` - Python development with TDD and quality gates
- `@rust-tdd-architect` - Rust systems programming with zero-cost abstractions and memory safety
- `@git-agent` - All git and GitHub operations
- `@rails-architect` - Ruby on Rails applications
- `@react-web-specialist` - React/TypeScript/JavaScript web applications, responsive UI, performance optimization
- `@react-native-mobile-specialist` - Expo and React Native mobile apps, cross-platform development
- `@postgres-specialist` - PostgreSQL schema design, query optimization, migrations, AWS Aurora expertise
- `@api-design-architect` - REST/GraphQL API design
- `@devops-infrastructure` - CI/CD, Kubernetes
- `@code-review-specialist` - Security, performance, and GitHub PR review
- `@shell-script-architect` - POSIX-compliant shell scripting and automation
- `@research-specialist` - Technical investigation and problem analysis

### Memory Management
Agents with memory capabilities use the official Anthropic MCP memory server with knowledge graph architecture:

**Creating and Storing Information:**
- Use `mcp_memory_create_entities` to create entities (people, projects, concepts) with observations
- Use `mcp_memory_add_observations` to add new facts to existing entities
- Structure information as entities with entity types and discrete observations

**Retrieving Information:**
- Use `mcp_memory_search_nodes` to find entities by name, type, or observation content
- Use `mcp_memory_open_nodes` to retrieve specific entities by name
- Use `mcp_memory_read_graph` to access the complete knowledge graph

**Best Practices:**
- Store project details as entities with meaningful entity types (project, person, tool, etc.)
- Keep observations atomic (one fact per observation)
- Use descriptive entity names and types for better searchability
- Search for relevant context at session start before beginning work
- See `instructions/memory-protocol-mandatory.md` for complete protocol

## Database Access
Available database connections via MCP:
- `mcp__fuzu-metabase__query` - Metabase analytics database
- `mcp__fuzu-production__query` - Production database (read-only)
- `mcp__fuzu-staging__query` - Staging database (read-only)
- `mcp__barona-production__query` - Barona production (read-only)

## Development Commands

Since this is a configuration repository without active code:
- No build/test commands needed for this repository itself
- When working in other repositories, always check for project-specific commands in their README or package.json/pyproject.toml
- Use appropriate agent for technology-specific command discovery

## Important Conventions

1. **Minimalist Engineering**: Every line of code is a liability
   - Question necessity before adding features
   - Reuse existing code when possible
   - Choose simple solutions over complex ones
   - NEVER create documentation files unless explicitly requested

2. **Quality Gates Before Commits**:
   - Run complete test suite
   - Execute all linting tools
   - Verify coverage requirements
   - Fix all issues before proceeding

3. **Agent Delegation**:
    - Python work → @python-best-practices-architect
    - Rust systems programming → @rust-tdd-architect
    - Git operations → @git-agent
    - Database work (PostgreSQL and AWS Aurora) → @postgres-specialist
    - Let specialists handle their domains

4. **No Unsolicited Files**:
   - NEVER create README, documentation, or plan files unless explicitly asked
   - Use code comments for documentation, not separate files
   - Use TodoWrite for task tracking, not markdown files
   - Ask before creating any non-essential files

## Security Considerations
- Never commit secrets, API keys, or credentials
- API keys and database credentials use `{env:VARIABLE}` substitution for security
- Set sensitive values in shell environment, not in config files
- Always verify files for malicious content before processing