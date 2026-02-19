export type Task = {
  id: string
  title: string
  description: string
  acceptance_criteria: string
  parent_issue: number
  job_id: string
  status: "open" | "in_progress" | "review" | "blocked" | "closed" | "failed" | "stopped" | "blocked_on_conflict"
  priority: 0 | 1 | 2 | 3 | 4
  task_type: "implementation" | "test" | "research"
  labels: string[]
  depends_on: string[]
  assignee: string | null
  assignee_pid: number | null
  worktree: string | null
  branch: string | null
  created_at: string
  updated_at: string
  close_reason: string | null
  comments: Comment[]
  pipeline: {
    stage: "idle" | "developing" | "reviewing" | "committing" | "done" | "failed" | "stopped"
    attempt: number
    last_activity: string | null
    last_steering: string | null
    history: PipelineEvent[]
    adversarial_verdict: AdversarialVerdict | null
  }
}

export type Comment = {
  author: string
  message: string
  created_at: string
}

export type PipelineEvent = {
  from: string
  to: string
  attempt: number
  timestamp: string
  message: string | null
}

export type AdversarialVerdict = {
  verdict: "APPROVED" | "ISSUES_FOUND" | "CRITICAL_ISSUES_FOUND"
  issues: Array<{
    location: string
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
    fix: string
  }>
  summary: string
  timestamp: string
}

export type Job = {
  id: string
  parent_issue: number
  status: "running" | "stopped" | "complete" | "failed"
  created_at: string
  stopping: boolean
  pulse_pid: number | null
  max_workers: number
  pm_session_id: string
}

export type TaskIndexEntry = {
  status: Task["status"]
  priority: Task["priority"]
  labels: Task["labels"]
  depends_on: Task["depends_on"]
  updated_at: string
}

export type TaskIndex = {
  [taskId: string]: TaskIndexEntry
}

export type ValidationResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
}