## oclite Terminal UI Rendering Fixes

### Changes Made to `/Users/janni/git/opencode/packages/opencode/src/cli/lite/liveblock.ts`

#### Fix 1: Prevent Duplicate Task Tool Rendering (Line 46)

**Before:**

```typescript
for (const tool of tools.values()) {
  const sep = tool.summary ? "  " : ""
  const isTask = tool.name === "task"
  // ... conditional logic with isTask
}
```

**After:**

```typescript
for (const tool of tools.values()) {
  if (tool.name === "task") continue // Skip task tools - they're rendered separately
  const sep = tool.summary ? "  " : ""
  // ... simplified logic without isTask
}
```

**Why:** Task tools were being added to both `tools` and `tasks` Maps, causing them to render twice - once in the tools loop (with ◇ icon) and once in the tasks loop (with spinner).

#### Fix 2: Correct Multi-line Animation (Line 113)

**Before:**

```typescript
logUpdate(lines.join("\n") + "\n")
```

**After:**

```typescript
logUpdate(lines.join("\n"))
```

**Why:** The `log-update` library internally adds a trailing newline (see line 140 of `node_modules/log-update/index.js`). Adding one ourselves caused incorrect line counting, making cursor positioning fail during animated updates. This resulted in only the last line being visible during animation.

### Verification Steps

1. **Rebuild the binary:**

   ```bash
   cd /Users/janni/git/opencode/packages/opencode
   bun run build:lite
   ```

2. **Test in a real terminal (requires TTY):**

   ```bash
   ~/bin/oclite 'Write hello.txt with Hello World'
   ```

3. **Expected improvements:**
   - ✅ No duplicate task tool rendering
   - ✅ All lines visible during animation (not just the last one)
   - ✅ Theme colors applied (green ✓, yellow spinners, dimmed gray tool names)
   - ✅ Elapsed time showing on tasks: `(5s)`
   - ✅ Nested child tools with indentation: `    └─ ◇ child-tool`

### Code Details

**Theme colors are applied in the render logic:**

- Completed tools: `theme.tool.done.icon` = green + `theme.tool.done.text` = dim gray
- Running tools: `theme.tool.running.icon` = yellow + `theme.tool.running.text` = dim gray
- Error tools: `theme.tool.error.icon` = red + `theme.tool.error.text` = red
- Tasks: `theme.task.running.icon` = yellow + `theme.task.running.text` = cyan
- Elapsed time: `fg.gray` for the `(Xs)` text

**Elapsed time logic (line 76):**

```typescript
const elapsed = task.status === "running" ? Math.floor((Date.now() - task.startTime) / 1000) : task.elapsed
```

**Nested child tool rendering (lines 81-88):**
Only rendered when task is running and has a childTool attached, with proper indentation.

### Testing Status

- Binary rebuilt: ✅
- Changes verified in code: ✅
- Manual testing required: ⏳ (needs TTY environment)
