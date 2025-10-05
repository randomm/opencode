# Documentation & File Creation Policy

## Core Principle
Documentation is valuable when needed, but MUST be created intentionally with user approval. Never auto-create documentation files.

## Documentation Approval Process

### MANDATORY WORKFLOW:
1. **Subagent** identifies potential documentation need during work
2. **Subagent checks conventions first**: Look at existing docs/ structure, naming patterns, CONTRIBUTING.md
3. **Subagent asks PM**: "This feature may need documentation. Should I create docs/feature-name.md?"
4. **PM asks user**: "Should we create documentation for [feature]? Suggested: docs/feature-name.md"
5. **User approves/denies** - explicit decision required
6. **ONLY if approved**: Create documentation following conventions

### NEVER:
- ❌ Auto-create documentation because "it might be helpful"
- ❌ Create documentation without asking user
- ❌ Assume documentation is needed
- ❌ Create multiple documentation files without approval

## Documentation Structure

### Location Rules:
- ✅ `README.md` - Project root (overview + links to docs/)
- ✅ `docs/` - All detailed documentation lives here
- ✅ `docs/feature-name.md` - Specific feature documentation
- ❌ `FEATURE_NAME.md` in project root - Never create docs in root except README.md
- ❌ Multiple READMEs - Only ONE README.md in project root

### Naming Conventions:
- ✅ `lowercase-with-hyphens.md`
- ✅ `docs/setup-guide.md`
- ✅ `docs/api-reference.md`
- ❌ `ALL_CAPS.md` - **NEVER use ALL CAPS naming**
- ❌ `PascalCase.md` - Avoid PascalCase
- ❌ `snake_case.md` - Use hyphens, not underscores

### Documentation Organization:
```
project-root/
├── README.md                      # Main overview, links to docs/
└── docs/
    ├── setup-guide.md            # Installation and setup
    ├── api-reference.md          # API documentation
    ├── architecture.md           # System architecture
    └── contributing.md           # Contribution guidelines
```

## Convention Discovery

### Before Creating ANY Documentation:
1. **Check existing docs/** structure and patterns
2. **Read CONTRIBUTING.md** or docs/README.md if they exist
3. **Look at existing filenames** for naming patterns
4. **Follow project conventions** if they exist
5. **Ask user about conventions** if project has none

## Examples

### ❌ WRONG (Auto-created 7 files without asking):
During a task, agent created:
- `README_PHASE2.md`
- `QUICK_START.md`
- `PHASE2_INDEX.md`
- `TAILSCALE_SSH_SETUP.md`
- `PHASE2_DELIVERABLES.md`
- `SETUP_FLOW.txt`
- `COMMANDS.txt`

**Problems**:
- No user approval requested
- ALL_CAPS naming
- In project root instead of docs/
- Redundant files (7 docs for one feature)
- Multiple READMEs

### ✅ RIGHT (Asked user, got approval, proper structure):
**Subagent**: "Tailscale SSH setup complete. Create documentation?"

**PM asks user**: "Create documentation for Tailscale SSH? Suggested: docs/tailscale-setup.md"

**User**: "Yes, create docs/tailscale-setup.md"

**Result**:
- `docs/tailscale-setup.md` - Comprehensive setup guide
- `README.md` updated with: "See [Tailscale Setup](docs/tailscale-setup.md) for instructions"
- Single focused documentation file
- Proper naming and location

## README.md Policy

### When to Update README.md:
- ✅ Feature changes project setup/installation
- ✅ Feature changes basic usage patterns
- ✅ New feature needs to be discoverable
- ✅ Project structure changes

### How to Update README.md:
- Add link to new documentation in docs/
- Keep README.md high-level
- Don't duplicate docs/ content in README.md
- Link format: `[Feature Name](docs/feature-name.md)`

## Non-Essential Files

### NEVER Create Without Explicit Request:
- ❌ `CHANGELOG.md` - Use git history
- ❌ `TODO.md` or `ROADMAP.md` - Use TodoWrite tool
- ❌ `PROJECT_PLAN.md` - Planning docs not needed
- ❌ `ARCHITECTURE.md` - Only if explicitly requested
- ❌ Random `.txt` files for notes
- ❌ Speculative documentation "for later"

### Use Instead:
- **Git history** for changelog tracking
- **TodoWrite tool** for task management
- **Memory tools** to store patterns and context
- **Code comments** for implementation details
- **Chat responses** for one-off explanations

## When Documentation IS Appropriate

### Good Reasons to Create Documentation (with approval):
- Complex setup process that users will repeat
- API endpoints that need reference documentation
- Architecture decisions that need explanation
- Contribution guidelines for team members
- Feature usage that isn't obvious from code

### Bad Reasons to Create Documentation:
- "Might be helpful someday"
- "Professional projects have lots of docs"
- "Let me create docs for each phase"
- "Quick reference guides" for simple features
- "Index files" that just list other files

## Minimalist Documentation Principles

### When Approved to Create Documentation:

**Be Intentionally Effective:**
- Every sentence must have clear value
- One purpose per document
- Eliminate redundancy
- Keep it focused and minimal

**Question Before Writing:**
- Is this information obvious from reading the code?
- Will this become outdated quickly?
- Can this be expressed as a code comment instead?
- Does this solve a real user problem?

**Structure:**
```markdown
# Feature Name

Brief description (1-2 sentences)

## Quick Start
1. Step one
2. Step two
3. Step three

## Common Issues
- Issue 1: Solution
- Issue 2: Solution
```

**NOT:**
```markdown
# Comprehensive Feature Documentation

Welcome! This is a comprehensive guide...

## Table of Contents
1. Introduction
2. Overview
3. Getting Started
4. Prerequisites
... (excessive structure)
```

## The Golden Rule

**User approval required for ALL documentation creation.**

If you're unsure whether documentation is needed:
1. Check existing project conventions
2. Ask project manager
3. PM asks user
4. Wait for explicit approval
5. Only then create (in docs/, lowercase-with-hyphens.md)

**When in doubt, ASK. Never assume.**
