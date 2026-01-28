# Bug Fixes #101 and #102

## Summary

Fixed two display bugs in the oclite TUI:

1. Tools appearing inline with prose text
2. check_task tool spamming the output with repeated identical calls

## Bug #101: Tools Render Inline with Prose

### Problem

Tools appeared on the same line as prose text, making output hard to read:

```
most impactful ones first.  ◇ bash  gh issue create...
```

### Root Cause

When `flushLineBuffer()` was called before rendering a tool, it wrote prose text directly to stdout without ensuring the tool appeared on a new line. The `logUpdate` from liveblock would then overlay the tool on the same line.

### Fix

Modified `flushLineBuffer()` to accept an optional `addNewline` parameter. When flushing prose before a tool starts, a newline is added to ensure tools render on their own line.

**File:** `packages/opencode/src/cli/lite/index.ts`

```typescript
function flushLineBuffer(addNewline = false) {
  if (!lineBuffer) return
  const rendered = md.render(lineBuffer)
  const wrapped = wrap(rendered, MAX_WIDTH)
  write(padLines(wrapped))
  if (addNewline) write("\n")
  lineBuffer = ""
}

// Usage before tool_start
if (chunk.type === "tool_start" && chunk.tool?.trim()) {
  flushLineBuffer(true) // Add newline before tool
  // ... tool rendering
}
```

### Testing

- Verified tools now render on separate lines from prose
- Text rendering still works correctly for regular prose chunks
- Multiple tools render on separate lines as expected

## Bug #102: check_task Spam

### Problem

When a task is polled repeatedly (e.g., checking status every few seconds), the output showed the same tool ID 20+ times:

```
◇ check_task  Checking task abc123
◇ check_task  Checking task abc123 (×2)
◇ check_task  Checking task abc123 (×3)
...
```

### Root Cause

The deduplication logic tracked tool names + summaries, but created new tool IDs each time (via `++toolCounter`). When polling the same task, each poll generated:

- Same tool name (`"check_task"`)
- Same summary (task ID string)
- Same `lastToolKey`
- Different tool IDs (`check_task-1`, `check_task-2`, ...)

Each new tool ID created a new entry in the live block, causing spam and wasting re-renders.

### Fix

Simplified the deduplication to maintain a single tool ID across updates. When `tool_start` is called with the same `callID` or tool key, the existing tool ID is reused and only the label is updated.

**File:** `packages/opencode/src/cli/lite/index.ts`

```typescript
if (chunk.type === "tool_start" && chunk.tool?.trim()) {
  flushLineBuffer(true)
  const tool = chunk.tool.trim()
  const arg = summarizeInput(tool, chunk.input)
  const summary = arg || ""
  const key = `${tool}:${summary}`

  // Increment dedup count or reset for new tools
  if (key === lastToolKey) {
    dedupCount++
  } else {
    dedupCount = 1
    lastToolKey = key
    lastToolId = chunk.callID || `${tool}-${++toolCounter}`
  }

  // Always update the same tool ID
  const label = dedupCount > 1 ? `${summary} (×${dedupCount})` : summary
  block.toolStart(lastToolId, tool, label)
  // ...
}
```

### Testing

- Repeated `check_task` calls for same task now show single entry
- Label increments show polling activity: `Checking task abc123 (×3)`
- Different task IDs create separate tool entries
- Non-polling tools (bash, read, etc.) unaffected

## Verification

All tests pass:

```bash
cd packages/opencode
bun run typecheck # 0 errors
bun test          # 1334 tests pass
bun run build:lite # Binary built and installed
```

Binary rebuilt and installed to `~/bin/oclite` with fixes applied.
