# Tool Preferences - System-Wide Standards

## Search Tools: Use ripgrep (rg) NOT grep

**MANDATORY: All agents must use `rg` (ripgrep) instead of `grep`**

### Why rg Over grep

**Performance:**
- ✅ Orders of magnitude faster on large codebases
- ✅ Parallel search by default
- ✅ Optimized for source code searching

**Intelligence:**
- ✅ Respects `.gitignore` automatically (doesn't search node_modules, .git, build artifacts)
- ✅ Skips binary files by default
- ✅ Better default behavior for code search

**Usability:**
- ✅ Recursive by default (no need for -r flag)
- ✅ Colored output for readability
- ✅ Shows line numbers by default
- ✅ More intuitive syntax

### Usage Examples

**Search for pattern in codebase:**
```bash
# ✅ CORRECT (use rg)
rg "pattern" 

# ❌ WRONG (don't use grep)
grep -r "pattern" .
```

**Search specific file types:**
```bash
# ✅ CORRECT
rg "pattern" -t python  # Search only Python files
rg "pattern" -t js      # Search only JavaScript files

# ❌ WRONG
grep -r --include="*.py" "pattern"
```

**Search with context:**
```bash
# ✅ CORRECT
rg "pattern" -A 3 -B 3  # Show 3 lines before and after

# ❌ WRONG
grep -A 3 -B 3 "pattern"
```

**Case-insensitive search:**
```bash
# ✅ CORRECT
rg -i "pattern"

# ❌ WRONG  
grep -i "pattern"
```

**Count matches:**
```bash
# ✅ CORRECT
rg "pattern" --count  # Count matches per file

# ❌ WRONG
grep -c "pattern"
```

### When to Use Each Tool

**Use rg (ripgrep):**
- ✅ Searching codebases for patterns
- ✅ Finding function/class definitions
- ✅ Locating configuration values
- ✅ Any source code search task
- ✅ **DEFAULT: Always use rg unless specific reason not to**

**Use grep (ONLY IF):**
- Searching non-text files where rg might skip
- Very specific edge cases where grep behavior is required
- **Rare exceptions only - ask PM if unsure**

### Installation Verification

Check if rg is available:
```bash
which rg  # Should return path to ripgrep
rg --version  # Should show version info
```

If not installed, agents should report to PM for installation.

### Common Patterns

**Find all references to a function:**
```bash
rg "functionName" -t rust  # In Rust files
rg "functionName" -t python  # In Python files
```

**Find TODO comments:**
```bash
rg "TODO|FIXME" --type-add 'code:*.{rs,py,js,ts}' -t code
```

**Search with file path filter:**
```bash
rg "pattern" src/  # Only search src/ directory
rg "pattern" -g "*.rs"  # Only Rust files
```

**Get list of files containing pattern:**
```bash
rg "pattern" --files-with-matches
```

## JSON Parsing: Use jq

For parsing JSON output (especially from GitHub CLI):

```bash
# ✅ CORRECT
gh issue view 244 --json number,title,body | jq -r '.body'

# Get specific field
gh issue list --json number,title | jq '.[] | .title'
```

## File Reading: Use cat

For reading file contents:

```bash
# ✅ Simple file read
cat prompts/rust-tdd-architect.txt

# ✅ Multiple files
cat prompts/*.txt

# For searching within files, use rg instead of cat + grep
```

## Remember

**Search operations:** `rg` (not `grep`)  
**JSON parsing:** `jq`  
**File reading:** `cat`  
**Counting:** `wc` or `rg --count`

All agents should follow these tool preferences for consistency and performance.