# Python Quality Rules

When working with Python files (*.py):
- Use `ruff` for linting, `mypy` for type checking
- Prefer `uv run` over direct commands for dependency isolation
- pytest for testing with `--cov` for coverage
- Type hints required for all public functions
- Docstrings required for public APIs
- No bare `except:` clauses
- Use context managers for resources
- Zero tolerance for quality gate violations
