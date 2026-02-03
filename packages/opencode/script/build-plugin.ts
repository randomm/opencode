import { transformAsync } from "@babel/core"
import ts from "@babel/preset-typescript"
import solid from "babel-preset-solid"
import react from "@babel/preset-react"
import { type BunPlugin } from "bun"

/**
 * Bun build plugin that handles both React (Ink) and SolidJS transformations.
 * Ink files use React JSX, all other .tsx files use SolidJS.
 */
export const hybridTransformPlugin: BunPlugin = {
  name: "hybrid-solid-react-plugin",
  setup: (build) => {
    // Fix solid-js server imports
    build.onLoad({ filter: /\/node_modules\/solid-js\/dist\/server\.js$/ }, async (args) => {
      const path = args.path.replace("server.js", "solid.js")
      const file = Bun.file(path)
      const code = await file.text()
      return { contents: code, loader: "js" }
    })

    build.onLoad({ filter: /\/node_modules\/solid-js\/store\/dist\/server\.js$/ }, async (args) => {
      const path = args.path.replace("server.js", "store.js")
      const file = Bun.file(path)
      const code = await file.text()
      return { contents: code, loader: "js" }
    })

    // Handle .tsx and .jsx files
    build.onLoad({ filter: /\.(js|ts)x$/ }, async (args) => {
      // Skip node_modules to avoid conflicts with dedupePlugin
      if (args.path.includes("node_modules")) {
        return undefined
      }

      try {
        const file = Bun.file(args.path)
        const code = await file.text()

        // Normalize path for cross-platform detection (Windows uses backslashes)
        const normalizedPath = args.path.replace(/\\/g, "/")

        // Detect if file is Ink-related (React-based)
        const isInkFile =
          /from\s*["']ink["']/.test(code) ||
          /from\s*["']ink-/.test(code) ||
          /require\(["']ink["']\)/.test(code) ||
          /@jsxImportSource\s+react/.test(code) ||
          normalizedPath.includes("/cli/ink/")

        if (isInkFile) {
          // Transform with React preset
          const transforms = await transformAsync(code, {
            filename: args.path,
            presets: [
              [react, { runtime: "automatic", importSource: "react" }],
              [ts, { isTSX: true, allExtensions: true }],
            ],
          })

          if (!transforms || !transforms.code) {
            throw new Error(`React transform failed for ${args.path}`)
          }

          return {
            contents: transforms.code,
            loader: "js",
          }
        }

        // Transform with SolidJS preset
        const transforms = await transformAsync(code, {
          filename: args.path,
          presets: [
            [
              solid,
              {
                moduleName: "@opentui/solid",
                generate: "universal",
              },
            ],
            [ts],
          ],
        })

        if (!transforms || !transforms.code) {
          throw new Error(`SolidJS transform failed for ${args.path}`)
        }

        return {
          contents: transforms.code,
          loader: "js",
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to transform ${args.path}: ${errorMessage}`)
      }
    })
  },
}
