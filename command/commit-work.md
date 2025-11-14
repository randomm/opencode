---
description: Commit all work completed in the current session with proper commit messages
agent: project-manager
---

🔧 **THIS IS A VERSION CONTROL DELEGATION TASK**

**CRITICAL INSTRUCTIONS:**
- ✅ Delegate ALL operations to @git-agent
- ✅ Let git-agent handle all git operations autonomously
- ✅ No need to specify commit details - git-agent knows the standards
- ❌ DO NOT run git commands directly
- ❌ DO NOT create commits yourself
- ❌ DO NOT push to remote yourself

This is a **version control task** that delegates entirely to @git-agent.

═══════════════════════════════════════════════════════

You are committing all work completed in the current session. Follow this MANDATORY protocol:

**🎯 YOUR ROLE**: You are the orchestrator. Delegate to @git-agent for version control operations. Do NOT execute git commands directly.

═══════════════════════════════════════════════════════
PHASE 1: DELEGATION TO GIT-AGENT
═══════════════════════════════════════════════════════

**DELEGATE WITH THIS EXACT REQUEST:**

```
@git-agent: Commit all work completed in this session

Please commit all current work with proper commit messages:

1. Review all uncommitted changes (git status, git diff)
2. Group changes into logical, atomic commits
3. Create commits with:
   - Conventional commit format (feat, fix, docs, etc.)
   - GitHub issue references (#123)
   - Clear, concise descriptions
   - Detailed explanations in commit bodies if needed
4. Verify all quality gates pass before committing
5. Push commits to remote feature branch
6. Report completion with:
   - List of commits created (with SHAs)
   - Branch name and status
   - Any blockers encountered

Use all standard commit conventions from your system prompt and AGENTS.md.
```

**WAIT for @git-agent response before continuing**

═══════════════════════════════════════════════════════
PHASE 2: GIT-AGENT RESPONSIBILITIES (REFERENCE ONLY)
═══════════════════════════════════════════════════════

**Git-agent will autonomously handle:**

✅ **Change Review**
- Review uncommitted changes with `git status` and `git diff`
- Understand what was changed and why
- Identify logical groupings for atomic commits

✅ **Atomic Commits**
- Group related changes together
- Keep commits focused on single logical changes
- Avoid mixing multiple features in one commit
- Avoid mixing refactoring with feature changes

✅ **Conventional Commits**
- Use proper type (feat, fix, docs, style, test, refactor, chore, ci, perf, build)
- Include scope if applicable (e.g., feat(auth): ...)
- Reference GitHub issue number in commit message
- Use imperative mood ("add" not "added")
- Keep first line under 50 characters
- Add detailed explanation in commit body if needed

✅ **Quality Gate Verification**
- Verify tests pass before committing
- Check linting rules pass before committing
- Ensure type checking passes before committing
- Confirm coverage requirements met before committing
- Block commits if quality gates fail

✅ **Feature Branch Workflow**
- Create feature branch if not already created
- Never commit to main branch
- Use branch naming convention (feature/123-description or fix/456-bugname)
- Push commits to remote feature branch

✅ **Push and Reporting**
- Push all commits to remote
- Report back with:
  - Number of commits created
  - Commit messages/descriptions
  - Branch name and push status
  - Any warnings or issues encountered

═══════════════════════════════════════════════════════
PHASE 3: YOUR ROLE AFTER DELEGATION
═══════════════════════════════════════════════════════

**AFTER @git-agent COMPLETES:**

1. **Read the report** - Git-agent will provide:
   - Commits created (with SHAs)
   - Branch status and push confirmation
   - Any issues or warnings

2. **Verify completion** - Check that:
   - [ ] All work changes are committed
   - [ ] Commits follow conventional format
   - [ ] GitHub issue references included
   - [ ] Quality gates passed before commits
   - [ ] Commits pushed to remote

3. **Report to user** - Provide summary:
   ```
   ✅ Work committed and pushed
   📋 Commits: {count} commits created
   🔗 Branch: {feature-branch-name}
   📊 Status: All quality gates passed
   ```

═══════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════

**DO:**
- Delegate ALL git operations to @git-agent
- Trust git-agent to handle commits autonomously
- Wait for git-agent response before completing
- Report completion only after git-agent confirms

**DO NOT:**
- Run git commands yourself (`git add`, `git commit`, `git push`)
- Create commits directly
- Modify git configuration
- Bypass quality gates
- Skip git-agent delegation for any reason

═══════════════════════════════════════════════════════

After delegating to @git-agent and receiving completion confirmation, you are done. Report the results to the user.
