# OpenCode AI Agent Configuration

## Vision: Your Independent AI Delivery Team

This OpenCode configuration is designed as an **independent AI delivery team** that handles complete software development workflows. The key principle: **you stay high-level, the team handles execution details**.

### The Core Experience

```
You: "Add OAuth authentication with 2FA support"

Project Manager:
  ├─ Creates GitHub issue with quality checklist
  ├─ Delegates database schema → @postgres-specialist
  ├─ Delegates API design → @api-design-architect
  ├─ Delegates backend implementation → @python-best-practices-architect
   ├─ Delegates frontend → @react-web-specialist or @react-native-mobile-specialist
  ├─ Delegates testing → Each specialist (TDD enforced)
   ├─ Delegates code review → @code-review-specialist
    ├─ Delegates git operations → @git-agent
  └─ Delivers: Production-ready feature, tested, reviewed, merged

You: Approve and continue with next high-level task
```

**You communicate requirements. The team delivers working software.**

## 🏗️ Architecture Overview

### Orchestrator-Specialist Pattern

Traditional AI coding assistants try to do everything themselves. This configuration separates **coordination** from **execution**:

```
┌─────────────────────────────────────────────────────┐
│  User (High-Level Requirements)                      │
│  "Build feature X with quality Y"                    │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Project Manager (Orchestrator)                      │
│  - Understands full context                          │
│  - Routes to specialists                             │
│  - Enforces quality gates                            │
│  - Coordinates dependencies                          │
│  - Read-only tools: cannot execute, only delegate    │
└────────────────┬────────────────────────────────────┘
                 │
                 ├──────┬──────┬──────┬──────┬────────┐
                 ▼      ▼      ▼      ▼      ▼        ▼
          ┌──────────────────────────────────────────────┐
          │  Specialist Agents (Execution)               │
          │  - Domain expertise                          │
          │  - Full execution tools                      │
          │  - TDD enforcement                           │
          │  - Quality validation                        │
          │                                              │
   │  Python │ Rust │ Rails │ Web/Mobile │ DevOps     │
           │  Git │ Database │ API │ Code Review         │
          └──────────────────────────────────────────────┘
```

**Benefits:**
- User focuses on WHAT, not HOW
- Domain expertise in each technology stack
- Parallel execution across multiple specialists
- Quality enforcement at orchestration level
- Context management across domains

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

### Permission Boundaries (Security Through Isolation)

**Project Manager (Primary Agent):**
- Tools: Read, Glob, Grep, WebFetch, TodoWrite
- Bash: Read-only operations (`git status/log/show/diff`, `gh issue view/list`, `remory`, basic utilities)
- **CANNOT**: Write files, edit code, execute arbitrary bash, perform git operations, create/edit issues or PRs
- **PURPOSE**: Forces proper delegation, maintains orchestration purity

**Specialist Agents (Subagents):**
- Tools: Full execution (Bash, Read, Write, Edit, Perplexity APIs)
- Bash: Everything in their domain EXCEPT git write operations
- **CANNOT**: `git add`, `git commit`, `git push`, `git pull`, `git merge`, `gh pr create`, `gh issue create`
- **CANNOT**: Database clients (psql, mysql, mongosh, redis-cli, sqlite3)
- **PURPOSE**: Execute in their domain, delegate git operations

**Git Agent:**
- Tools: Bash (git/gh operations only)
- Bash: All git and GitHub operations (`git add/commit/push`, `gh pr create/merge`, etc.)
- **CANNOT**: Application code execution, testing, linting, building
- **PURPOSE**: Single source of truth for version control

**Code Review Agent:**
- Tools: Read-only analysis (no Write/Edit/Multiedit)
- Bash: Testing, linting, and code quality tools only
- **CANNOT**: Modify files, write code, execute git operations
- **PURPOSE**: Review code quality without altering code

**Research Specialist:**
- Tools: Read-only analysis (no Write/Edit)
- Bash: Investigation tools only (git read-only, rg, grep, AWS read operations)
- **CANNOT**: Modify files, execute code, perform git operations, write AWS resources
- **PURPOSE**: Research and problem analysis without side effects

### Model Selection Strategy

**Project Manager: Claude Sonnet 4.5**
- Superior reasoning for complex coordination
- Context management across long conversations
- Quality gate enforcement

