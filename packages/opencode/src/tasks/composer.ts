import z from "zod"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { MessageV2 } from "../session/message-v2"
import { Store } from "./store"
import { Validation } from "./validation"
import { generateUniqueSlug, slugify } from "./tool"

const ComposerTasksSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  acceptance_criteria: z.string().min(1),
  task_type: z.enum(["implementation", "test", "research"]),
  labels: z.array(z.string().max(100)).default([]),
  depends_on: z.array(z.string().min(1).max(200)).default([]),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
})

type ComposerOutput =
  | { status: "needs_clarification"; questions: Array<{ id: number; question: string }> }
  | { status: "ready"; tasks: z.infer<typeof ComposerTasksSchema>[] }

type SpawnComposerFn = (prompt: string) => Promise<string | undefined>

async function defaultSpawnComposerFn(
  sessionID: string,
  prompt: string,
  timeoutMs: number = 300000
): Promise<string | undefined> {
  const parentSession = await Session.get(sessionID)
  if (!parentSession?.directory) throw new Error("Parent session not found or has no directory")

  const session = await Session.createNext({
    parentID: sessionID,
    directory: parentSession.directory,
    title: "Composer task decomposition",
    permission: [],
  })

  // prompt() blocks until the agent finishes
  // Race with timeout — if timeout fires, cancel the session cleanly
  let timedOut = false
  const timeoutPromise = new Promise<undefined>((resolve) =>
    setTimeout(() => {
      timedOut = true
      SessionPrompt.cancel(session.id)
      resolve(undefined)
    }, timeoutMs),
  )

  await Promise.race([
    SessionPrompt.prompt({ sessionID: session.id, agent: "composer", parts: [{ type: "text", text: prompt }] }),
    timeoutPromise,
  ])

  if (timedOut) return undefined

  // Agent finished — read final assistant message directly from DB
  // MessageV2.stream() is descending order — .find() gets the newest assistant message
  const msgs = await Array.fromAsync(MessageV2.stream(session.id))
  const last = msgs.find((m) => m.info.role === "assistant")
  const textPart = last?.parts.find((p): p is MessageV2.TextPart => p.type === "text" && !p.synthetic)
  return textPart?.text
}

export async function runComposer(
  params: {
    jobId: string
    projectId: string
    pmSessionId: string
    issueNumber: number
    issueTitle: string
    issueBody: string
  },
  spawnFn?: (prompt: string) => Promise<string | undefined>,
): Promise<{ status: "needs_clarification"; questions: Array<{ id: number; question: string }> } | { status: "ready"; taskCount: number }> {
  const { jobId, projectId, pmSessionId, issueNumber, issueTitle, issueBody } = params
  const spawn = spawnFn ?? ((prompt: string) => defaultSpawnComposerFn(pmSessionId, prompt))

  const composerPrompt = `Issue #${issueNumber}: ${issueTitle}

${issueBody}

Decompose this issue into a dependency-ordered list of implementation tasks. Return ONLY valid JSON.`

  const output = await spawn(composerPrompt)
  if (!output) throw new Error("Composer agent timed out or returned no response")

  let parsed: unknown
  try {
    parsed = JSON.parse(output)
  } catch {
    throw new Error(`Composer agent returned invalid JSON. Raw (first 500 chars): ${output.substring(0, 500)}`)
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) {
    throw new Error("Invalid output: expected a JSON object with 'status' field")
  }

  const parsedObj = parsed as Record<string, unknown>
  const status = parsedObj.status as string | null

  if (status === "needs_clarification" && Array.isArray(parsedObj.questions)) {
    return { status: "needs_clarification", questions: parsedObj.questions as Array<{ id: number; question: string }> }
  }

  if (status !== "ready" || !Array.isArray(parsedObj.tasks)) {
    throw new Error(`Invalid composer output: expected status "ready" with tasks array`)
  }

  const tasksArray = parsedObj.tasks as unknown[]
  if (tasksArray.length === 0) {
    throw new Error("Composer returned no tasks")
  }

  const proposedTasks: z.infer<typeof ComposerTasksSchema>[] = []
  const validationErrors: string[] = []

  for (const [index, task] of tasksArray.entries()) {
    const result = ComposerTasksSchema.safeParse(task)
    if (result.success) {
      proposedTasks.push({ ...result.data, depends_on: result.data.depends_on.filter((d) => d) as string[] })
    } else {
      const errorDetails = result.error.issues.map((e) => {
        const path = e.path.map((p) => String(p)).join(".")
        return `${path} ${e.message}`
      }).join(", ")
      validationErrors.push(`Task ${index + 1}: ${errorDetails}`)
    }
  }

  if (validationErrors.length > 0) {
    throw new Error(`Composer task validation failed:\n${validationErrors.join("\n")}`)
  }

  const now = new Date().toISOString()

  const allTaskTitles = new Set<string>()
  const slugifiedToTitleMap = new Map<string, string>()

  for (const task of proposedTasks) {
    allTaskTitles.add(task.title)
    const slug = slugify(task.title)
    slugifiedToTitleMap.set(slug, task.title)
  }

  for (const task of proposedTasks) {
    for (const dep of task.depends_on) {
      if (!allTaskTitles.has(dep) && !slugifiedToTitleMap.has(dep)) {
        throw new Error(`Task "${task.title}" depends on "${dep}" which is not defined in this batch. All dependencies must be tasks in the same decomposed set.`)
      }
    }
  }

  const tasksMap = new Map<string, { depends_on: string[] }>()
  for (const task of proposedTasks) {
    const taskSlug = slugify(task.title)
    const depSlugs = task.depends_on.map((dep) => {
      if (allTaskTitles.has(dep)) {
        return slugify(dep)
      }
      return dep
    }).filter((slug) => slug != null) as string[]
    tasksMap.set(taskSlug, { depends_on: depSlugs })
  }

  const proposedErrors = Validation.validateGraphFromMap(tasksMap)

  if (proposedErrors.length > 0) {
    return {
      status: "needs_clarification",
      questions: [
        {
          id: 1,
          question: `Invalid task graph: ${proposedErrors.join("; ")}. Please revise the task decomposition.`,
        },
      ],
    }
  }

  const createdTaskIds: string[] = []

  try {
    for (const task of proposedTasks) {
      const slug = await generateUniqueSlug(projectId, task.title)

      await Store.createTask(projectId, {
        id: slug,
        title: task.title,
        description: task.description,
        acceptance_criteria: task.acceptance_criteria,
        parent_issue: issueNumber,
        job_id: jobId,
        status: "open",
        priority: task.priority,
        task_type: task.task_type,
        labels: task.labels,
        depends_on: task.depends_on.map((dep) => {
          const depBaseSlug = slugify(dep)
          const existingSlug = createdTaskIds.find((id) =>
            id === depBaseSlug || id.startsWith(`${depBaseSlug}-`)
          )
          return existingSlug ?? depBaseSlug
        }).filter((slug) => slug != null) as string[],
        assignee: null,
        assignee_pid: null,
        worktree: null,
        branch: null,
        created_at: now,
        updated_at: now,
        close_reason: null,
        comments: [],
        pipeline: {
          stage: "idle",
          attempt: 0,
          last_activity: null,
          last_steering: null,
          history: [],
          adversarial_verdict: null,
        },
      })
      createdTaskIds.push(slug)
    }
  } catch (error) {
    for (const createdId of createdTaskIds) {
      await Store.updateTask(projectId, createdId, { status: "closed", close_reason: "rollback: composer failed" }).catch(() => {})
    }
    throw error
  }

  return { status: "ready", taskCount: createdTaskIds.length }
}