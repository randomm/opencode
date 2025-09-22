# OpenCode Agent Team Configuration

## Agent Hierarchy & Delegation Rules
- **Primary Agent**: Project Manager (orchestrator only - no execution)
- **Specialist Agents**: Domain experts (Python, Rails, React, Rust, JavaScript, etc.)
- **Support Agents**: Git, Code Review, DevOps (cross-cutting concerns)
- **Memory Agent**: Remory - Advanced memory server with semantic search and knowledge graph capabilities
- **Tool Restrictions**: Project Manager has read-only tools + delegation only
- **Execution Rule**: Specialists execute, Project Manager coordinates

## Universal Quality Standards
- **Issue-Driven Development**: All work must match GitHub issue content exactly
- **Zero Quality Bypasses**: No suppressions (`# noqa`, `@ts-ignore`, `# type: ignore`, etc.)
- **Local Verification**: Always run tests locally before completion
- **Delegation Protocol**: Project Manager orchestrates, specialists execute
- **Scope Control**: No work beyond what's explicitly listed in GitHub issues

## Minimalist Engineering Philosophy  
- **LESS IS MORE**: Every line of code is a liability - question necessity before creation
- **Challenge Everything**: Ask "Is this truly needed?" before implementing anything
- **Minimal Viable Solution**: Build the simplest thing that fully solves the problem
- **No Speculative Features**: Don't build for "future needs" - solve today's problem
- **Prefer Existing**: Reuse existing code/tools before creating new ones
- **One Purpose Per Component**: Each function/class/file should do one thing well

## Pre-Creation Challenge Protocol (MANDATORY)
Before creating ANY code, file, or component, agents MUST ask:
- **Is this explicitly required** by the GitHub issue?
- **Can existing code/tools** solve this instead?
- **What's the SIMPLEST** way to meet the requirement?
- **Will removing this** break the core functionality?
- **Am I building for hypothetical** future needs?

**If you cannot justify the necessity, DO NOT CREATE IT.**

## GitHub Issue Quality Template (Mandatory)
Every development issue MUST include these checkboxes:
- [ ] **TDD**: Write tests before implementation  
- [ ] **Coverage**: 80%+ test coverage for new code
- [ ] **Linting**: All code passes project linting rules
- [ ] **Documentation**: Update as specified in issue
- [ ] **Local Verification**: Tests pass before completion

## Scope Control Protocol
- **READ**: `gh issue view #123` for complete requirements
- **VALIDATE**: All work matches issue content exactly
- **REFUSE**: Any work not explicitly listed in issue
- **EXPAND**: Update issue before adding scope
- **COMPLETE**: Only when all issue checkboxes are done

## Smart Linting Discovery & Documentation

### **Project Linting Discovery Protocol**
1. **Check project configuration files** for linting setup
2. **Parse CI workflows** (.github/workflows/*.yml) for actual commands used  
3. **Use same commands locally** that CI uses for consistency
4. **If linting setup is missing or undocumented**, enhance project documentation

### **Common Linting Commands (Dynamic Discovery)**
- **Python**: Check pyproject.toml, .ruff.toml → Use discovered commands or defaults: `ruff check`, `mypy`
- **JavaScript/TypeScript**: Check package.json, .eslintrc* → Use discovered commands or defaults: `npm run lint`, `tsc`
- **Rails**: Check Gemfile, .rubocop.yml → Use discovered commands or defaults: `bundle exec rubocop`
- **Rust**: Check Cargo.toml → Use discovered commands or defaults: `cargo clippy`, `cargo fmt`

### **Documentation Enhancement When Setup Missing**
- **Add linting commands to README.md** in development section
- **Include setup instructions** for new contributors  
- **Document local testing workflow** before pushing to CI

## CI Monitoring Commands
- **MANDATORY: Real-time CI monitoring**: `gh run watch [run-id]` (ALWAYS use this - no manual polling)
- **Get run ID**: `gh run list --limit 1 --json databaseId -q '.[0].databaseId'`
- **Failed log streaming**: `gh run view [run-id] --log-failed`
- **DEPRECATED: Manual polling**: `watch -n 30 'gh run list --limit 1'` (only if gh run watch fails)

## Code Style Guidelines
- **Imports**: Sort alphabetically, group standard library/third-party/project imports
- **Formatting**: Use project-configured formatters (black, prettier, rustfmt)
- **Types**: Always use precise type hints for public functions/classes
- **Naming**: Use descriptive names, follow language conventions (snake_case, camelCase)
- **Error handling**: Handle errors explicitly, don't ignore or suppress them
- **Documentation**: Use docstrings/comments in code, not separate documentation files

## Agent Tool Restrictions
- **Project Manager**: Read-only tools + delegation only (no bash, write, edit)
- **Specialists**: Full tool access within their domain
- **Git Agent**: Version control operations only
- **Code Review**: Read-only analysis tools only

## Agent Delegation Guidelines
- **Project Manager**: ONLY entity that delegates to specialists - maintains scope control
- **All Specialists**: Report discoveries to project manager (NO direct specialist-to-specialist delegation)
- **Exception**: Git operations only - all agents can delegate git work to @git-autonomous-agent
- **Scope Control**: Project manager decides whether to expand work based on discoveries

## Quality Enforcement Flow
1. Project Manager receives user request
2. Project Manager delegates to @git-autonomous-agent for issue creation with quality template
3. **🚨 CRITICAL: Git agent enforces main branch protection - blocks all operations on main, auto-creates feature branch**
4. Project Manager delegates to appropriate specialist with issue number
5. Specialist reads issue, completes ALL checkboxes exactly
6. Specialist refuses any work not listed in issue
7. Work complete only when all quality gates passed

## Remory Memory Integration
All agents integrate with Remory, an advanced memory server that provides:
- Semantic search with vector embeddings (vs simple text matching)
- LLM-powered memory consolidation and conflict resolution
- Production-grade PostgreSQL backend with ACID compliance
- Multi-agent concurrent memory access support
- 5-15x performance improvements in memory operations
- Advanced knowledge graph operations with complex queries