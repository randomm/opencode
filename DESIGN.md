# OpenCode Configuration Design Intent

## Vision: Your Independent AI Delivery Team

This OpenCode configuration is designed as an **independent AI delivery team** that handles complete software development workflows. The key principle: **you stay high-level, the team handles execution details**.

### The Core Experience

```
You: "Add OAuth authentication with 2FA support"

Project Manager:
  ├─ Creates GitHub issue with quality checklist
  ├─ Delegates database schema → @postgres-database-expert
  ├─ Delegates API design → @api-design-architect
  ├─ Delegates backend implementation → @python-best-practices-architect
  ├─ Delegates frontend → @react-frontend-specialist
  ├─ Delegates testing → Each specialist (TDD enforced)
  ├─ Delegates code review → @github-pr-reviewer
  ├─ Delegates git operations → @git-autonomous-agent
  └─ Delivers: Production-ready feature, tested, reviewed, merged

You: Approve and continue with next high-level task
```

**You communicate requirements. The team delivers working software.**

## Design Philosophy

### 1. Orchestrator-Specialist Pattern

**Why this architecture?**

Traditional AI coding assistants try to do everything themselves:
- Single agent context limits
- No domain specialization
- Mixed capabilities (architecture + git + testing + deployment)
- User must manage low-level details

This configuration separates **coordination** from **execution**:

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
          │  Python │ Rust │ Rails │ React │ DevOps     │
          │  Git │ Database │ API │ Code Review         │
          └──────────────────────────────────────────────┘
```

**Benefits:**
- **User focuses on WHAT, not HOW**: You define goals, PM figures out execution
- **Domain expertise**: Each specialist is expert in their technology stack
- **Parallel execution**: Multiple specialists work simultaneously
- **Quality enforcement**: PM ensures all quality gates pass before completion
- **Context management**: PM maintains cross-domain context, specialists focus on their domain

### 2. Permission Boundaries (Security Through Isolation)

**Project Manager (Primary Agent):**
- **Tools**: Read, Glob, Grep, WebFetch, TodoWrite, Memory
- **Bash**: Memory CLI only (`remory`, `export PROJECT_ID`, etc.)
- **CANNOT**: Write files, edit code, execute bash commands, run git operations
- **Purpose**: Orchestrator must not execute - forces proper delegation

**Specialist Agents (Subagents):**
- **Tools**: Full execution (Bash, Read, Write, Edit, etc.)
- **Bash**: Everything EXCEPT git write operations
- **CANNOT**: Git add, commit, push, merge, PR creation
- **Purpose**: Execute in their domain, delegate git to @git-autonomous-agent

**Git Agent (Subagent):**
- **Tools**: Full bash access for all git/gh CLI operations
- **Purpose**: Single source of truth for version control

**Review Agents (Subagents):**
- **Tools**: Read-only analysis tools
- **Bash**: Testing commands, linting tools (read-only validation)
- **CANNOT**: Write code, edit files, modify git
- **Purpose**: Review without altering

**Why these boundaries?**
- **Separation of concerns**: Orchestration vs execution vs version control
- **Predictable workflows**: PM must delegate, can't take shortcuts
- **Security**: Reduced blast radius if agent misbehaves
- **Quality gates**: Git operations gated by test passage and reviews

### 3. Model Selection Strategy

**Project Manager: Claude Sonnet 4.5**

Why Sonnet for orchestration?
- **Superior reasoning**: Understands complex multi-domain requirements
- **Context management**: Maintains state across long conversations
- **Routing intelligence**: Makes sophisticated delegation decisions
- **Quality enforcement**: Remembers and enforces all quality gates
- **User communication**: Articulates status and decisions clearly

**Specialists: Faster Models**

Models that work well:
- `qwen3-coder` - Excellent code generation, fast, cost-effective
- `claude-haiku-4.5` - Fast Claude variant, good for focused tasks
- `claude-sonnet-4.5` - Same as PM (when maximum quality needed)
- `grok-fast-1` - Fast inference, good for routine implementations

Why faster models for specialists?
- **Cost efficiency**: Specialists do focused, bounded work
- **Speed**: Faster model = faster delivery for routine tasks
- **Parallelization**: Multiple specialists working simultaneously
- **Quality maintained**: PM ensures quality gates, specialist speed optimized

**Trade-off:**
```
Sonnet PM + Fast Specialists
  ✅ Best reasoning for routing and coordination
  ✅ Fast execution for implementation
  ✅ Cost-effective at scale
  ✅ Maintains quality through PM oversight

All Sonnet (PM + Specialists)
  ✅ Maximum quality everywhere
  ❌ Expensive
  ❌ Slower
  ❌ Overkill for simple tasks

