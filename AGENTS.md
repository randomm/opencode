# OpenCode Agent Team Configuration

## Agent Hierarchy & Delegation Rules
- **Primary Agent**: Project Manager (orchestrator only - no execution)
- **Specialist Agents**: Domain experts (Python, Rails, React, Rust, JavaScript, etc.)
- **Support Agents**: Git, Code Review, DevOps (cross-cutting concerns)
- **Tool Restrictions**: Project Manager has read-only tools + delegation only
- **Execution Rule**: Specialists execute, Project Manager coordinates

## Universal Quality Standards
- **Issue-Driven Development**: All work must match GitHub issue content exactly
- **Zero Quality Bypasses**: No suppressions (`# noqa`, `@ts-ignore`, `# type: ignore`, etc.)
- **Local Verification**: Always run tests locally before completion
- **Delegation Protocol**: Project Manager orchestrates, specialists execute
- **Scope Control**: No work beyond what's explicitly listed in GitHub issues

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

## Build/Lint/Test Commands
- **Python**: `pytest` (tests), `ruff check` (linting), `mypy` (type checking), `black` (formatting)
- **JavaScript/TypeScript**: `npm test` (tests), `eslint` (linting), `tsc` (type checking)
- **Rails**: `bundle exec rspec` (tests), `rubocop` (linting)
- **Rust**: `cargo test` (tests), `clippy` (linting), `rustfmt` (formatting)
- **Run single test**: `pytest -k "test_name"` or `npm test -- -t "test_name"`

## CI Monitoring Commands
- **Real-time CI monitoring**: `gh run watch [run-id]` (preferred for live updates)
- **Polling monitoring**: `watch -n 30 'gh run list --limit 1'` (check latest run every 30s)
- **Background monitoring**: `watch -n 30 'command' &` (run monitoring in background)
- **CI status check**: `gh run view [run-id] --json status,conclusion`
- **Failed log streaming**: `gh run view [run-id] --log-failed`

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
- **Project Manager**: Orchestrates tasks, delegates to specialists, never executes code
- **Python/Rust/JS/Rails**: Implementation specialists for their domains
- **React**: Frontend component specialist
- **PostgreSQL/AWS**: Database specialists
- **API Design**: REST/GraphQL architecture specialist
- **DevOps**: Infrastructure and deployment specialist
- **Code Review**: Security and performance analysis specialist
- **Git Agent**: All version control operations

## Quality Enforcement Flow
1. Project Manager receives user request
2. Project Manager delegates to @git-autonomous-agent for issue creation with quality template
3. Project Manager delegates to appropriate specialist with issue number
4. Specialist reads issue, completes ALL checkboxes exactly
5. Specialist refuses any work not listed in issue
6. Work complete only when all quality gates passed