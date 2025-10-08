## Build/Test/Lint Commands

- **Dev**: `bun dev` (in packages/opencode/)
- **Test**: `bun test` or `bun turbo test`
- **Single test**: `bun test test/path/to/file.test.ts`
- **Typecheck**: `bun typecheck` (runs turbo typecheck across workspaces)
- **Format**: `./script/format.ts` (runs prettier --write)
- **Build**: `./script/build.ts` (in packages/opencode/)

## Code Style

- **Imports**: Standard library first, then third-party (alphabetical), then project imports
- **Formatting**: Prettier (semi: false, printWidth: 120) - enforced in CI
- **Types**: Use Zod schemas with `z.infer<>`, avoid `any`, TypeScript 5.8+
- **Naming**: Single word variables preferred, descriptive for public APIs
- **Error handling**: Use NamedError.create() pattern from util/error, avoid try/catch where possible
- **Bun APIs**: Prefer Bun.file(), Bun.write(), $ from "bun" over node:fs

## Patterns to Follow

- Keep functions single-purpose unless composable/reusable
- Avoid `else` statements (early returns preferred)
- Avoid `let` (use `const` with functional patterns)
- Avoid unnecessary destructuring
- Use namespace pattern for modules (e.g., `export namespace Snapshot`)
- Tests use bun:test with async/await and `await using` for cleanup

## Tool Calling

- ALWAYS USE PARALLEL TOOLS WHEN APPLICABLE. Here is an example illustrating how to execute 3 parallel file reads in this chat environnement:

```json
{
  "recipient_name": "multi_tool_use.parallel",
  "parameters": {
    "tool_uses": [
      {
        "recipient_name": "functions.read",
        "parameters": {
          "filePath": "path/to/file.tsx"
        }
      },
      {
        "recipient_name": "functions.read",
        "parameters": {
          "filePath": "path/to/file.ts"
        }
      },
      {
        "recipient_name": "functions.read",
        "parameters": {
          "filePath": "path/to/file.md"
        }
      }
    ]
  }
}
```
