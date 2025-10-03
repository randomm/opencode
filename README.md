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

### Domain Specialists
- **`react-frontend-specialist`** - Component architecture, accessibility, performance
- **`postgres-database-expert`** - Schema design, query optimization, migrations
- **`aws-rds-postgresql-expert`** - Aurora PostgreSQL DBA operations
- **`api-design-architect`** - RESTful design, GraphQL, API security

### Operations & Quality
- **`git-autonomous-agent`** - Version control, branching, PR management
- **`devops-infrastructure`** - CI/CD, Docker, Kubernetes, monitoring
- **`code-review-quality`** - Security analysis, performance review
- **`github-pr-reviewer`** - Comprehensive PR analysis and feedback

## 🔧 Configuration Structure

```
.
├── opencode.json           # Agent definitions and tool configurations
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
- **Docker Integration** - Containerized deployment for consistent environments

#### Technical Architecture
- **Memory Server**: `remory_mcp_server` (Docker container)
- **Database**: `remory_mcp_postgres` with pgvector extension
- **Interface**: MCP protocol via Docker exec command
- **Compatibility**: All existing memory tools work seamlessly

#### Setup Requirements
Before using the agent system, ensure Remory containers are running:

```bash
# Start Remory services
docker compose -f docker-compose.mcp.yml up -d

# Verify containers are healthy
docker ps --filter "name=remory_mcp" --format "table {{.Names}}\t{{.Status}}"
```

#### Configuration
The system automatically uses Remory via the `opencode.json` configuration:

```json
{
  "mcp": {
    "memory": {
      "type": "local",
      "command": ["docker", "exec", "-i", "remory_mcp_server", "python", "-m", "remory.mcp"],
      "enabled": true
    }
  }
}
```

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

1. **Task Analysis** - Project Manager understands requirements
2. **Specialist Routing** - Tasks delegated to appropriate agents
3. **TDD Implementation** - Tests first, then minimal implementation
4. **Quality Validation** - Linting, testing, coverage checks
5. **Cross-Agent Coordination** - Integration between domains  
6. **Git Operations** - Automated commits, PRs, and deployment

## 🚦 Quality Standards

- **Zero warnings policy** - All linting must pass
- **Mandatory test coverage** - 80% minimum, 95% for critical paths
- **Security first** - Automated vulnerability scanning
- **Performance conscious** - N+1 query detection, bundle analysis
- **Accessibility compliance** - WCAG 2.1 AA minimum

## 🐳 Unified Container: Multi-Access Development Environment

**Single container accessible from Mac terminal AND iPhone via SSH with persistent sessions.**

### Quick Start

```bash
# Start or attach to OpenCode (from Mac)
cd ~/.config/opencode
./scripts/opencode

# Work in the session
opencode "Implement user authentication"

# Detach from session (keeps running): Ctrl+A then D

# Reattach later (from Mac or iPhone via SSH)
./scripts/opencode
```

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Unified OpenCode Container                      │
│                                                         │
│  Features:                                              │
│  ✅ OpenCode CLI                                        │
│  ✅ SSH Server (Tailscale VPN)                         │
│  ✅ GitHub CLI (gh) - auto-authenticated               │
│  ✅ Docker socket (MCP server access)                  │
│  ✅ screen/tmux (persistent sessions)                  │
│                                                         │
│  Access Methods:                                        │
│  1. Mac: ./scripts/opencode (docker exec)              │
│  2. iPhone: ssh opencode@<tailscale-ip>                │
│  3. Both: Attach to same screen session!               │
└─────────────────────────────────────────────────────────┘

Containers:
1. opencode - Unified container (all features)
2. opencode_tailscale - Tailscale VPN sidecar
3. remory_mcp_server - Memory system (on host network)
4. remory_mcp_postgres - Memory database (on host network)
```

### Multi-Device Workflow

The unified container supports **persistent screen sessions** that work across devices:

```bash
# On Mac: Start working
./scripts/opencode
opencode "Debug payment processing"
# Detach: Ctrl+A then D

# On iPhone: Continue same session
ssh opencode@<tailscale-ip>
screen -r opencode-main
# See exactly where you left off!
# Keep working or detach again
```

### Setup

#### Initial Setup

