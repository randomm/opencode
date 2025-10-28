# OpenCode AI Agent Configuration

A comprehensive multi-agent development system built on OpenCode with specialized AI architects for different technology domains. This configuration creates a coordinated team of AI specialists that handle complex development workflows through intelligent task delegation and collaboration.

## 🏗️ Architecture Overview

This system implements a **pure orchestration** pattern where specialized AI agents collaborate to deliver high-quality code across multiple technology stacks:

- **Project Manager** (Orchestrator) - Routes tasks to specialists, manages dependencies
- **Language Specialists** - Python, Rust, JavaScript/TypeScript, Rails architects
- **Domain Experts** - React frontend, PostgreSQL database, API design specialists  
- **Operational Agents** - Git autonomous, DevOps infrastructure, code review experts

## 🚀 Key Features

### Intelligent Task Delegation
- **Project Manager** analyzes requirements and routes to appropriate specialists
- **Zero overlap** - each agent has clear domain boundaries
- **Task tool is synchronous** - PM waits (blocked) for specialist completion before continuing
- **Cross-agent collaboration** - specialists delegate to each other when needed

### Test-Driven Development Enforcement
- **Mandatory 80-95%+ test coverage** across all domains
- **Tests-first workflow** - no implementation without failing tests
- **Quality gates** prevent commits without passing tests and linting

### Project-Specific Tool Discovery
- **Auto-discovery** of project linters and tools (ESLint, Rubocop, Clippy, etc.)
- **Runs actual project tools** instead of generic defaults  
- **Prevents CI failures** by catching issues locally first

### GitHub CLI Standardization
- **All GitHub operations** use `gh` CLI for consistency
- **Seamless PR workflows** with automated checks and reviews
- **Integrated CI/CD** monitoring and failure handling

## 🤖 Agent Roster

### Core Orchestration
- **`project-manager`** - Pure management, delegates everything, maintains context

### Language Architects (TDD Focused)
- **`python-best-practices-architect`** - Python with pytest, mypy, black
- **`rust-tdd-architect`** - Zero-cost abstractions, memory safety, cargo tools
- **`javascript-typescript-architect`** - Minimalist JS/TS, built-in APIs first
- **`rails-architect`** - Rails conventions, RSpec, security best practices
- **`shell-script-architect`** - POSIX-first shell scripting, BATS testing, portability
- **`research-specialist`** - Technical investigation, problem analysis, Perplexity research

### Domain Specialists
- **`react-frontend-specialist`** - Component architecture, accessibility, performance
- **`postgres-database-expert`** - Schema design, query optimization, migrations
- **`aws-rds-postgresql-expert`** - Aurora PostgreSQL DBA operations
- **`api-design-architect`** - RESTful design, GraphQL, API security

### Operations & Quality
- **`git-autonomous-agent`** - Version control, branching, PR management
- **`devops-infrastructure`** - CI/CD, Kubernetes, monitoring
- **`code-review-quality`** - Security analysis, performance review
- **`github-pr-reviewer`** - Comprehensive PR analysis and feedback

## 🔧 Configuration Structure

```
.
├── opencode.work.json      # Work machine config (Shortcut CLI enabled)
├── opencode.personal.json  # Personal machine config (Shortcut CLI disabled)
├── CLAUDE.md              # Project instructions and conventions
├── prompts/               # Individual agent prompt files
│   ├── project-manager.txt
│   ├── python-best-practices.txt
│   ├── rust-tdd-architect.txt
│   ├── javascript-typescript.txt
│   ├── rails-architect.txt
│   ├── react-frontend.txt
│   ├── postgres-database.txt
│   ├── api-design.txt
│   ├── git-autonomous.txt
│   ├── devops-infrastructure.txt
│   └── ...
├── instructions/          # Global development standards
│   ├── commit-all-changes.md
│   ├── test-driven-development.md
│   └── no-unsolicited-files.md
└── providers/            # MCP provider configurations
```

### Machine-Specific Configuration

This configuration uses **machine-specific configs** to handle different permission requirements between work and personal environments.

**REQUIRED Setup (on each machine):**

1. **Work Machine** - Enable Shortcut CLI:
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export OPENCODE_CONFIG=~/.config/opencode/opencode.work.json
   ```

2. **Personal Machine** - Disable Shortcut CLI:
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export OPENCODE_CONFIG=~/.config/opencode/opencode.personal.json
   ```

**Important:** You MUST set `OPENCODE_CONFIG` in your shell profile. Without it, OpenCode won't find a configuration file.