**Specialists: Configurable via `SUBAGENT_MODEL`**
```bash
# Cost-effective (recommended)
export SUBAGENT_MODEL="qwen/qwen3-coder-32b"

# Fast and cheap
export SUBAGENT_MODEL="anthropic/claude-haiku-4"

# Maximum quality
export SUBAGENT_MODEL="anthropic/claude-sonnet-4.5"
```

## 🤖 Agent Roster (15 Total: 1 Orchestrator + 14 Specialists)

### Core Orchestration
- **`project-manager`** - Pure management, delegates everything, maintains context

### Language Architects (TDD Focused)
- **`python-best-practices-architect`** - Python with pytest, mypy, black
- **`rust-tdd-architect`** - Zero-cost abstractions, memory safety, cargo tools
- **`rails-architect`** - Rails conventions, RSpec, security best practices
- **`go-tdd-architect`** - Go idiomatic simplicity, stdlib-first, TDD
- **`shell-script-architect`** - POSIX-first shell scripting, BATS testing, portability

### Frontend Specialists (Platform-Based)
- **`react-web-specialist`** - React/TypeScript/JavaScript web apps, responsive UI, performance optimization
- **`react-native-mobile-specialist`** - Expo and React Native mobile apps, cross-platform development

### Domain Specialists
- **`postgres-specialist`** - PostgreSQL schema design, query optimization, migrations, AWS Aurora expertise
- **`api-design-architect`** - RESTful design, GraphQL, API security

### Operations & Quality
- **`git-agent`** - Version control, branching, PR management
- **`devops-infrastructure`** - CI/CD, Kubernetes, monitoring
- **`code-review-specialist`** - Security analysis, performance review, GitHub PR workflows

### Support & Research
- **`research-specialist`** - Technical investigation, problem analysis, knowledge discovery
- **`technical-writer`** - Clear, concise, user-focused documentation

## 🔧 Configuration Structure

```
opencode.work.json         # Work machine config (Shortcut CLI enabled)
opencode.personal.json     # Personal machine config (Shortcut CLI disabled)
├── CLAUDE.md              # Project instructions and conventions
├── AGENTS.md              # Complete agent responsibilities and domain restrictions
├── prompts/               # Individual agent prompt files (15 total)
│   ├── api-design.txt
│   ├── code-review-specialist.txt
│   ├── devops-infrastructure.txt
│   ├── git-agent.txt
│   ├── go-tdd-architect.txt
│   ├── postgres-specialist.txt
│   ├── project-manager.txt
│   ├── python-best-practices.txt
│   ├── rails-architect.txt
│   ├── react-native-mobile-specialist.txt
│   ├── react-web-specialist.txt
│   ├── research-specialist.txt
│   ├── rust-tdd-architect.txt
│   ├── shell-script-architect.txt
│   └── technical-writer.txt
├── instructions/          # Global development standards
│   ├── agent-responsibilities.md
│   ├── memory-and-remory.md
│   ├── postgres-mcp-databases.md
│   ├── quality-standards.md
│   ├── rollbar-mcp-integration.md
│   ├── shortcut-cli-awareness.md
│   ├── tool-preferences.md
│   └── workflow-standards.md
└── command/               # Command-specific instructions
    └── session-start.md
```

### Machine-Specific Configuration

This configuration uses **machine-specific configs** to handle different permission requirements between work and personal environments. The primary difference is Shortcut CLI integration.

**Shortcut CLI Access (Work Machine Only):**
- `opencode.work.json` enables Shortcut CLI for 4 coordination agents:
  - `project-manager` - `"short*": "allow"`
  - `git-agent` - `"short*": "allow"`
  - `research-specialist` - `"short*": "allow"`
  - `code-review-specialist` - `"short*": "allow"`
- Implementation specialists (Python, Rust, Rails, React, etc.) do NOT have Shortcut CLI access
- `opencode.personal.json` disables Shortcut CLI entirely (`"short *": "deny"`)

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
- No base config - each machine uses its specific config file exclusively
- Both configs are functionally complete and independent
- Both files committed and synced via git
- Environment variable determines which config loads
- All other permissions are identical between configs

**Why Two Files:**
- Makes machine-specific differences (Shortcut CLI access) explicit and clear
- Prevents confusion from environment-variable-based file overrides
- Each config is standalone and complete

