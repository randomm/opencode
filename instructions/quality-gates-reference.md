# Quality Gates Reference Standard

**This file provides the authoritative quality standards referenced by all agents.**

## GitHub Issue Quality Template (Mandatory)

Every development issue MUST include these checkboxes:
- [ ] **TDD**: Write tests before implementation
- [ ] **Coverage**: 80%+ test coverage for new code (95%+ for critical paths like auth, payments, data integrity)
- [ ] **Linting**: All code passes project linting rules
- [ ] **Memory Protocol**: Search project memory before work, store findings after completion
- [ ] **Documentation**: Update README.md and relevant docs as specified in issue
- [ ] **Local Verification**: All tests pass locally before completion

## Test-Driven Development (TDD) Requirements

### The TDD Cycle
1. **RED**: Write a failing test that defines desired functionality
2. **GREEN**: Write minimal code to make the test pass
3. **REFACTOR**: Improve code quality while keeping tests green

### Testing Standards
- Tests must exist BEFORE implementation
- Tests cover normal cases, edge cases, and error conditions
- Tests are independent and can run in any order
- Tests run quickly (mock external dependencies)
- Test names clearly describe what they verify

## Quality Gate Enforcement (Zero Tolerance)

### Strictly Forbidden
- **NEVER suppress linting errors** with `# noqa`, `# type: ignore`, `@ts-ignore`, or similar
- **NEVER modify linter configs** to add ignores, excludes, or disable rules
- **NEVER skip failing tests** to make the suite pass
- **NEVER reduce coverage requirements** to meet thresholds
- **NEVER hide problems** by excluding files from checks

### The Only Acceptable Response
When quality checks fail, you MUST:
1. **Understand** the root cause of the failure
2. **Fix the actual code** to resolve the issue
3. **Verify** all checks pass after the fix
4. **Learn** from the pattern to prevent recurrence

## Local Verification Requirements

**MANDATORY: Local Test Verification**
- **ALWAYS** run the full test suite locally before declaring work done
- **READ** actual error messages if tests fail - don't guess or assume
- **FIX** all failing tests before moving on
- **VERIFY** coverage requirements are met with actual tools, not estimates
- **RUN** all linting and type checking tools locally
- **NEVER** say "tests should pass" - run them and confirm they DO pass

If you haven't run tests locally and verified they pass, the work is NOT complete.

**MANDATORY: Memory Protocol Compliance**
- **SEARCH** project memory before starting work (load context)
- **UPDATE** memories during work (track findings incrementally)
- **STORE** complete outcomes after work (preserve learnings)
- **VERIFY** all memory operations use project-scoped identifiers (`${PROJECT_ID}_`)
- **NEVER** skip memory operations "because task was small"

If you haven't searched AND stored project memories, the work is NOT complete.

## CI Completion Verification

**Never assume CI results - always verify actual CI completion:**
- Use `gh run watch [run-id]` for real-time monitoring (preferred)
- Use `watch -n 30 'gh run list --limit 1'` for periodic polling
- Use `gh run view [run-id] --json status,conclusion` to check specific run details
- Use `gh run view [run-id] --log-failed` for failure analysis
- Wait for actual CI completion before reporting success
- Check both build and test results, not just one or the other

**CI verification is mandatory for:**
- All pull requests before merge
- Feature branch pushes
- Release candidates
- Any code that affects production

## Implementation Guidelines

### Before Adding Code
1. **Question Necessity**: Challenge whether the feature is essential
2. **Plan Tests**: Define test cases before implementation
3. **Design Minimally**: Start with the simplest possible design

### During Development
1. **Write Test First**: Always start with a failing test
2. **Implement Minimally**: Write only enough code to pass the test
3. **Avoid Feature Creep**: Implement only what's specified in GitHub issue
4. **Remove Dead Code**: Delete unused functions, variables, and imports immediately

### Code Quality Standards
- Functions should do ONE thing well
- Prefer composition over inheritance
- Avoid deep nesting (max 3 levels)
- Use early returns to reduce complexity
- Prefer explicit over implicit
- Choose boring technology over cutting-edge

## Documentation Standards

### Essential Documentation (Only When Required)
- **README.md**: Project overview, setup, basic usage (when creating new projects)
- **API Documentation**: When implementing new APIs or endpoints
- **Setup Guides**: When complex setup is required for new features

### What NOT to Create (Unless Explicitly Requested)
- CHANGELOG.md files (use git history)
- TODO.md or ROADMAP.md files (use TodoWrite tool)
- PROJECT_PLAN.md or similar planning documents
- Architecture diagrams or documentation (unless requested)
- Random markdown files in arbitrary locations

## Scope Control Protocol

### Issue Content Validation
- **READ**: `gh issue view #123` for complete requirements
- **VALIDATE**: All work matches issue content exactly
- **REFUSE**: Any work not explicitly listed in issue
- **EXPAND**: Update issue before adding scope
- **COMPLETE**: Only when all issue checkboxes are done

### Quality Within Scope
- Apply quality standards to code mentioned in issue
- Update documentation only as specified in issue
- Test coverage for functionality described in issue
- Linting fixes only for files being modified per issue

## Anti-Patterns to Avoid

### Bloat Indicators
- Functions longer than 50 lines
- Classes with more than 7 methods
- Files larger than 300 lines
- More than 3 levels of abstraction
- Duplicated code blocks
- Unused variables, imports, or functions
- Speculative features ("we might need this later")

### Common Mistakes
- Writing code without tests
- Adding features "while I'm here"
- Creating abstractions for single use cases
- Keeping commented-out code
- Complex configurations for simple needs
- Premature optimization
- Not questioning requirements

**Remember: Every linting error can be fixed. Every type error can be resolved. Every test can pass properly. There are no exceptions to quality gates.**