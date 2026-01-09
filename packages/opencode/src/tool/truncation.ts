import type { Agent } from "../agent/agent"

export namespace Truncate {
  export interface OutputResult {
    truncated: boolean
    content: string
    outputPath?: string
  }

  export async function output(
    result: string,
    options: Record<string, any>,
    agent?: Agent.Info
  ): Promise<OutputResult> {
    // Basic truncation logic - this is a stub implementation
    if (result.length > 100000) {
      return {
        truncated: true,
        content: result.substring(0, 50000) + "\n... [truncated] ...",
        outputPath: undefined,
      }
    }
    
    return {
      truncated: false,
      content: result,
    }
  }
}