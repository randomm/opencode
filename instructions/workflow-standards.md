# Workflow Standards for Development and Commits

## Overview

**CRITICAL:** ALL development work MUST follow GitHub issue + feature branch workflow.

**EXCEPTION:** Pure research/analysis tasks can be delegated directly without GitHub issues.

**GITHUB OPERATIONS:** Use `gh` CLI exclusively (never browser, never API calls)

**PROJECT MANAGER:** Delegate ALL GitHub operations to @git-agent
- `gh issue view/list` - Checking if issues exist
- `gh issue create` - Creating issues
- `gh pr view/list/create` - PR operations
- `gh run view/watch` - CI status checks

---

## Research vs Development Tasks

### 🔍 RESEARCH/ANALYSIS TASKS (NO ISSUE REQUIRED)

**Direct delegation allowed for:**
- **Session initialization** (`/session-start` command) - Context gathering only
- Information gathering and research
- Technology evaluation and comparison
- Pricing analysis and cost assessment
- Feasibility studies without implementation
- Tool/service recommendations
- Architecture research and analysis

**NO GitHub workflow for these tasks:**
- ❌ No GitHub issues needed
- ❌ No feature branches
- ❌ No commits or pushes
- ✅ Read-only operations only

**Keywords indicating research:** research, investigate, analyze, compare, evaluate, find, assess, study, pricing, alternatives, feasibility, pros/cons, session-start, initialization, context

---

### 💻 DEVELOPMENT TASKS (GITHUB ISSUE MANDATORY)

#### NO DEVELOPMENT WITHOUT GITHUB ISSUE

- **BEFORE ANY DEVELOPMENT**: Delegate to @git-agent to verify GitHub issue exists
- **IF NO ISSUE**: @git-agent will create issue via gh CLI
- **REFUSE ALL DEVELOPMENT WORK** without proper GitHub issue tracking
- **INCLUDE ISSUE REFERENCE** in all commits and communications

**PROJECT MANAGER NOTE:** You have NO bash access and cannot run `gh` commands directly.
Always delegate GitHub verification and operations to @git-agent.

---

## Feature Branch Workflow MANDATORY

### Core Requirements

- **NEVER work directly in main branch**
- **ALWAYS create feature branch**: `feature/issue-123-description` or `fix/issue-456-bugname`
- **BRANCH FIRST**: Create branch before any code changes
- **PUSH TO FEATURE BRANCH**: All work goes to feature branch, not main

### Development Workflow Enforcement Steps

**PROJECT MANAGER WORKFLOW:**
1. **DELEGATE ISSUE VERIFICATION**: Ask @git-agent to check if GitHub issue exists
2. **WAIT FOR RESPONSE**: If no issue, @git-agent creates one
3. **DELEGATE WORK**: Once issue confirmed, delegate to appropriate specialist
4. **WAIT FOR COMPLETION**: Specialist implements in feature branch
5. **DELEGATE PR CREATION**: @git-agent creates PR
6. **DELEGATE CI CHECK**: @git-agent monitors CI status
7. **DECLARE SUCCESS**: Only after CI green and @git-agent confirms

**DEVELOPMENT AGENT WORKFLOW:**
1. **RECEIVE TASK**: From project manager with issue number
2. **CREATE FEATURE BRANCH**: From current main branch
3. **IMPLEMENT CHANGES**: Work in feature branch only
4. **PUSH TO REMOTE**: Push feature branch regularly
5. **REPORT COMPLETION**: To project manager
6. **PM HANDLES REST**: PR creation and CI monitoring delegated to git agent

### Workflow Violation Detection

Development agents MUST check for violations before starting DEVELOPMENT work:

**RED FLAGS (STOP IMMEDIATELY):**
- Working in main branch
- No GitHub issue reference
- Direct commits to main
- Missing feature branch
- Local-only work without remote push

**RESPONSE TO VIOLATIONS:**
- **STOP ALL WORK** immediately
- **DELEGATE TO @git-agent** to fix workflow
- **DO NOT PROCEED** until proper workflow established

---

### GitHub Issue Requirements

Every GitHub issue MUST contain:
- **Clear description** of work to be done
- **Acceptance criteria** or definition of done
- **Labels** for work type (feature, bug, docs, etc.)
- **Milestone** if part of larger effort

### Feature Branch Naming

Use consistent naming patterns:
- **Features**: `feature/123-user-authentication`
- **Bug fixes**: `fix/456-login-error`  
- **Documentation**: `docs/789-api-documentation`
- **Refactoring**: `refactor/101-database-optimization`

---

## Commit Standards and Message Format

### Conventional Commits Format

Every commit MUST:
- **Reference GitHub issue**: "feat: add user auth (#123)"
- **Follow conventional commits**: type(scope): description
- **Be atomic**: One logical change per commit
- **Have clear description**: What and why changed
- **Use present tense, imperative mood**: "add" not "added"
- **Keep first line under 50 characters**
- **Add detailed explanation in body** if needed (after blank line)
- **NEVER mention any AI assistant** in the message

### Commit Types

Standard conventional commit types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only changes
- `style` - Code style changes (formatting, missing semicolons, etc.)
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `test` - Adding tests or updating existing tests
- `chore` - Build, dependencies, or tooling changes
- `build` - Build system or dependency changes
- `ci` - CI/CD pipeline changes
- `perf` - Performance improvements

