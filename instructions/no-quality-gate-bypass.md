# NO QUALITY GATE BYPASS POLICY

**CRITICAL: This policy applies to ALL agents and ALL code changes. Zero tolerance for quality gate bypasses.**

## The Problem

Teams have been undermining code quality by suppressing linting errors instead of fixing them. This creates technical debt, hides real issues, and degrades the codebase over time. This behavior stops NOW.

## STRICTLY FORBIDDEN ACTIONS

### 1. Code Suppression Comments
**NEVER ADD THESE:**
- `# noqa` - Disables all linting for a line
- `# noqa: [code]` - Disables specific linting rules
- `# type: ignore` - Ignores type checking errors
- `# pylint: disable=` - Disables pylint checks
- `# fmt: off` / `# fmt: on` - Disables formatters
- `// eslint-disable` - JavaScript linting bypasses
- `@SuppressWarnings` - Java warning suppressions
- Any language-specific suppression syntax

### 2. Configuration File Modifications
**NEVER MODIFY THESE TO ADD IGNORES:**
- `.ruff.toml` - Do not add to ignore lists
- `pyproject.toml` - Do not modify linting sections
- `setup.cfg` - Do not add ignore patterns
- `.flake8` - Do not add ignore codes
- `.pylintrc` - Do not disable checks
- `.eslintrc` - Do not add rules exceptions
- `tslint.json` - Do not disable rules
- Any linter or formatter configuration file

### 3. Exclusion Patterns
**NEVER ADD:**
- Files to `exclude` lists in configs
- Directories to ignore patterns
- Glob patterns to skip checks
- Files to `.gitignore` to hide problems

### 4. Test Bypasses
**NEVER:**
- Skip failing tests with `@skip` or `pytest.skip`
- Mark tests as expected failures without fixing
- Reduce coverage requirements
- Exclude files from coverage reports
- Disable test suites

## THE ONLY ACCEPTABLE RESPONSE

When a linting error or quality check fails:

1. **UNDERSTAND** the error - what is the tool telling you?
2. **FIX** the root cause in the code
3. **VERIFY** the fix resolves the issue
4. **LEARN** from the pattern to avoid future occurrences

## Examples of What NOT to Do

### ❌ WRONG: Adding suppressions
```python
# BAD - Adding noqa to suppress
result = complex_calculation()  # noqa: C901

# BAD - Adding type ignore
data: Any = get_data()  # type: ignore

# BAD - Disabling for entire file
# flake8: noqa
```

### ❌ WRONG: Modifying configs
```toml
# BAD - Adding to ruff.toml
[tool.ruff]
ignore = ["E501", "C901", "PLR0913"]  # Don't do this!

# BAD - Excluding files
exclude = ["src/legacy/*", "tests/broken_test.py"]  # Don't do this!
```

### ✅ CORRECT: Fix the actual issues
```python
# GOOD - Refactor complex function
def calculate_result():
    """Simplified, well-structured function."""
    step1 = prepare_data()
    step2 = process_data(step1)
    return finalize_result(step2)

# GOOD - Add proper type hints
from typing import Dict, List
data: Dict[str, List[int]] = get_data()

# GOOD - Fix line length issues
long_message = (
    "This is a properly formatted long string "
    "that respects line length limits"
)
```

## Exceptional Cases Protocol

In the EXTREMELY RARE case (< 0.1% of situations) where suppression might be considered:

1. **Third-party code** you cannot modify
2. **Generated code** that will be regenerated
3. **Known tool bugs** with open issues

Even then, you MUST:
1. Document WHY suppression is unavoidable
2. Include ticket/issue reference
3. Set a timeline for resolution
4. Get explicit approval
5. Track as technical debt

Example of properly documented exception:
```python
# TODO(#1234): Remove when upstream library fixes typing
# third_party_lib has incorrect type stubs, tracked in their issue #5678
from third_party_lib import broken_function  # type: ignore[import]
```

## Enforcement

### Pre-commit Checks
All projects should implement pre-commit hooks that:
- Detect new suppression comments
- Detect config file modifications
- Fail the commit if violations found
- Provide clear error messages

### Code Review
Reviewers MUST:
- Reject PRs with new suppressions
- Require fixes, not workarounds
- Verify all quality gates pass
- Check for hidden bypasses

### Continuous Integration
CI pipelines should:
- Run all linting tools
- Fail on any suppressions
- Track suppression metrics
- Alert on bypass attempts

## Escalation Path

If someone insists on bypassing quality gates:

1. **Refuse** - Clearly state this violates policy
2. **Educate** - Explain why bypasses harm code quality
3. **Assist** - Help them fix the root cause
4. **Document** - Record the attempt and resolution
5. **Escalate** - If pressure continues, escalate to senior review

## The Bottom Line

**Quality gates exist for a reason. They prevent bugs, improve maintainability, and ensure consistent code quality. Bypassing them is technical sabotage.**

Every linting error can be fixed. Every type error can be resolved. Every test can be made to pass properly. There are no exceptions to quality.

**FIX THE CODE, DON'T SUPPRESS THE WARNING.**