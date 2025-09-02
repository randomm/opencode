# Verify CI Completion - MANDATORY

**CRITICAL**: Never assume or predict CI outcomes. Always verify actual CI results before reporting task completion.

## The Problem We're Solving

Teams have been:
- Claiming "CI will pass" without verification
- Leaving users to discover CI failures themselves
- Marking tasks complete before CI actually passes
- Making assumptions instead of checking facts

This wastes user time and creates false confidence. We fix this by enforcing actual CI verification.

## Mandatory CI Verification Protocol

### 1. After Any Code Changes
When you commit and push changes that affect CI:
- **IMMEDIATELY** delegate CI monitoring to the appropriate agent
- **WAIT** for actual CI results
- **REPORT** the real outcome, not predictions

### 2. CI Monitoring Steps
```bash
# 1. Push your changes
git push

# 2. Get the CI run ID
gh run list --limit 1

# 3. Monitor until complete
gh run watch  # Interactive monitoring
# OR
gh run view [run-id] --log  # Check specific run

# 4. Report ACTUAL status
# ✅ "CI run #123 passed (3m 45s)"
# ❌ "CI run #123 failed - [specific error]"
```

### 3. Task Completion Rules
**A task is NOT complete until:**
- [ ] Code changes are committed
- [ ] Changes are pushed to remote
- [ ] CI run has started
- [ ] CI run has COMPLETED
- [ ] CI status is SUCCESS
- [ ] Actual results are reported

**If CI fails:**
- [ ] Analyze the failure logs
- [ ] Fix the issues
- [ ] Push fixes
- [ ] Monitor CI again
- [ ] Repeat until CI passes

## Forbidden Phrases - NEVER SAY THESE

### Predictions/Assumptions
- ❌ "CI will pass"
- ❌ "CI should be green"
- ❌ "The pipeline will succeed"
- ❌ "Everything should work now"
- ❌ "CI is expected to pass"
- ❌ "All checks will pass"

### Premature Success Claims
- ❌ "Everything is fixed!"
- ❌ "The project is ready!"
- ❌ "All quality gates pass!"
- ❌ "CI/CD ready!"

### Vague Status Reports
- ❌ "Looking good for CI"
- ❌ "Should be fine"
- ❌ "Likely to pass"

## Required Phrases - USE THESE INSTEAD

### During Work
- ✅ "Pushing changes and monitoring CI..."
- ✅ "CI run #123 started - monitoring status..."
- ✅ "CI in progress (2 minutes elapsed)..."
- ✅ "Waiting for CI to complete..."

### After Verification
- ✅ "CI run #123 PASSED ✅ (took 3m 45s)"
- ✅ "CI run #123 FAILED ❌ - [specific error details]"
- ✅ "CI confirmed passing - all checks green"
- ✅ "CI failed on [specific check] - investigating..."

### When Fixing
- ✅ "CI failed due to [issue] - fixing now..."
- ✅ "Pushed fix for [issue] - monitoring CI again..."
- ✅ "Previous CI failed, attempt #2 running..."

## Agent-Specific Responsibilities

### Project Manager
- Ensure all delegated tasks include CI verification
- Never report completion without CI confirmation
- Coordinate CI monitoring delegation

### Git Autonomous Agent
- Primary responsibility for CI monitoring
- Poll CI status until completion
- Report actual results with run IDs and times

### Language Specialists (Python, JS, etc.)
- After fixing issues, request CI verification
- Don't claim success until CI confirms
- If CI fails, analyze and fix immediately

### DevOps Infrastructure
- Ensure CI pipelines report clear status
- Configure CI for fast feedback
- Never assume infrastructure changes won't break CI

## Examples

### ❌ WRONG - What NOT to do:
```
Python Specialist: "Fixed all ruff errors! Everything should pass now."
Project Manager: "Great! CI will be green. Task complete!"
User (later): "CI is still failing..."
```

### ✅ RIGHT - What TO do:
```
Python Specialist: "Fixed all ruff errors. Pushing changes..."
Python Specialist: "@git-autonomous-agent, please monitor CI"
Git Agent: "CI run #456 started - monitoring..."
Git Agent: "CI run #456 PASSED ✅ (4m 12s)"
Project Manager: "Confirmed: All fixes verified, CI passing"
```

## The Golden Rule

**"Trust, but verify"** becomes **"Never trust, always verify"**

- Assumptions are the enemy of reliability
- CI is the source of truth
- Users should never discover failures you didn't report
- Every "complete" status requires CI verification

## Enforcement

This is not optional. Any agent that:
1. Claims CI will pass without verification
2. Marks tasks complete before CI passes
3. Leaves users to discover CI failures

Is violating core operational standards and must immediately correct this behavior.

## Remember

The user's time is valuable. Every time they have to check CI because you didn't, you've failed in your responsibility. Always verify, never assume, and report actual results.