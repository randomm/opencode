# Test-Driven Development & Minimalist Engineering

Follow these principles when developing features, fixing bugs, or refactoring code.

## Core Philosophy: Less is More

Every line of code is a liability. Each function, class, and module increases:
- Maintenance burden
- Potential for bugs
- Cognitive load for future developers
- Build and runtime performance costs

Before writing code, ask:
- Is this feature truly necessary?
- Can existing code be reused or adapted?
- What's the simplest solution that fully solves the problem?
- Can this be achieved with fewer dependencies?

## Test-Driven Development (TDD) Requirements

### The TDD Cycle
1. **RED**: Write a failing test that defines desired functionality
2. **GREEN**: Write minimal code to make the test pass
3. **REFACTOR**: Improve code quality while keeping tests green

### Testing Standards

#### Coverage Requirements
- New features MUST achieve minimum 80% test coverage
- Critical paths (authentication, payments, data integrity) require 95%+ coverage
- Coverage includes:
  - Unit tests for individual functions/methods
  - Integration tests for component interactions
  - Edge cases and error conditions
  - Both happy and unhappy paths

#### Test Organization
- Place tests close to the code they test
- Use descriptive test names that explain the scenario
- Group related tests logically
- Each test should test ONE thing

#### Test Quality Checklist
Before considering a feature complete, verify:
- [ ] Tests exist BEFORE implementation
- [ ] Tests cover normal cases
- [ ] Tests cover edge cases
- [ ] Tests cover error conditions
- [ ] Tests are independent and can run in any order
- [ ] Tests run quickly (mock external dependencies)
- [ ] Test names clearly describe what they verify
- [ ] Coverage meets or exceeds 80%

## Implementation Guidelines

### Before Adding Code
1. **Search First**: Check if similar functionality exists
2. **Question Necessity**: Challenge whether the feature is essential
3. **Design Minimally**: Start with the simplest possible design
4. **Plan Tests**: Define test cases before implementation

### During Development
1. **Write Test First**: Always start with a failing test
2. **Implement Minimally**: Write only enough code to pass the test
3. **Avoid Premature Optimization**: Make it work, then make it right, then (maybe) make it fast
4. **Resist Feature Creep**: Implement only what's specified
5. **Remove Dead Code**: Delete unused functions, variables, and imports immediately

### Code Simplicity Rules
- Functions should do ONE thing well
- Prefer composition over inheritance
- Avoid deep nesting (max 3 levels)
- Use early returns to reduce complexity
- Prefer explicit over implicit
- Choose boring technology over cutting-edge

### Dependency Management
- Question every new dependency
- Prefer standard library over external packages
- Audit dependencies for:
  - Security vulnerabilities
  - Maintenance status
  - Size and performance impact
  - License compatibility
- Document why each dependency is necessary

## Refactoring Discipline

When refactoring existing code:
1. **Ensure tests exist** before changing anything
2. **Make small, incremental changes**
3. **Run tests after each change**
4. **Simplify rather than add complexity**
5. **Remove code more often than adding it**

## Documentation Philosophy

**Code and Tests ARE the Documentation**
- Well-written code is self-documenting
- Tests demonstrate how to use the code
- Comments explain WHY, not WHAT
- NEVER create documentation files unless explicitly requested

**What NOT to Create:**
- ❌ README files (unless asked)
- ❌ API documentation files (use docstrings/comments instead)
- ❌ Architecture documents (explain in chat if asked)
- ❌ TODO or ROADMAP files (use TodoWrite tool)
- ❌ Any markdown documentation (unless specifically requested)

## Quality Gate Integrity

### ZERO TOLERANCE for Bypass Attempts

**Quality gates are NON-NEGOTIABLE. They exist to maintain code standards and prevent technical debt.**

#### STRICTLY FORBIDDEN:
- **NEVER suppress linting errors** with `# noqa`, `# type: ignore`, or similar comments
- **NEVER modify linter configs** to add ignores, excludes, or disable rules
- **NEVER skip failing tests** to make the suite pass
- **NEVER reduce coverage requirements** to meet thresholds
- **NEVER hide problems** by excluding files from checks

#### THE ONLY ACCEPTABLE RESPONSE:
When quality checks fail, you MUST:
1. **Understand** the root cause of the failure
2. **Fix the actual code** to resolve the issue
3. **Verify** all checks pass after the fix
4. **Learn** from the pattern to prevent recurrence

#### Enforcement:
- Pre-commit hooks detect and block bypass attempts
- Code reviews reject PRs with suppressions
- CI pipelines fail on any quality gate violations
- All bypass attempts are tracked and escalated

#### Remember:
**Every linting error can be fixed. Every type error can be resolved. Every test can pass properly.**

Bypassing quality gates is technical sabotage. There are no exceptions.

## CRITICAL: Local Test Verification

**NEVER consider work complete without running tests locally:**
- **ALWAYS** run the full test suite locally before declaring work done
- **READ** actual error messages if tests fail - don't guess or assume
- **FIX** all failing tests before moving on
- **VERIFY** coverage requirements are met with actual tools, not estimates
- **RUN** all linting and type checking tools locally
- **NEVER** say "tests should pass" - run them and confirm they DO pass

If you haven't run tests locally and verified they pass, the work is NOT complete.

## Anti-Patterns to Avoid

### Bloat Indicators
- Functions longer than 50 lines
- Classes with more than 7 methods
- Files larger than 300 lines
- More than 3 levels of abstraction
- Duplicated code blocks
- Unused variables, imports, or functions
- Over-engineered solutions for simple problems
- Speculative features ("we might need this later")

### Common Mistakes
- Writing code without tests
- Adding features "while I'm here"
- Creating abstractions for single use cases
- Keeping commented-out code
- Complex configurations for simple needs
- Premature optimization
- Not questioning requirements

## Review Checklist

Before committing code, verify:
- [ ] **Tests have been RUN LOCALLY and PASS**
- [ ] All new code has corresponding tests
- [ ] Test coverage meets minimum requirements (verified with coverage tools)
- [ ] No unnecessary code was added
- [ ] Existing functionality wasn't duplicated
- [ ] Code complexity is justified by requirements
- [ ] Dead code has been removed
- [ ] Dependencies are minimal and necessary
- [ ] The solution is the simplest that works
- [ ] **All linting/formatting tools have been run and pass**

## Example Approach

When asked to implement a new feature:

1. **Clarify Requirements**
   - What problem does this solve?
   - What's the minimum viable solution?
   - Can existing code be reused?

2. **Design Tests First**
   ```
   - Test: Should validate email format
   - Test: Should reject invalid emails
   - Test: Should handle null/undefined
   - Test: Should normalize email case
   ```

3. **Implement Minimally**
   - Write simplest code to pass tests
   - Avoid adding "nice to have" features
   - Don't optimize prematurely

4. **Measure Coverage**
   - Run coverage tools
   - Identify untested paths
   - Add tests until 80%+ reached

5. **Refactor if Needed**
   - Only if it reduces complexity
   - Only if tests still pass
   - Only if it removes code

Remember: The best code is no code. The next best is less code that fully solves the problem with comprehensive tests.