## 🌐 Frontend Agent Separation

The frontend development has been consolidated into two platform-specialized agents:

- **`react-web-specialist`** - For browser-based React applications
  - React/TypeScript/JavaScript web apps
  - Responsive UI and performance optimization
  - Single Page Applications (SPAs)
  - Server-side rendering with Node.js
  - Web accessibility (a11y)

- **`react-native-mobile-specialist`** - For cross-platform mobile applications
  - Expo and React Native development
  - iOS and Android application development
  - Cross-platform code sharing
  - Native module integration
  - Mobile-specific performance optimization

**Delegation Rule:** Choose the agent based on the target platform (web browser vs. mobile), not the underlying technology.

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
   - **Delegate git operations** to @git-agent

### 4. Agent Boundaries
- **Project Manager**: Pure orchestration, no execution
- **Language Agents**: Domain-specific implementation
- **Git Agent**: All version control operations
- **DevOps Agent**: Infrastructure and deployment

### 5. Issue-Driven Workflow
- All work starts with GitHub issue
- PM creates issue with quality checklist
- Issue defines exact scope and deliverables
- Work beyond issue scope is refused
- Completion = all checkboxes checked

### 6. Memory-Driven Context
- Project-scoped memory (`PROJECT_ID` per repository)
- Semantic search for relevant context
- Cross-session continuity
- Use `--infer false` to preserve full context without LLM summarization

## 📋 Workflow Patterns

### Pattern 1: Feature Development (Web)
```
User: "Add dark mode toggle to settings"

PM:
   1. Creates GitHub issue #42 with quality checklist
   2. Delegates to @react-web-specialist
      - Implements component with tests
      - Runs linting and type checking
       - Achieves 85% test coverage
    3. Delegates to @git-agent
       - Creates feature branch, commits, pushes
       - Creates PR
     4. Delegates to @code-review-specialist
        - Reviews code quality, checks coverage
        - Approves PR
     5. Delegates merge to @git-agent
    6. Reports completion to user
```

### Pattern 2: Multi-Domain Feature
```
User: "Add payment processing with Stripe"

PM:
   1. Creates GitHub issue #56
   2. Delegates in parallel:
      - @postgres-specialist: Schema design
      - @api-design-architect: API structure
      - @python-best-practices-architect: Backend logic
      - @react-web-specialist: Payment UI (web) or @react-native-mobile-specialist: Payment UI (mobile)
   3. Coordinates testing across all layers
   4. Delegates deployment to @devops-infrastructure
   5. Standard git workflow and PR review
```

### Pattern 3: Investigation & Fix
```
User: "Why is the login endpoint slow?"

PM:
  1. Delegates to @research-specialist
     - Checks database query logs
     - Identifies N+1 query problem
  2. Delegates fix to @rails-architect
     - Implements eager loading
     - Adds regression tests
  3. Delegates verification to @devops-infrastructure
     - Confirms 10x improvement in staging
  4. Standard git workflow for merge
```

## 🛠️ MCP Integrations

The system integrates with several Model Context Protocol servers:

- **Perplexity API** - AI-powered research and problem-solving (semantic search, reasoning, deep research)
- **PostgreSQL Connections** - Multiple database environments (Fuzu and Barona production databases via read-only MCP servers)
- **Rollbar Error Investigation** - Production error investigation and analysis
- **Memory Service (Remory)** - Enhanced semantic memory with vector embeddings

See `instructions/postgres-mcp-databases.md` for database access details and `instructions/rollbar-mcp-integration.md` for error investigation setup.

### Memory Service (Remory)

The system uses **Remory** for advanced project-scoped memory with semantic search capabilities, providing significant improvements over basic memory servers:

#### Key Features
- **Semantic Search** - Vector embeddings enable contextual memory retrieval beyond simple text matching
- **Project-Scoped Memory** - Each project tracked independently via `PROJECT_ID`
- **LLM-Powered Consolidation** - Intelligent memory organization and conflict resolution
- **Production-Grade Backend** - PostgreSQL with pgvector extension for scalable vector operations
- **Performance Improvements** - 5-15x faster memory operations compared to JSON file storage
- **Multi-Agent Support** - Concurrent access for coordinated agent collaboration