### Analyzing Commit History and Style

The git agent will:
1. Run `git log --oneline -10` to see recent commit messages
2. Identify the commit style pattern:
   - Conventional Commits format: `type(scope): description`
   - Check if emojis are used
   - Note typical message length and detail level
3. If no commits exist, default to Conventional Commits format
4. Maintain consistency with existing project conventions

### Grouping Changes Logically

Organize changes into logical commits:
- Group related changes together (e.g., all test files, all documentation updates)
- Separate feature additions from bug fixes
- Keep refactoring in separate commits from behavior changes
- Consider file relationships and dependencies

### Example Commit Messages

**For a new feature:**
```
feat(auth): add OAuth2 authentication support

- Implement OAuth2 flow with Google provider
- Add token refresh mechanism
- Include unit tests for auth service
```

**For a bug fix:**
```
fix(api): correct response status for invalid requests

Previously returned 200 with error message.
Now properly returns 400 Bad Request.
```

**For documentation:**
```
docs(readme): update installation instructions

Add prerequisites section and clarify Node version requirements
```

**For refactoring:**
```
refactor(database): simplify query builder interface

Reduce complexity in QueryBuilder by removing deprecated methods.
All deprecated functionality moved to compatibility layer.
```

**For tests:**
```
test(auth): add coverage for OAuth token refresh

Add comprehensive test suite for token refresh logic including:
- Successful refresh scenarios
- Expired token handling
- Network failure recovery
```

### Special Case Handling

- **Binary files**: Ask before committing large binary files
- **Sensitive files**: Alert if files might contain secrets (`.env`, `config.json`, etc.)
- **Merge conflicts**: If found, guide through resolution before continuing
- **Empty commits**: Skip if no actual changes exist

---

## Git Operations Delegation

### All Git Operations → @git-agent

**Subagents CANNOT perform these operations:**
- ❌ `git add` - Staging files
- ❌ `git commit` - Creating commits
- ❌ `git push` - Pushing to remote
- ❌ `git pull` - Pulling from remote
- ❌ `git merge` - Merging branches
- ❌ `git rebase` - Rebasing commits
- ❌ `gh pr create` - Creating pull requests
- ❌ `gh issue create` - Creating issues (except git agent)

**What subagents CAN do:**
- ✅ Work on code in feature branches
- ✅ Run tests and verify quality
- ✅ Report work complete to PM
- ✅ Read git status/log for context

### Project Manager Constraints

- **YOU HAVE NO BASH ACCESS** - Cannot run `gh` commands directly
- **DEVELOPMENT tasks**: Delegate to @git-agent to verify/create GitHub issue FIRST
- **RESEARCH tasks**: Delegate directly to appropriate specialist (no issue needed)
- **ALL GITHUB OPERATIONS**: Delegate to @git-agent (issues, PRs, CI checks)
- Wait for @git-agent confirmation before proceeding with work delegation
- Ensure agents follow feature branch workflow for development
- Delegate CI monitoring to @git-agent before declaring completion
- Coordinate PR creation through @git-agent

### Workflow After Code Ready

When a specialist completes implementation:
1. Specialist reports to PM: "Implementation complete in feature branch [branch-name]"
2. PM delegates to git agent: "Create PR for [issue-number] from [branch-name]"
3. Git agent creates PR, references issue, monitors CI
4. Git agent reports: "PR #[number] created, CI [status]"
5. PM waits for CI to pass
6. Work is complete when: CI green + PR review approved (if required)

---

## CI Verification and Completion Protocol

### CI Monitoring Commands

**MANDATORY: Real-time CI monitoring**
- Use `gh run watch [run-id]` for real-time monitoring (preferred)
- Use `watch -n 30 'gh run list --limit 1'` for periodic polling (if watch fails)

**Get run ID:**
```bash
gh run list --limit 1 --json databaseId -q '.[0].databaseId'
```

**Failed log streaming:**
```bash
gh run view [run-id] --log-failed
```

### CI Verification Requirements

**Never assume CI results - always verify actual CI completion:**
- Use `gh run watch [run-id]` for real-time monitoring
- Check both build AND test results (not just one)
- Wait for actual CI completion before reporting success
- Verify all checks are passing, not just some

**CI verification is mandatory for:**
- All pull requests before merge
- Feature branch pushes
- Release candidates
- Any code that affects production

### Completion Checklist

Before reporting any development task complete:

- ✅ GitHub issue exists and is referenced
- ✅ Work done in feature branch (not main)
- ✅ Code pushed to remote feature branch
- ✅ Pull request created
- ✅ CI pipeline green on PR
- ✅ Code review completed (if required)
- ✅ Issue updated with completion status

---

## Emergency Bypass Protocol

**ONLY for critical production hotfixes:**
- Explicit user approval required
- Must include "HOTFIX" in all commit messages  
- Create GitHub issue retroactively
- Follow up with proper PR for audit trail

---

## Workflow Verification Summary

**REMEMBER:** This workflow prevents technical debt, ensures code quality, maintains project history, and enables team collaboration. **No shortcuts allowed.**

Every commit must be atomic, well-described, and properly referenced. Every feature must live in a feature branch. Every merge must go through a PR with CI verification. This discipline compounds over time into a maintainable, understandable codebase.