All Fast Models (PM + Specialists)
  ❌ Poor routing decisions
  ❌ Quality gate enforcement breaks down
  ❌ User must micromanage
  ✅ Cheapest
```

**Recommended setup:**
- Development/prototyping: Sonnet PM + qwen3-coder specialists
- Production/critical: Sonnet PM + Sonnet specialists
- Budget-conscious: Sonnet PM + Haiku specialists

Set via environment variable:
```bash
export SUBAGENT_MODEL="anthropic/claude-haiku-4"
export SUBAGENT_MODEL="qwen/qwen3-coder-32b"
export SUBAGENT_MODEL="anthropic/claude-sonnet-4.5"
```

## Key Design Principles

### 1. Minimalist Engineering

**"Less is more" philosophy:**
- Question necessity before creating anything
- Build simplest solution that fully solves the problem
- Reuse existing code/tools before writing new ones
- No speculative features ("we might need this later")

**Enforced through:**
- Pre-creation challenge protocol in agent prompts
- PM questions scope creep
- GitHub issue defines exact requirements
- Specialists refuse work beyond issue scope

### 2. Test-Driven Development (Mandatory)

**All code must follow TDD:**
1. Write failing test FIRST
2. Implement minimum code to pass
3. Refactor if needed
4. Achieve 80%+ coverage (95%+ for critical paths)

**Enforced through:**
- GitHub issue quality template includes TDD checkbox
- Specialists cannot proceed without tests
- Local test execution before any git operations
- CI/CD validates test passage

### 3. Issue-Driven Workflow

**All work starts with GitHub issue:**
- PM creates issue with quality checklist
- Issue defines exact scope and deliverables
- Specialists read issue with `gh issue view #123`
- Work beyond issue scope is refused
- Completion = all checkboxes checked

**Benefits:**
- Clear requirements
- Traceability
- Scope control
- Quality gates visible
- Cross-session continuity (issue captures context)

### 4. Memory-Driven Context

**Remory CLI for institutional memory:**
- Project-scoped memory (`PROJECT_ID` per repository)
- Semantic search for relevant context
- Cross-session continuity
- Decisions, patterns, learnings preserved

**Usage pattern:**
```bash
# At session start: Load context
remory search "project architecture decisions" --user-id "$PROJECT_ID"

# During work: Store learnings
remory add "Decided on PostgreSQL for ACID requirements and JSON support" \
  --user-id "$PROJECT_ID" --infer false

# Next session: Context available immediately
```

**Why `--infer false`?**
- Preserves full text without LLM extraction
- Future sessions get complete context, not summaries
- Decisions include rationale, not just conclusions

## User Experience Patterns

### Pattern 1: Feature Development

```
User: "Add dark mode toggle to settings"

PM:
  1. Creates GitHub issue #42 with quality checklist
  2. Delegates to @react-frontend-specialist
     - Specialist implements component with tests
     - Runs linting and type checking
     - Achieves 85% test coverage
  3. Delegates to @git-autonomous-agent
     - Creates feature branch
     - Commits changes
     - Pushes to remote
     - Creates PR
  4. Delegates to @github-pr-reviewer
     - Reviews code quality
     - Checks test coverage
     - Approves PR
  5. Delegates to @git-autonomous-agent for merge
  6. Reports completion to user

User: Sees "Feature complete. PR #123 merged."
```

### Pattern 2: Multi-Domain Feature

```
User: "Add payment processing with Stripe"

PM:
  1. Creates GitHub issue #56
  2. Delegates database schema to @postgres-database-expert
  3. Delegates API design to @api-design-architect
  4. Delegates backend to @python-best-practices-architect
  5. Delegates frontend to @react-frontend-specialist
  6. Coordinates testing across all layers
  7. Delegates deployment config to @devops-infrastructure
  8. Delegates git operations and PR creation
  9. Ensures all quality gates pass

User: Sees "Payment processing complete. Tested in staging."
```

### Pattern 3: Investigation & Research

```
User: "Why is the login endpoint slow?"

PM:
  1. Delegates to @research-specialist for investigation
     - Researcher checks database query logs and patterns
     - Identifies N+1 query problem
     - Reports findings with evidence
  2. Delegates fix to @rails-architect
     - Implements eager loading
     - Adds tests to prevent regression
  3. Delegates performance verification to @devops-infrastructure
     - Confirms 10x improvement in staging
  4. Standard git workflow for merge

User: Sees "Performance issue resolved. Login now 150ms (was 1.8s)."
```

## Quality Enforcement Flow

