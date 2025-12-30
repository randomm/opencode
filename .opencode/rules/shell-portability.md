# Shell Portability Rules

When working with shell scripts (*.sh):
- POSIX-compliant when possible for portability
- `set -euo pipefail` at script start
- `command -v` not `which` for command existence
- Quote all variables: `"$var"` not `$var`
- Use `[ ]` not `[[ ]]` for POSIX compliance (unless bash-specific)
- ShellCheck must pass with zero warnings
- Trap for cleanup: `trap cleanup EXIT`
- Functions for reusable logic, max 50 lines per function
