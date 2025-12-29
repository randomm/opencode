import type { Plugin } from "@opencode-ai/plugin"

export const PythonLinterPlugin: Plugin = async ({ $, directory }) => {
  return {
    event: async ({ event }) => {
      // Only process file.edited events for Python files
      if (event.type !== "file.edited") {
        return
      }
      
      const file = (event as { type: "file.edited"; file: string }).file
      
      if (!file.endsWith('.py')) {
        return
      }

      console.log(`[python-linter] Linting: ${file}`)
      
      try {
        // Run ruff check with auto-fix
        await $`cd ${directory} && ruff check --fix ${file}`.quiet()
        console.log(`[python-linter] ruff check: OK`)
      } catch (e) {
        // ruff may not be installed or may have unfixable errors - continue
        console.log(`[python-linter] ruff check: skipped (${e instanceof Error ? e.message : 'not installed'})`)
      }

      try {
        // Run ruff format
        await $`cd ${directory} && ruff format ${file}`.quiet()
        console.log(`[python-linter] ruff format: OK`)
      } catch (e) {
        // ruff format may not be installed - continue
        console.log(`[python-linter] ruff format: skipped`)
      }

      try {
        // Run ty type checker
        await $`cd ${directory} && ty check ${file}`.quiet()
        console.log(`[python-linter] ty check: OK`)
      } catch (e) {
        // ty may not be installed - continue
        console.log(`[python-linter] ty check: skipped`)
      }
    }
  }
}