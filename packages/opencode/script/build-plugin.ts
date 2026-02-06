import { transformAsync } from "@babel/core"
import ts from "@babel/preset-typescript"
import solid from "babel-preset-solid"
import { type BunPlugin } from "bun"

/**
 * Bun build plugin that handles SolidJS transformations for .tsx/.jsx files.
 */
export const solidTransformPlugin: BunPlugin = {
  name: "solid-transform-plugin",
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
