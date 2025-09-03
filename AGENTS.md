# AGENTS.md

## Build/Lint/Test Commands
- **Python**: `pytest` (tests), `ruff check` (linting), `mypy` (type checking), `black` (formatting)
- **JavaScript/TypeScript**: `npm test` (tests), `eslint` (linting), `tsc` (type checking)
- **Rails**: `bundle exec rspec` (tests), `rubocop` (linting)
- **Rust**: `cargo test` (tests), `clippy` (linting), `rustfmt` (formatting)
- **Run single test**: `pytest -k "test_name"` or `npm test -- -t "test_name"`

## Code Style Guidelines
- **Imports**: Sort alphabetically, group standard library/third-party/project imports
- **Formatting**: Use project-configured formatters (black, prettier, rustfmt)
- **Types**: Always use precise type hints for public functions/classes
- **Naming**: Use descriptive names, follow language conventions (snake_case, camelCase)
- **Error handling**: Handle errors explicitly, don't ignore or suppress them
- **Documentation**: Use docstrings/comments in code, not separate documentation files

## Quality Gate Rules
- **Zero tolerance** for `# noqa`, `# type: ignore`, `@ts-ignore`, or similar suppressions
- **All linting must pass** before commits - fix issues, don't suppress them
- **Minimum 80% test coverage** for new features (95%+ for critical paths)
- **Never assume CI results** - always verify actual CI completion
- **Delegate git operations** to @git-autonomous-agent

## Agent Delegation
- **Project Manager**: Orchestrates tasks, delegates to specialists
- **Python/Rust/JS/Rails**: Implementation specialists for their domains
- **React**: Frontend component specialist
- **PostgreSQL/AWS**: Database specialists
- **API Design**: REST/GraphQL architecture specialist
- **DevOps**: Infrastructure and deployment specialist
- **Code Review**: Security and performance analysis specialist
- **Git Agent**: All version control operations