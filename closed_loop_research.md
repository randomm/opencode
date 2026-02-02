# Closed Loop vs Adversary Pattern: Token Efficiency Without Quality Loss

Pure closed-loop development can reduce token costs by **60-80%** compared to multi-agent adversary patterns, but research shows it cannot fully replace adversarial review for architectural decisions and spec compliance. The optimal solution for your OpenCode setup is a **hybrid architecture**: closed-loop self-validation for routine implementation with strategic adversarial checkpoints at merge boundaries. This preserves your AGENTS.md quality gates while eliminating the repetitive fix-adversary cycles that waste tokens.

## The core architectural difference changes everything

**Closed-loop development** means the agent iterates autonomously from specification to completion using deterministic tool feedback rather than another LLM's judgment. Alexander Zanfir's Medium article defines it precisely: "AI that can iterate autonomously from specification to user acceptance testing without human input between cycles. You provide the spec. The AI develops, deploys, tests like a human would, analyzes gaps against the spec, refines, and repeats."

The key insight is that progress persists in **files and git history**, not in context windows. Geoffrey Huntley's "Ralph Wiggum Loop" demonstrates this with brutal simplicity: `while :; do cat PROMPT.md | claude-code ; done`. Each iteration gets a fresh context window, reads the updated implementation plan from disk, executes one task, commits, and exits. Huntley reports delivering a **$50,000 contract for $297 in API costs** using this approach.

Your current adversary pattern uses non-deterministic LLM judgment for validation—the adversary agent reasoning about code quality. Closed-loop instead uses deterministic back pressure: build systems, type checkers, test suites, and linters that return concrete pass/fail signals. Moss's "Don't Waste Your Back Pressure" articulates why this matters: "Imagine if you only gave an agent tools to edit files. Without a way to interact with a build system, the model relies on you for feedback. This scales poorly."

## Token efficiency gains are substantial and well-documented

Google Cloud's architecture documentation explicitly warns that Review and Critique patterns add "at least one additional model call for the critic's evaluation" and that "if the process includes revision loops, both latency and costs accumulate with each iteration." Your 5-6 step fix-adversary loop multiplies this overhead.

Anthropic's multi-agent research system data quantifies the cost: **multi-agent systems use approximately 15× more tokens** than single-agent approaches. Capgemini's analysis found multi-agent daily costs of $10.54 vs $0.41 for single-agent—a **26× difference**. LangChain's architecture comparison shows that isolated subagent patterns process **67% fewer tokens** than accumulated context approaches.

| Pattern | Token Multiplier | Where Waste Occurs |
|---------|------------------|-------------------|
| Your current adversary loop | ~8-15× base | Each adversary critique requires full context reload; repeated cycles compound costs |
| Single critic review | ~2-3× base | Minimum overhead for external validation |
| Closed loop with tools | ~1.2-1.5× base | Only tool output tokens, no LLM judgment calls |

Your specific workflow has waste concentrated in steps 5-7: the repeated adversary-fix-adversary cycles. Each cycle loads full context into both Developer and Adversary agents, burns tokens on LLM reasoning, and often addresses issues that deterministic tools could catch instantly.

## Self-validation has a fundamental limitation you must understand

Critical research from Snorkel AI (November 2025) discovered what they call the "Self-Critique Paradox": on easy tasks where initial accuracy exceeds 75%, self-critique **dropped Claude Sonnet 4.5's accuracy from 98% to 57%**—a 41-point degradation. The critic "hallucinated flaws to justify its existence." But on hard tasks with initial accuracy below 35%, self-critique improved accuracy from 0% to 60%.

The ICLR 2024 finding is definitive: "Large language models cannot self-correct reasoning intrinsically without external verification signals." Self-validation works as **debugging for failures**, not polishing for correct outputs.

This means closed-loop excels at:
- Syntax and compilation errors (tool-based feedback)
- Calculation mistakes on complex reasoning
- Logic inversions where the model struggles initially
- Missing edge cases when tests are comprehensive