```
1. User provides high-level requirement
   ↓
2. PM creates GitHub issue with quality checklist
   ↓
3. PM delegates to specialist(s)
   ↓
4. Specialist implements with TDD
   ├─ Write failing tests first
   ├─ Implement minimal code
   ├─ Run linting and type checking
   ├─ Achieve coverage requirements
   └─ Verify all tests pass locally
   ↓
5. Specialist reports completion to PM
   ↓
6. PM delegates to @git-autonomous-agent
   ├─ Create/update feature branch
   ├─ Commit changes with conventional format
   ├─ Push to remote
   └─ Create pull request
   ↓
7. PM delegates to @github-pr-reviewer
   ├─ Review code quality and security
   ├─ Verify test coverage
   ├─ Check for anti-patterns
   └─ Approve or request changes
   ↓
8. If changes needed: Loop back to step 3
   ↓
9. If approved: PM delegates merge to @git-autonomous-agent
   ↓
10. PM reports completion to user
```

**Critical gates that cannot be bypassed:**
- TDD: Tests must exist and pass before git operations
- Coverage: 80%+ for features, 95%+ for critical paths
- Linting: Zero warnings/errors
- PR Review: Must be approved before merge
- CI Passing: Must be green before merge

## Design Trade-offs

### What We Optimized For

✅ **User stays high-level**: No micromanagement of implementation details
✅ **Quality enforcement**: Impossible to bypass quality gates
✅ **Cross-domain coordination**: PM handles dependencies between domains
✅ **Institutional memory**: Context persists across sessions
✅ **Cost-efficiency**: Fast models for focused work, Sonnet for coordination

### What We Traded Away

❌ **Single-agent simplicity**: More complex than monolithic assistant
❌ **Instant responses**: Delegation adds latency vs direct execution
❌ **Manual control**: Can't skip quality gates "just this once"
❌ **Flexibility**: Strict boundaries mean less agent autonomy

### Why These Trade-offs Make Sense

**For software development at scale:**
- Quality matters more than speed
- Coordination matters more than single-agent capability
- Long-term maintainability matters more than short-term convenience
- Team-like collaboration matters more than individual heroics

**This configuration treats AI agents like a real development team:**
- Clear roles and responsibilities
- Quality-first culture
- Cross-functional collaboration
- Project manager coordinates, specialists execute

## Configuration Files Map

```
.
├── opencode.json                 # Agent definitions, tools, permissions
│
├── prompts/                      # Agent system prompts
│   ├── project-manager.txt       # PM orchestration logic
│   ├── python-best-practices.txt # Python specialist
│   ├── rust-tdd-architect.txt    # Rust specialist
│   ├── rails-architect.txt       # Rails specialist
│   ├── react-frontend.txt        # React specialist
│   ├── git-autonomous.txt        # Git operations
│   ├── github-pr-reviewer.txt    # PR review
│   ├── research-specialist.txt   # Investigation
│   └── ... (16 agents total)
│
├── instructions/                 # Global development standards
│   ├── github-workflow-mandatory.md      # Issue-driven workflow
│   ├── memory-protocol-mandatory.md      # Remory usage
│   ├── quality-gates-reference.md        # TDD, coverage, linting
│   ├── no-unsolicited-files.md           # Minimalist file creation
│   └── commit-all-changes.md             # Git delegation protocol
│
├── command/                      # Custom commands
│   └── session-start.md          # Session initialization with memory
│
├── DESIGN.md                     # This document (intent and decisions)
├── AGENTS.md                     # Quality standards and delegation rules
├── README.md                     # Technical setup and architecture
└── CLAUDE.md                     # Project-specific instructions
```

## When To Use This Configuration

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

## Extending This Configuration

### Adding a New Specialist

1. Create prompt file in `prompts/new-specialist.txt`
2. Define in `opencode.json`:
   - Description
   - Mode: "subagent"
   - Model: `{env:SUBAGENT_MODEL}`
   - Permissions (deny git operations)
   - Tools needed
3. Update `project-manager.txt` specialist routing section
4. Test with PM delegation

### Customizing Quality Gates

Edit `instructions/quality-gates-reference.md`:
- Adjust coverage requirements
- Add/remove linting tools
- Modify testing requirements

All specialists read this instruction file automatically.

### Changing Model Strategy

Set environment variable:
```bash
# In ~/.config/opencode/.env
SUBAGENT_MODEL="anthropic/claude-haiku-4"   # Fast and cheap
SUBAGENT_MODEL="qwen/qwen3-coder-32b"       # Best cost/performance
SUBAGENT_MODEL="anthropic/claude-sonnet-4.5" # Maximum quality
```

PM always uses Sonnet 4.5 (defined in `opencode.json` as primary agent).

---

**This configuration implements a simple idea: treat AI agents like a professional development team, with clear roles, quality standards, and user-friendly high-level communication.**

**You define what needs to be built. The team figures out how and delivers it with quality.**
