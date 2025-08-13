# Commit All Changes

**IMPORTANT**: This instruction delegates all git operations to the specialized `@git-autonomous-agent` for consistent, high-quality version control management.

When asked to commit changes, immediately invoke `@git-autonomous-agent` with the request to analyze and commit all current changes following the workflow below.

## Delegation to Git Autonomous Agent

When the user requests to commit changes, you should:
1. First ensure any code quality checks are complete (tests, linting)
2. Then state: "I'll use @git-autonomous-agent to handle the git workflow and create commits."
3. Invoke `@git-autonomous-agent` with the request to commit all changes

The git agent will handle all the steps below autonomously.

## Workflow Steps (Handled by @git-autonomous-agent)

### 1. Repository Initialization Check
First, verify if this directory is a Git repository:
- Check if `.git` directory exists
- If not, ask user: "This directory is not a Git repository. Should I initialize it with `git init`?"
- Only proceed with initialization if user confirms

### 2. Analyze Current State
Gather information about the repository:
- Run `git status` to see all changes (staged, unstaged, untracked)
- Use `git diff` to examine unstaged changes
- Use `git diff --cached` to examine staged changes
- List any untracked files that might need attention

### 3. Check .gitignore Configuration
Review if any files should be excluded:
- Examine current `.gitignore` file
- Look for common patterns that might be missing:
  - Build artifacts (`dist/`, `build/`, `*.pyc`, `__pycache__/`)
  - Dependencies (`node_modules/`, `venv/`, `.env`)
  - IDE files (`.vscode/`, `.idea/`, `*.swp`)
  - OS files (`.DS_Store`, `Thumbs.db`)
- If improvements are needed, ask: "I noticed [specific files/patterns]. Should I update .gitignore to exclude these?"

### 4. Analyze Commit History and Style
Understand the project's commit conventions:
- Run `git log --oneline -10` to see recent commit messages
- Identify the commit style pattern:
  - Conventional Commits format: `type(scope): description`
  - Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `build`, `ci`, `perf`
  - Check if emojis are used
  - Note typical message length and detail level
- If no commits exist, default to Conventional Commits format

### 5. Group Changes Logically
Organize changes into logical commits:
- Group related changes together (e.g., all test files, all documentation updates)
- Separate feature additions from bug fixes
- Keep refactoring in separate commits from behavior changes
- Consider file relationships and dependencies

### 6. Create Commits
For each logical group of changes:
1. Stage the relevant files with `git add [files]`
2. Generate a commit message that:
   - Follows the identified commit style
   - Clearly describes WHAT changed and WHY
   - Uses present tense, imperative mood ("add" not "added")
   - Keeps the first line under 50 characters
   - Adds detailed explanation in body if needed (after blank line)
   - NEVER mentions any AI assistant in the message
3. Create the commit with `git commit -m "message"` or multi-line format if needed
4. Verify the commit was created successfully

### 7. Handle Special Cases
- **Binary files**: Ask before committing large binary files
- **Sensitive files**: Alert if files might contain secrets (`.env`, `config.json`, etc.)
- **Merge conflicts**: If found, guide through resolution before continuing
- **Empty commits**: Skip if no actual changes exist

### 8. Final Verification
After all commits are created:
- Show `git log --oneline -5` to display recent commits
- Run `git status` to confirm working directory is clean
- Report summary: "Created X commits with Y files changed"

## GitHub Integration (if available)
If the GitHub MCP tool is available and user has a remote repository:
- Check if remote is configured with `git remote -v`
- Offer to push changes: "Would you like me to push these commits to origin?"
- If creating a new feature, offer to create a pull request

## Error Handling
- If any Git command fails, explain the error clearly
- Provide suggestions for resolution
- Never force operations without user consent
- Always preserve user's work (no destructive operations)

## Example Commit Messages

For a new feature:
```
feat(auth): add OAuth2 authentication support

- Implement OAuth2 flow with Google provider
- Add token refresh mechanism
- Include unit tests for auth service
```

For a bug fix:
```
fix(api): correct response status for invalid requests

Previously returned 200 with error message.
Now properly returns 400 Bad Request.
```

For documentation:
```
docs(readme): update installation instructions

Add prerequisites section and clarify Node version requirements
```

Remember: Clear, atomic commits with descriptive messages make project history valuable for future debugging and understanding.