/** @type {import("@opencode-ai/plugin").Plugin} */
export const PythonLinterPlugin = async ({ $, directory }) => {
  return {
    event: async ({ event }) => {
      if (event.type !== "file.edited") {
        return
      }
      
      const file = event.file
      
      if (!file.endsWith('.py')) {
        return
      }

      console.log(`[python-linter] Linting: ${file}`)
      
      try {
        await $`cd ${directory} && ruff check --fix ${file}`.quiet()
        console.log(`[python-linter] ruff check: OK`)
      } catch (e) {
        console.log(`[python-linter] ruff check: skipped (${e?.message || 'not installed'})`)
      }

      try {
        await $`cd ${directory} && ruff format ${file}`.quiet()
        console.log(`[python-linter] ruff format: OK`)
      } catch (e) {
        console.log(`[python-linter] ruff format: skipped`)
      }

      try {
        await $`cd ${directory} && ty check ${file}`.quiet()
        console.log(`[python-linter] ty check: OK`)
      } catch (e) {
        console.log(`[python-linter] ty check: skipped`)
      }
    }
  }
}