But closed-loop **cannot reliably catch**:
- Plausible hallucinations (high internal consistency masks errors)
- Architectural violations (same context that produced error validates it)
- Spec compliance gaps (no independent reference point)
- Silent performance bugs that pass tests but violate constraints

A documented example from ASDLC.io illustrates the gap: a critic agent caught code doing `LoadAll().Filter()` in-memory instead of database-level filtering. All tests passed, but it violated an architectural constraint for performance. Self-validation cannot detect what it doesn't know to look for.

## Sub-second validation tools make closed loop viable

The practical enabler for closed-loop is **fast local validation**. Your specification-driven development with Markdown specs and YAML conformance tests aligns perfectly with this pattern.

**Biome** replaces ESLint and Prettier with sub-100ms execution. Real benchmarks show linting a 10,000-line monorepo in ~200ms versus ESLint's 3-5 seconds. One migration report documented linting dropping from **26 seconds to 1.3 seconds**—a 20× improvement. For your TypeScript/JavaScript work, Biome provides instant back pressure.

**ast-grep** enables custom pattern validation in 0.5-1 second against thousands of files. You can encode AGENTS.md quality gates as YAML rules:

```yaml
id: enforce-database-filtering
language: TypeScript
rule:
  pattern: $REPO.findAll().$METHOD($FILTER)
  not:
    has:
      pattern: where
```

**Transaction rollback** for database tests eliminates teardown overhead. Research shows **86× speedup** (245 seconds → 2.8 seconds for 447 tests) by wrapping each test in a rolled-back transaction. This enables test suites that run in seconds rather than minutes.

Combined, a closed-loop validation stack can complete full checks in **2-5 seconds**:
1. Biome format + lint: 200ms
2. ast-grep pattern validation: 500ms
3. TypeScript type checking (incremental): 1-2s
4. Test suite with rollback: 1-3s

## Your PM orchestrator pattern works perfectly with closed loop

Closed loop doesn't assume flat control flow—it works with hierarchical orchestration. The pattern becomes: PM → closed-loop Developer (many iterations internally) → single adversary checkpoint before merge.

The PM orchestrator remains the only user interface. Research agents still investigate using codebase/database/web tools. The change is that Developer agents now iterate internally against back pressure rather than bouncing through adversarial review after each change. From Zanfir's framing: human specifies WHAT (the "major loop"), AI handles HOW autonomously (the "minor loop"), validation happens only at transition boundaries.

Google Cloud's architecture guidance supports this: the Coordinator Pattern can direct workflow to agents using iterative refinement internally while maintaining centralized orchestration for task routing.

## The hybrid architecture eliminates your redundancy

Based on the research, here's the recommended architecture for migrating from your current setup:

**Preserve these components:**
- PM orchestrator with strict guardrails (unchanged)
- Research agent (unchanged)
- Git agent for merge rules (unchanged)
- AGENTS.md quality gates (encode as tool-based rules)
- Code review agent (moved to PR boundary only)

**Consolidate these components:**
- Merge Developer and Adversary into single closed-loop Developer agent
- Eliminate repeated fix-adversary cycles entirely
- Add strategic Critic checkpoint before PR creation

**New workflow:**
1. User → PM agent (unchanged)
2. PM → Research agent for investigation (unchanged)
3. PM creates GitHub issues (unchanged)
4. PM delegates to **closed-loop Developer agent(s)** in parallel
5. Developer iterates internally: code → back pressure (tests, lint, ast-grep patterns, type check) → fix → repeat until all gates pass
6. Developer pushes to remote + creates PR
7. **Single Critic review** evaluates PR against AGENTS.md (architectural concerns, spec compliance)
8. If Critic flags issues → Developer fixes in one more closed loop
9. Code review agent reviews PR (unchanged)
10. Git agent squash merges (unchanged)

This eliminates steps 5-7 of your current workflow (the repeated adversary loop) while preserving the quality checkpoint before code review.

## Implementing back pressure from your AGENTS.md

Your AGENTS.md quality gates should translate into three tiers of back pressure:

**Tier 1 - Immediate (sub-second, every iteration):**
- Biome lint/format
- TypeScript type checking
- ast-grep pattern rules for project conventions
- These run automatically before each commit

**Tier 2 - Fast (seconds, before PR):**
- Full test suite with transaction rollback
- Security scanning (semgrep patterns)
- Import/dependency validation
- These run once Developer believes work is complete

**Tier 3 - Strategic (LLM-based, at boundaries):**
- Critic agent review for spec compliance
- Architectural consistency evaluation
- This runs only before PR creation

The key principle from Moss: "If you're directly responsible for checking each line of code is syntactically valid, that's time taken away from thinking about the larger goals." Move deterministic checks to tools; reserve LLM judgment for decisions requiring reasoning.

## Context separation remains essential for the Critic checkpoint

Even in a hybrid architecture, the Critic review must use **fresh context**. ASDLC.io research emphasizes: "Start a new AI session for critique. This clears conversation drift and forces Critic to evaluate only artifacts (Spec + Diff), not Builder's reasoning process."

Implement context-swapped review by:
1. Developer completes work, commits to branch
2. Developer agent session ends
3. PM spawns fresh Critic agent with only: PR diff + AGENTS.md + relevant spec sections
4. Critic evaluates without access to Developer's reasoning history

This prevents the "echo chamber where model validates own output" and catches issues the Developer normalized during iteration.

## Behavioral drift detection requires external monitoring

Your question about detecting behavioral drift is critical. Research from arXiv (January 2026) projects **42% reduction in task success rates** from unmonitored drift. Closed loop cannot detect its own drift because the same blind spots causing drift prevent detection.

Implement external drift monitoring:
- Track tool call patterns across sessions (are agents skipping validation steps?)
- Monitor reasoning pathway stability via trace analysis
- Compare agent behavior against established baselines
- Set thresholds that trigger adversarial review when patterns deviate

If drift exceeds threshold, temporarily revert to full adversary pattern until behavior stabilizes.

## Recommended migration phases

**Phase 1 (Week 1-2): Instrument current workflow**
- Add timing metrics to each agent interaction
- Quantify token usage per step
- Identify which adversary findings could have been caught by tools

**Phase 2 (Week 3-4): Build back pressure infrastructure**
- Configure Biome for your codebase
- Create ast-grep rules from AGENTS.md quality gates
- Implement transaction rollback in test suite
- Validate sub-5-second full validation cycle

**Phase 3 (Week 5-6): Implement closed-loop Developer**
- Modify Developer agent to iterate against back pressure
- Remove adversary calls during implementation
- Add single Critic checkpoint before PR

**Phase 4 (Week 7-8): Validate quality preservation**
- Compare defect rates pre/post migration
- Measure token usage reduction
- Tune Critic scope based on findings

Expected outcomes: **60-75% token reduction** while maintaining equivalent defect detection, based on the pattern of eliminating 4-6 adversary iterations per feature while preserving the single strategic review.

## When to still use full adversary pattern

Retain multi-agent adversarial review for:
- Security-critical code paths (adversarial framing essential)
- Architectural decisions affecting system-wide constraints
- Integration points with external systems
- When drift monitoring triggers alerts
- Complex features where initial accuracy is low

The research is clear that critique works for debugging hard problems. When your PM assesses a task as high-complexity or high-risk, route it through adversary validation rather than closed loop.

## Conclusion

Closed-loop development with tool-based back pressure can eliminate **60-80% of your current token waste** by replacing repeated adversary cycles with deterministic validation. However, it cannot fully replace adversarial review for architectural decisions and spec compliance—areas where LLM judgment catches issues tools cannot encode.

Your optimal architecture is hybrid: closed-loop Developer agents that iterate internally against fast validation tools, with a single Critic checkpoint before PR creation. This preserves your PM orchestrator pattern, maintains AGENTS.md quality gates (now encoded as both tools and Critic criteria), and dramatically reduces the redundancy in steps 5-7 of your current workflow. The key insight from this research: use tools for what tools do well (deterministic validation), and reserve LLM judgment for what requires reasoning (architectural coherence and spec compliance).