**How It Works:**
- No base config - each machine uses its specific config file
- `opencode.work.json` - Complete config with `"short *": "allow"` for Shortcut CLI
- `opencode.personal.json` - Complete config with `"short *": "deny"` for Shortcut CLI
- Both configs are identical except for Shortcut CLI permissions
- Both files committed and synced via git
- Environment variable determines which config loads

**Why Two Files:**
- Avoids confusion from having three nearly identical configs
- Makes machine-specific differences explicit and clear
- Each config is complete and standalone

## 🎯 Core Principles

### 1. Minimalist Engineering
- Every line of code is a liability
- Question necessity before adding features  
- Choose simple solutions over complex ones
- **Never create documentation files** unless explicitly requested

### 2. Test-Driven Development
- **Write tests BEFORE implementation**
- Minimum 80% test coverage for new features
- 95%+ coverage for critical paths
- Tests must be independent and fast

### 3. Quality Gates Before Commits
- Run ALL linting and type checking
- Execute complete test suites
- Fix ALL issues before git operations
- **Delegate git operations** to @git-autonomous-agent

### 4. Agent Boundaries
- **Project Manager**: Pure orchestration, no execution
- **Language Agents**: Domain-specific implementation  
- **Git Agent**: All version control operations
- **DevOps Agent**: Infrastructure and deployment

## 🛠️ MCP Integrations

The system integrates with several Model Context Protocol servers:

- **Perplexity API** - AI-powered research and problem-solving
- **PostgreSQL Connections** - Multiple database environments
- **Memory Service (Remory)** - Enhanced semantic memory with vector embeddings

### Memory Service (Remory)

The system uses **Remory** for advanced memory capabilities, providing significant improvements over basic memory servers:

#### Key Features
- **Semantic Search** - Vector embeddings enable contextual memory retrieval beyond simple text matching
- **LLM-Powered Consolidation** - Intelligent memory organization and conflict resolution
- **Production-Grade Backend** - PostgreSQL with pgvector extension for scalable vector operations
- **Performance Improvements** - 5-15x faster memory operations compared to JSON file storage
- **Multi-Agent Support** - Concurrent access for coordinated agent collaboration

#### Technical Architecture
- **Memory Server**: Remory CLI with semantic memory capabilities
- **Database**: PostgreSQL with pgvector extension for vector operations
- **Interface**: Bash-based CLI (remory command)
- **Compatibility**: All existing memory operations work seamlessly via remory CLI

#### Memory Operations
All agents have access to enhanced memory operations:
- `memory_create_entities` - Create semantic entities with observations
- `memory_search_nodes` - Vector-based semantic search
- `memory_open_nodes` - Retrieve specific memory nodes
- `memory_add_observations` - Append context to existing entities
- `memory_read_graph` - Access complete memory structure

#### Performance Benefits
- **Search Speed**: Vector similarity search vs linear text scanning
- **Memory Efficiency**: PostgreSQL optimization vs in-memory JSON
- **Concurrency**: Multi-agent access vs file locking conflicts
- **Persistence**: Database transactions vs file system reliability
- **Scalability**: Horizontal scaling support vs single-process limits

## 📋 Usage Examples

### Complex Feature Development
```
User: "Add user authentication with OAuth and 2FA"
Project Manager: 
  1. Routes database schema to @postgres-database-expert
  2. Routes API design to @api-design-architect  
  3. Routes backend logic to @python-best-practices-architect
  4. Routes frontend to @react-frontend-specialist
  5. Routes deployment to @devops-infrastructure
  6. Coordinates testing across all layers
  7. Delegates final commit to @git-autonomous-agent
```

### Bug Investigation
```
User: "Login failing in production"
Project Manager:
  1. Routes to @devops-infrastructure for deployment check
  2. Routes to @git-autonomous-agent for recent changes
  3. Routes to @python-best-practices-architect for backend debug
  4. Routes to @postgres-database-expert for query analysis
  5. Coordinates fix across impacted systems
```

## 🔄 Development Workflow


Set in `~/.env`:
- `PERPLEXITY_API_KEY` (required for Perplexity MCP server)
- `FUZU_METABASE_DB`
- `FUZU_PRODUCTION_DB_RO`
- `FUZU_STAGING_DB`
- `BARONA_PRODUCTION_DB`

## 🔒 Security

- Credentials are stored in `~/.env`, not in this repo
- Config uses `{env:VARIABLE_NAME}` substitution
- `.gitignore` protects sensitive files

## 📄 License

This configuration system is proprietary. All rights reserved.

---

*Built with OpenCode AI Agent Architecture - Orchestrating Intelligence for Complex Development*