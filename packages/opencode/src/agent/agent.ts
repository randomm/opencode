import { Config } from "../config/config"
import z from "zod"
import { Provider } from "../provider/provider"
import { generateObject, streamObject, type ModelMessage } from "ai"
import { SystemPrompt } from "../session/system"
import { Instance } from "../project/instance"
import { Truncate } from "../tool/truncation"
import { Auth } from "../auth"
import { ProviderTransform } from "../provider/transform"

import PROMPT_GENERATE from "./generate.txt"
import PROMPT_COMPACTION from "./prompt/compaction.txt"
import PROMPT_EXPLORE from "./prompt/explore.txt"
import PROMPT_SUMMARY from "./prompt/summary.txt"
import PROMPT_TITLE from "./prompt/title.txt"
import { PermissionNext } from "@/permission/next"
import { mergeDeep, pipe, sortBy, values } from "remeda"
import { Global } from "@/global"
import path from "path"
import { Plugin } from "@/plugin"
import { Skill } from "../skill"

export namespace Agent {
  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      mode: z.enum(["subagent", "primary", "all"]),
      native: z.boolean().optional(),
      hidden: z.boolean().optional(),
      topP: z.number().optional(),
      temperature: z.number().optional(),
      color: z.string().optional(),
      permission: PermissionNext.Ruleset,
      model: z
        .object({
          modelID: z.string(),
          providerID: z.string(),
        })
        .optional(),
      variant: z.string().optional(),
      prompt: z.string().optional(),
      options: z.record(z.string(), z.any()),
      steps: z.number().int().positive().optional(),
    })
    .meta({
      ref: "Agent",
    })
  export type Info = z.infer<typeof Info>

  const state = Instance.state(async () => {
    const cfg = await Config.get()

    const skillDirs = await Skill.dirs()
    const defaults = PermissionNext.fromConfig({
      "*": "allow",
      doom_loop: "ask",
      external_directory: {
        "*": "ask",
        [Truncate.GLOB]: "allow",
        ...Object.fromEntries(skillDirs.map((dir) => [path.join(dir, "*"), "allow"])),
      },
      question: "deny",
      plan_enter: "deny",
      plan_exit: "deny",
      // mirrors github.com/github/gitignore Node.gitignore pattern for .env files
      read: {
        "*": "allow",
        "*.env": "ask",
        "*.env.*": "ask",
        "*.env.example": "allow",
      },
    })
    const user = PermissionNext.fromConfig(cfg.permission ?? {})

    const result: Record<string, Info> = {
      build: {
        name: "build",
        description: "The default agent. Executes tools based on configured permissions.",
        options: {},
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            question: "allow",
            plan_enter: "allow",
          }),
          user,
        ),
        mode: "primary",
        native: true,
      },
      plan: {
        name: "plan",
        description: "Plan mode. Disallows all edit tools.",
        options: {},
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            question: "allow",
            plan_exit: "allow",
            external_directory: {
              [path.join(Global.Path.data, "plans", "*")]: "allow",
            },
            edit: {
              "*": "deny",
              [path.join(".opencode", "plans", "*.md")]: "allow",
              [path.relative(Instance.worktree, path.join(Global.Path.data, path.join("plans", "*.md")))]: "allow",
            },
          }),
          user,
        ),
        mode: "primary",
        native: true,
      },
      general: {
        name: "general",
        description: `General-purpose agent for researching complex questions and executing multi-step tasks. Use this agent to execute multiple units of work in parallel.`,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            todoread: "deny",
            todowrite: "deny",
          }),
          user,
        ),
        options: {},
        mode: "subagent",
        native: true,
      },
      explore: {
        name: "explore",
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
            grep: "allow",
            glob: "allow",
            list: "allow",
            bash: "allow",
            webfetch: "allow",
            websearch: "allow",
            codesearch: "allow",
            read: "allow",
            external_directory: {
              [Truncate.GLOB]: "allow",
            },
          }),
          user,
        ),
        description: `Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase (eg. "how do API endpoints work?"). When calling this agent, specify the desired thoroughness level: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis across multiple locations and naming conventions.`,
        prompt: PROMPT_EXPLORE,
        options: {},
        mode: "subagent",
        native: true,
      },
      compaction: {
        name: "compaction",
        mode: "primary",
        native: true,
        hidden: true,
        prompt: PROMPT_COMPACTION,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        options: {},
      },
      title: {
        name: "title",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        temperature: 0.5,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        prompt: PROMPT_TITLE,
      },
      summary: {
        name: "summary",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        prompt: PROMPT_SUMMARY,
      },
      "composer": {
        name: "composer",
        mode: "subagent",
        hidden: true,
        native: true,
        options: {},
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        prompt: `You are the Composer agent for the taskctl autonomous development pipeline.

Your job is to read a GitHub issue and decompose it into a structured, dependency-ordered list of implementation tasks.

RESPONSE FORMAT — you must respond with ONLY valid JSON, nothing else:

If the spec is too vague or missing acceptance criteria:
{
  "status": "needs_clarification",
  "questions": [
    { "id": 1, "question": "What specific behaviour should change?" }
  ]
}

If the spec is clear enough to decompose:
{
  "status": "ready",
  "tasks": [
    {
      "title": "Add OAuth2 config schema",
      "description": "Add zod schema for OAuth2 config to src/config/config.ts",
      "acceptance_criteria": "Schema validates clientId, clientSecret, redirectUri. Tests pass.",
      "task_type": "implementation",
      "labels": ["module:config", "file:src/config/config.ts"],
      "depends_on": [],
      "priority": 0
    }
  ]
}

RULES FOR GOOD TASK DECOMPOSITION:
1. Each task must be completable by one developer in a single session
2. Every task MUST have non-empty acceptance_criteria
3. Every task MUST have at least one label with "module:" or "file:" prefix
4. Dependencies: tasks that others depend on have lower priority numbers (0 = highest priority)
5. Tasks with no shared module:/file: labels can run in parallel
6. Do not create tasks for work not explicitly required by the issue
7. Validate your own output: check that no depends_on creates a cycle before responding
8. Respond with ONLY the JSON object — no markdown, no explanation, no code blocks`,
      },
      "developer-pipeline": {
        name: "developer-pipeline",
        description: "Developer agent working as part of an autonomous pipeline.",
        mode: "subagent",
        native: true,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            task: "deny",
            taskctl: "deny",
          }),
          user,
        ),
        options: {},
        prompt: `You are a developer agent working as part of an autonomous pipeline.

Your job is to implement the assigned task with TDD discipline.

## Your task
You will receive a task description with:
- Title: what to build
- Description: full context and requirements
- Acceptance criteria: what must be true when done

## Workflow
1. Search vipune for prior decisions and patterns before implementing
2. Search colgrep for existing implementations to avoid duplication
3. Read the codebase to understand context
4. Write failing tests first (TDD)
5. Write minimal code to make tests pass
6. Refactor for clarity following AGENTS.md style guide
7. Run tests and typecheck from packages/opencode directory ONLY:
   \`cd <worktree>/packages/opencode && bun run typecheck && bun test\`
8. When all checks pass: signal completion — pipeline detects and tests automatically

## Rules
- ONLY implement what is explicitly in the task description
- No TODO/FIXME/HACK comments (create a GitHub issue instead)
- No @ts-ignore or as any
- Follow style guide: single-word variable names, early returns, no else, functional array methods
- Do NOT spawn any adversarial agent — the pipeline handles this automatically
- Do NOT commit or push — the pipeline handles this automatically
- Do NOT write any documentation files (PLAN.md, ANALYSIS.md, etc.)

## Tools (use before implementing)
- **colgrep** — MUST search before implementing: \`colgrep init /absolute/path && colgrep "what you're building"\`
- **vipune** — search at startup for patterns: \`vipune search "prior decisions"\` then store findings: \`vipune add "atomic fact"\`
- **context7** — MANDATORY before any library API: resolve-library-id then query-docs to verify current API
- **parallel-search + web_fetch** — web research when needed

NOTE: taskctl commands are blocked. Pipeline handles task state.`,
      },
      "adversarial-pipeline": {
        name: "adversarial-pipeline",
        description: "Adversarial code reviewer in an autonomous pipeline.",
        mode: "subagent",
        native: true,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
            bash: "allow",
            taskctl: "allow",
          }),
          user,
        ),
        options: {},
        prompt: `You are an adversarial code reviewer in an autonomous pipeline.

Your ONLY job is to review code changes in an assigned worktree and record a structured verdict.

## What you receive
- Task title, description, and acceptance criteria
- Path to the worktree containing the implementation
- The task ID

## Attack vectors (review these systematically)
- [ ] Acceptance criteria: All explicitly satisfied?
- [ ] Edge cases: Null/undefined/empty inputs, boundaries, errors?
- [ ] Type safety: All parameters typed? Return types match usage?
- [ ] Scope creep: Any additions not in task description?
- [ ] Cross-platform: Hardcoded OS-specific paths in assertions?
- [ ] Logic correctness: Boolean conditions, state transitions, loops?
- [ ] API contracts: Does code match context7 documentation?

## CRITICAL: Test directory
Run tests and typecheck ONLY from packages/opencode:
\`\`\`bash
cd <worktree>/packages/opencode
bun run typecheck
bun test
\`\`\`
NEVER run from project root (causes "do-not-run-tests-from-root" error).

## Scope enforcement
Check: Does the implementation add ANYTHING not in the task description or acceptance criteria?
- Extra tests not covering the implementation → ISSUES_FOUND (MEDIUM)
- New functions or helpers not requested → ISSUES_FOUND (HIGH)
- Scope expansion is a violation even if the code is correct

## Cross-platform assumptions
Check: Are there platform-specific path assumptions?
- Assertions with '/tmp/' may fail on macOS (uses /var/folders) → CRITICAL
- Assertions with '/var/folders' will fail on Linux → CRITICAL
- Flag any hardcoded OS-specific paths in test assertions

## APPROVED only if ALL true
- All acceptance criteria explicitly met
- bun run typecheck passes (from packages/opencode)
- bun test passes (from packages/opencode)
- Zero CRITICAL or HIGH issues
- No out-of-scope additions
- No cross-platform path assumptions

ISSUES_FOUND if ANY:
- MEDIUM/LOW quality issues, or out-of-scope additions

CRITICAL_ISSUES_FOUND if ANY:
- CRITICAL/HIGH bugs, test/typecheck failures, cross-platform breaks, security issues

## Recording your verdict — MANDATORY

Use the \`taskctl\` MCP tool (in your tool list, NOT bash):

**If APPROVED:**
- command: "verdict", taskId: <task-id>, verdict: "APPROVED"
- verdictSummary: "Brief summary", verdictIssues: []

**If ISSUES_FOUND:**
- command: "verdict", taskId: <task-id>, verdict: "ISSUES_FOUND"
- verdictSummary: "Brief summary"
- verdictIssues: [{"location":"src/foo.ts:42","severity":"MEDIUM","fix":"..."}]

**If CRITICAL_ISSUES_FOUND:**
- command: "verdict", taskId: <task-id>, verdict: "CRITICAL_ISSUES_FOUND"
- verdictIssues: [{"location":"...","severity":"CRITICAL","fix":"..."}]

## Rules
- You may ONLY use: taskctl MCP tool (command: "verdict")
- Do NOT spawn any agents
- Do NOT commit or push
- Be specific: every issue must have location (file:line) and concrete fix

## Tools
- **vipune** — search before reviewing: \`vipune search "related patterns"\` then store findings: \`vipune add "one atomic finding"\`
- **colgrep** — find related implementations: \`colgrep "pattern" --include "*.ts"\`
- **context7** — resolve library ID, then query-docs to verify API usage matches current documentation`,
      },
      steering: {
        name: "steering",
        description: "Steering agent in an autonomous development pipeline.",
        mode: "subagent",
        native: true,
        hidden: true,
        permission: PermissionNext.merge(
          defaults,
          PermissionNext.fromConfig({
            "*": "deny",
          }),
          user,
        ),
        options: {},
        // Uses cheapest available model — configure via agent config if needed
        prompt: `You are a steering agent in an autonomous development pipeline. Your job is to assess whether a developer agent is making meaningful progress on a task.

You will receive:
- The task title, description, and acceptance criteria
- A summary of recent developer activity (last session turns)

Respond with EXACTLY one of these JSON objects and nothing else:

{ "action": "continue", "message": null }
— Use when the developer is making steady progress: writing code, running tests, moving forward

{ "action": "steer", "message": "specific actionable guidance here" }
— Use when the developer seems confused, going in circles, or heading the wrong direction
— The message must be specific and actionable (e.g. "Focus on fixing the null check at src/api.ts:42, not rewriting the whole module")

{ "action": "replace", "message": "reason for replacement" }
— Use ONLY when the developer has made zero meaningful progress for the entire session or is clearly broken (e.g. repeating the same failed command)

## Tools available (use if present, skip gracefully if not available)
- **vipune search** — review prior session work: \`vipune search "topic"\`
- **colgrep** — understand codebase patterns: \`colgrep "pattern"\`
Keep tool use lightweight — steering assessment should complete in under 1 minute.

Be conservative: prefer "continue" when in doubt. Only "replace" when truly stuck.`,
      },
    }

    for (const [key, value] of Object.entries(cfg.agent ?? {})) {
      if (value.disable) {
        delete result[key]
        continue
      }
      let item = result[key]
      if (!item)
        item = result[key] = {
          name: key,
          mode: "all",
          permission: PermissionNext.merge(defaults, user),
          options: {},
          native: false,
        }
      if (value.model) item.model = Provider.parseModel(value.model)
      item.variant = value.variant ?? item.variant
      item.prompt = value.prompt ?? item.prompt
      item.description = value.description ?? item.description
      item.temperature = value.temperature ?? item.temperature
      item.topP = value.top_p ?? item.topP
      item.mode = value.mode ?? item.mode
      item.color = value.color ?? item.color
      item.hidden = value.hidden ?? item.hidden
      item.name = value.name ?? item.name
      item.steps = value.steps ?? item.steps
      item.options = mergeDeep(item.options, value.options ?? {})
      item.permission = PermissionNext.merge(item.permission, PermissionNext.fromConfig(value.permission ?? {}))
    }

    // Ensure Truncate.GLOB is allowed unless explicitly configured
    for (const name in result) {
      const agent = result[name]
      const explicit = agent.permission.some((r) => {
        if (r.permission !== "external_directory") return false
        if (r.action !== "deny") return false
        return r.pattern === Truncate.GLOB
      })
      if (explicit) continue

      result[name].permission = PermissionNext.merge(
        result[name].permission,
        PermissionNext.fromConfig({ external_directory: { [Truncate.GLOB]: "allow" } }),
      )
    }

    return result
  })

  export async function get(agent: string) {
    return state().then((x) => x[agent])
  }

  export async function list() {
    const cfg = await Config.get()
    return pipe(
      await state(),
      values(),
      sortBy([(x) => (cfg.default_agent ? x.name === cfg.default_agent : x.name === "build"), "desc"]),
    )
  }

  export async function defaultAgent() {
    const cfg = await Config.get()
    const agents = await state()

    if (cfg.default_agent) {
      const agent = agents[cfg.default_agent]
      if (!agent) throw new Error(`default agent "${cfg.default_agent}" not found`)
      if (agent.mode === "subagent") throw new Error(`default agent "${cfg.default_agent}" is a subagent`)
      if (agent.hidden === true) throw new Error(`default agent "${cfg.default_agent}" is hidden`)
      return agent.name
    }

    const primaryVisible = Object.values(agents).find((a) => a.mode !== "subagent" && a.hidden !== true)
    if (!primaryVisible) throw new Error("no primary visible agent found")
    return primaryVisible.name
  }

  export async function generate(input: { description: string; model?: { providerID: string; modelID: string } }) {
    const cfg = await Config.get()
    const defaultModel = input.model ?? (await Provider.defaultModel())
    const model = await Provider.getModel(defaultModel.providerID, defaultModel.modelID)
    const language = await Provider.getLanguage(model)

    const system = [PROMPT_GENERATE]
    await Plugin.trigger("experimental.chat.system.transform", { model }, { system })
    const existing = await list()

    const params = {
      experimental_telemetry: {
        isEnabled: cfg.experimental?.openTelemetry,
        metadata: {
          userId: cfg.username ?? "unknown",
        },
      },
      temperature: 0.3,
      messages: [
        ...system.map(
          (item): ModelMessage => ({
            role: "system",
            content: item,
          }),
        ),
        {
          role: "user",
          content: `Create an agent configuration based on this request: \"${input.description}\".\n\nIMPORTANT: The following identifiers already exist and must NOT be used: ${existing.map((i) => i.name).join(", ")}\n  Return ONLY the JSON object, no other text, do not wrap in backticks`,
        },
      ],
      model: language,
      schema: z.object({
        identifier: z.string(),
        whenToUse: z.string(),
        systemPrompt: z.string(),
      }),
    } satisfies Parameters<typeof generateObject>[0]

    if (defaultModel.providerID === "openai" && (await Auth.get(defaultModel.providerID))?.type === "oauth") {
      const result = streamObject({
        ...params,
        providerOptions: ProviderTransform.providerOptions(model, {
          instructions: SystemPrompt.instructions(),
          store: false,
        }),
        onError: () => {},
      })
      try {
        for await (const part of result.fullStream) {
          if (part.type === "error") throw part.error
        }
      } catch (e) {
        if (typeof e === "object" && e !== null && "name" in e && e.name === "AbortError") {
          throw e
        }
        if (e instanceof DOMException && e.name === "AbortError") {
          throw e
        }
        throw e
      }
      return result.object
    }

    const result = await generateObject(params)
    return result.object
  }
}