#### How Agents Use Memory
- **Search**: Load project context before starting work (`remory search "PROJECT_ID <query>"`)
- **Work**: Track findings and discoveries incrementally during task execution
- **Store**: Preserve complete outcomes after task completion (`remory add "Project: PROJECT_ID. ..."`)

#### Technical Architecture
- **Memory Server**: Remory CLI with semantic memory capabilities
- **Database**: PostgreSQL with pgvector extension for vector operations  
- **Interface**: Bash-based CLI (`remory search`, `remory add`, `remory get`)
- **Project Identification**: `$PROJECT_ID` environment variable (auto-created if missing)

#### Performance Benefits
- **Search Speed**: Vector similarity search vs linear text scanning
- **Memory Efficiency**: PostgreSQL optimization vs in-memory JSON
- **Concurrency**: Multi-agent access vs file locking conflicts
- **Persistence**: Database transactions vs file system reliability
- **Scalability**: Horizontal scaling support vs single-process limits

## 📌 When To Use This Configuration

**Ideal for:**
- Software development projects requiring high quality
- Multi-domain features (backend + frontend + database + deployment)
- Teams wanting AI assistance without quality compromise
- Projects with established quality standards (TDD, linting, coverage)
- Long-running projects benefiting from institutional memory

**Not ideal for:**
- Quick prototypes where quality is secondary
- Single-file scripts or simple tasks
- Environments without git/GitHub workflow
- Projects that cannot wait for proper testing

## 🔧 Extending This Configuration

### Adding a New Specialist

1. Create prompt file in `prompts/new-specialist.txt`
2. Define in both config files (opencode.work.json and opencode.personal.json):
   - Description, Mode: "subagent", Model: `{env:SUBAGENT_MODEL}`
   - Permissions (deny git operations, add shortcut CLI permission)
   - Tools needed
3. Update `project-manager.txt` specialist routing section
4. Test with PM delegation

### Customizing Quality Gates

Edit `instructions/quality-standards.md` to adjust coverage requirements, linting tools, or testing requirements. All specialists read this instruction file automatically.

## 📋 Usage Examples

### Complex Feature Development
```
User: "Add user authentication with OAuth and 2FA"
Project Manager: 
   1. Routes database schema to @postgres-specialist
   2. Routes API design to @api-design-architect  
   3. Routes backend logic to @python-best-practices-architect
   4. Routes frontend to @react-web-specialist (web) or @react-native-mobile-specialist (mobile)
   5. Routes deployment to @devops-infrastructure
    6. Coordinates testing across all layers
    7. Delegates final commit to @git-agent
```

### Bug Investigation
```
User: "Login failing in production"
Project Manager:
   1. Routes to @devops-infrastructure for deployment check
   2. Routes to @git-agent for recent changes
  3. Routes to @python-best-practices-architect for backend debug
  4. Routes to @postgres-specialist for query analysis
  5. Coordinates fix across impacted systems
```

## 🔄 Development Workflow

### Environment Variables

Set in `~/.env` for MCP integrations:
- **Required:**
  - `PERPLEXITY_API_KEY` - Perplexity API key for research and analysis
- **Database Access (optional, work machine only):**
  - `FUZU_METABASE_DB` - Fuzu Metabase read-only connection
  - `FUZU_PRODUCTION_DB_RO` - Fuzu production database read-only access
  - `FUZU_STAGING_DB` - Fuzu staging database access
  - `BARONA_PRODUCTION_DB` - Barona production database read-only access
- **Error Investigation (optional):**
  - `ROLLBAR_ACCESS_TOKEN` - Rollbar API token for error investigation

### Workflow Features
- **Issue-Driven Development** - All work starts with GitHub issues
- **Feature Branches** - Work never happens in main branch
- **TDD Enforcement** - Tests written before implementation
- **Quality Gates** - All linting, testing, and coverage verified locally
- **CI Verification** - Real-time monitoring of CI pipeline (gh run watch)
- **Code Review** - Security and quality analysis before merge

## 🔒 Security

- Credentials are stored in `~/.env`, not in this repo
- Config uses `{env:VARIABLE_NAME}` substitution
- `.gitignore` protects sensitive files

## 📄 License

This configuration system is proprietary. All rights reserved.

---

*Built with OpenCode AI Agent Architecture - Orchestrating Intelligence for Complex Development*