```bash
cd ~/.config/opencode

# Set environment variables
export TS_AUTHKEY='tskey-auth-xxxxx'  # From Tailscale admin
export GH_TOKEN='ghp_xxxxx'           # Optional: GitHub CLI auto-auth
export PERPLEXITY_API_KEY='pplx_xxxxx' # Optional: Perplexity MCP

# Or create .env file
cat > .env << EOF
TS_AUTHKEY=tskey-auth-xxxxx
GH_TOKEN=ghp_xxxxx
PERPLEXITY_API_KEY=pplx_xxxxx
EOF

# Start unified container
./scripts/opencode
```

#### SSH Access Setup (for iPhone)

```bash
# Add your SSH public key to container
./add-ssh-key.sh ~/.ssh/id_ed25519.pub

# Get SSH connection info
./scripts/opencode --ssh

# Connect from iPhone (using Termius, Blink Shell, etc.)
ssh opencode@<tailscale-ip>
screen -r opencode-main
```

### Features

#### Persistent Sessions
- **Screen multiplexer** - Sessions survive disconnections
- **Multi-device access** - Same session on Mac and iPhone
- **Multiple windows** - Organize work across terminal windows
- **Session sharing** - Perfect for pair programming

#### Development Tools
- **OpenCode CLI** - Latest version with all agents
- **GitHub CLI (gh)** - Auto-authenticated if GH_TOKEN set
- **Docker socket** - Access MCP servers and containers
- **Git integration** - Your SSH keys and config mounted
- **Shell history** - Persistent bash and zsh history

#### Security
- **SSH key-only auth** - Passwords disabled
- **Root login disabled** - Non-root user only
- **Tailscale VPN** - Encrypted WireGuard tunnel
- **Docker group access** - Socket permissions via group, not root

### Helper Script Commands

```bash
# Attach to existing or start new
./scripts/opencode

# Show container status
./scripts/opencode --status

# Get SSH connection info
./scripts/opencode --ssh

# Create new screen window
./scripts/opencode --new-session

# Stop container
./scripts/opencode --stop

# Show help
./scripts/opencode --help
```

### Session Management

Learn screen commands for persistent sessions:

| Action | Keys | Description |
|--------|------|-------------|
| Detach | `Ctrl+A` then `D` | Leave session running |
| New Window | `Ctrl+A` then `C` | Create terminal window |
| Next Window | `Ctrl+A` then `N` | Switch to next window |
| List Windows | `Ctrl+A` then `"` | Show all windows |
| Scrollback | `Ctrl+A` then `[` | Scroll terminal history |

**Full Guide:** See [docs/session-management.md](docs/session-management.md)

### Troubleshooting

**Container won't start?**
```bash
# Check Docker is running
docker info

# View logs
docker logs opencode

# Restart
./scripts/opencode --stop
./scripts/opencode
```

**SSH not working?**
```bash
# Re-add SSH key
./add-ssh-key.sh ~/.ssh/id_ed25519.pub

# Check SSH daemon
docker exec opencode pgrep sshd

# Get Tailscale IP
docker exec opencode_tailscale tailscale ip -4
```

**Screen session not found?**
```bash
# List sessions
docker exec opencode su - opencode -c "screen -ls"

# Manually create if missing
docker exec opencode su - opencode -c "screen -dmS opencode-main"
```

### Documentation

- **[Session Management Guide](docs/session-management.md)** - Learn screen/tmux
- **[Tailscale Setup](docs/tailscale-setup.md)** - Detailed SSH setup
- **[Migration Guide](MIGRATION.md)** - Migrate from old dual-container setup

## 🐳 Legacy Sandbox (Deprecated)

For maximum security and isolation, run OpenCode inside a Docker container. This setup:
- ✅ Prevents OpenCode from accessing sensitive host system files
- ✅ Isolates AI agent operations within container boundaries
- ✅ Enables `--dangerously-skip-permissions` mode safely
- ✅ Maintains full MCP server access via HTTP gateway
- ✅ Provides bidirectional workspace sync for code changes

### Quick Start

```bash
# One-line launcher (from any directory)
~/.config/opencode/scripts/opencode-sandbox

# Or specify custom workspace
~/.config/opencode/scripts/opencode-sandbox ~/my-project

# Update to latest OpenCode CLI (rebuilds container)
~/.config/opencode/scripts/opencode-sandbox --update

# Check OpenCode version in container
~/.config/opencode/scripts/opencode-sandbox --version
```

