/**
 * Task state icons and color system for terminal UI.
 * Provides visual feedback for task status, agent roles, and UI elements.
 */

export namespace Icons {
  /**
   * ANSI color codes for terminal output
   */
  export const colors = {
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    reset: "\x1b[0m",
  }

  /**
   * Task status icons with their default colors
   */
  export const icons = {
    taskComplete: "✓",
    taskPending: "□",
    taskRunning: "●",
    taskProgress: "◇",
    agentRole: "🟪",
  }

  /**
   * Status colors lookup table (module-level for performance)
   */
  const statusColors: Record<string, string> = {
    completed: colors.green,
    pending: colors.dim,
    running: colors.green,
    progress: colors.yellow,
  }

  /**
   * Status icons lookup table (module-level for performance)
   */
  const statusIcons: Record<string, string> = {
    completed: icons.taskComplete,
    pending: icons.taskPending,
    running: icons.taskRunning,
    progress: icons.taskProgress,
  }

  /**
   * Returns a colored task status icon based on the given status
   * @param status - The task status: 'completed', 'pending', 'running', or 'progress'
   * @returns The colored icon as a string, or pending icon as safe fallback
   */
  export function taskIcon(status: "completed" | "pending" | "running" | "progress"): string {
    const color = statusColors[status]
    const icon = statusIcons[status]

    if (!color || !icon) return `${colors.dim}${icons.taskPending}${colors.reset}`
    return `${color}${icon}${colors.reset}`
  }

  /**
   * Returns a colored agent name badge in cyan
   * @param name - The agent name
   * @returns The colored agent name badge, or empty string if name is empty
   */
  export function agentBadge(name: string): string {
    if (!name) return ""
    return `${colors.cyan}${name}${colors.reset}`
  }

  /**
   * Returns a colored role badge with a purple icon prefix
   * @param role - The role name
   * @returns The colored role badge with icon, or empty string if role is empty
   */
  export function roleBadge(role: string): string {
    if (!role) return ""
    return `${colors.magenta}${icons.agentRole}${colors.reset} ${role}`
  }
}