Inside the container, use OpenCode normally:
```bash
# All agents and MCP servers work transparently
opencode "Review this codebase and suggest improvements"

# Git operations work with your SSH keys (mounted read-only)
git commit -m "feat: add new feature"

# Exit when done
exit
```

### Architecture

```
┌─────────────────────────────────────────────────────┐
│              Docker Bridge Network                  │
│                                                     │
│  ┌──────────────┐    ┌─────────────────┐          │
│  │   OpenCode   │───▶│  MCP Gateway    │          │
│  │  Container   │    │  (HTTP/SSE)     │          │
│  │              │    │                 │          │
│  │ - Isolated   │    │  ├─ Remory      │──┐      │
│  │ - No host    │    │  └─ Perplexity  │  │      │
│  │   access     │    └─────────────────┘  │      │
│  └──────────────┘                          │      │
│                      ┌──────────────────┐  │      │
│                      │ Remory MCP Server│◀─┘      │
│                      │ + PostgreSQL     │          │
│                      └──────────────────┘          │
└─────────────────────────────────────────────────────┘

Mounts:
- Workspace: ~/git → /workspace (bidirectional)
- SSH Keys: ~/.ssh → /home/opencode/.ssh (read-only)
- Git Config: ~/.gitconfig (read-only)
```

### What's Inside

**Container Stack:**
- `opencode_sandbox` - Alpine Linux + Node.js 20 + OpenCode CLI
- `opencode_mcp_gateway` - Protocol translator (STDIO → HTTP/SSE)
- `remory_mcp_server` - Semantic memory with PostgreSQL backend
- `remory_mcp_postgres` - PostgreSQL + pgvector

**MCP Integration:**
- Container uses `opencode.container.json` config
- MCP servers accessed via HTTP endpoints (no STDIO)
- Gateway handles protocol translation automatically

### Manual Control

```bash
# Start sandbox
cd ~/.config/opencode
docker compose -f docker-compose.opencode.yml up -d --build

# Enter sandbox
docker exec -it opencode_sandbox zsh

# Check gateway status
docker logs opencode_mcp_gateway

# Stop sandbox
docker compose -f docker-compose.opencode.yml down
```

### Keeping OpenCode Updated

OpenCode CLI receives frequent updates (often daily). To update your container:

```bash
# Force rebuild with latest OpenCode from npm
~/.config/opencode/scripts/opencode-sandbox --update

# Compare container vs host versions
~/.config/opencode/scripts/opencode-sandbox --version
```

The `--update` flag:
- Rebuilds the Docker image with `--no-cache`
- Downloads the latest `@opencode/opencode` from npm
- Preserves all your project files and configurations

**Recommended:** Update weekly or when encountering issues.

### Troubleshooting

**MCP servers not working?**
```bash
# Check Remory is running
docker ps --filter "name=remory_mcp"

# Restart Remory if needed
cd ~/git/remory
docker compose -f docker-compose.mcp.yml up -d

# Check gateway logs
docker logs opencode_mcp_gateway
```

**Permission issues?**
```bash
# Rebuild with correct UID/GID
export USER_ID=$(id -u)
export GROUP_ID=$(id -g)
docker compose -f docker-compose.opencode.yml up -d --build
```

**Container won't start?**
```bash
# Check Docker is running
docker info

# Check for port conflicts
docker ps

# View compose logs
docker compose -f docker-compose.opencode.yml logs
```

## 🧪 Running Tests

The project uses **BATS (Bash Automated Testing System)** for testing container functionality.

### Install BATS

**macOS:**
```bash
brew install bats-core
```

**Docker-based (no installation needed):**
```bash
# Run tests using official BATS Docker image
docker run --rm -v "$PWD:/code" bats/bats:latest /code/tests/test_unified_container.bats
```

### Run Tests

```bash
# Local BATS installation
bats tests/test_unified_container.bats

# All tests in tests/ directory
bats tests/

# Docker-based runner (recommended for CI/CD)
docker run --rm -v "$PWD:/code" bats/bats:latest /code/tests/
```

## 📝 Environment Variables Required

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