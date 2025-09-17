# Essential vs Speculative Documentation Policy

**CRITICAL RULE: NEVER create speculative documentation or "nice-to-have" files. ALWAYS maintain essential project documentation.**

**ULTRA-CRITICAL MINIMALIST ENGINEERING PRINCIPLE: Every file is a liability, but essential documentation prevents developer confusion and enables project success. Question everything except what users NEED to understand and use the project.**

## What This Means

### ALWAYS Create/Maintain (Essential Documentation):
- ✅ **README.md** in project root (project overview, setup, basic usage)
- ✅ **docs/** directory with organized guides when features exist
- ✅ **API documentation** in docs/ when APIs are implemented
- ✅ **Setup/installation guides** when complex setup is required
- ✅ **Usage examples** for key features in README.md or docs/

### NEVER Create Without Explicit Request (Speculative Documentation):
- ❌ CHANGELOG.md files (use git history)
- ❌ TODO.md or ROADMAP.md files (use TodoWrite tool)
- ❌ PROJECT_PLAN.md or similar planning documents
- ❌ CONTRIBUTING.md or CODE_OF_CONDUCT.md (unless established project)
- ❌ Architecture diagrams or documentation (unless requested)
- ❌ Random markdown files in arbitrary locations
- ❌ "Helpful" boilerplate or template files

### When Essential Documentation is Automatically Created:
✅ **Implementing new features** → Update README.md and relevant docs/
✅ **Creating APIs** → Add/update API documentation in docs/
✅ **Complex setup requirements** → Ensure setup guide exists
✅ **Project has missing README.md** → Create comprehensive overview
✅ **Adding significant functionality** → Document in appropriate location

### What Still Requires Explicit Request:
❌ "Document this function" → Use code comments, not files
❌ "Plan the implementation" → Use TodoWrite tool, not files  
❌ "Track this for later" → Use memory tools, not files
❌ "Explain the architecture" → Explain in chat unless complex project needs docs/
❌ Speculative documentation → Only create what users need NOW

## Why This Balanced Approach Matters

1. **Essential vs Bloat**: Essential documentation enables success, speculative documentation creates maintenance burden
2. **Developer Onboarding**: Every project needs README.md and proper docs/ for new developers
3. **Focus**: Concentrate on user-needed documentation, not "helpful" extras
4. **Standards**: Follow documentation conventions (README.md in root, organized docs/)
5. **Maintainability**: Update documentation when features change, but don't create unnecessary files

## What to Do Instead

### For Essential Documentation:
- **Create/update README.md** for project overview, setup, and basic usage
- **Maintain docs/ directory** with organized guides for complex features
- **Add API documentation** when implementing APIs
- **Update existing docs** when features change
- **Follow project conventions** for documentation structure

### For Non-Essential Information:
- **Use code comments** for explaining complex logic  
- **Use memory tools** to store project patterns and context
- **Use TodoWrite** for task tracking and planning
- **Explain in chat** for one-off questions
- **Wait for user request** before creating speculative documentation

### When Starting New Projects:
- Create the **essential code files**  
- Add **required configuration** (.gitignore, package.json, etc.)
- **Always create README.md** with project overview, setup instructions, and basic usage
- **Create docs/ directory** if the project has complex features that need detailed documentation
- **Never create speculative files** (changelogs, project plans, etc.)

### When Implementing Features:
- **Update README.md** if the feature affects setup or basic usage
- **Add/update docs/** for complex features that need detailed explanation
- **Add code comments** for complex logic within implementation
- **Don't create separate planning files** - use TodoWrite and memory tools

## Examples

**User**: "Create a new Python project for data analysis"
- ❌ **WRONG**: Create random planning files, changelogs, or speculative docs
- ✅ **RIGHT**: Create Python files, requirements.txt, README.md with overview/setup/usage

**User**: "Fix the login bug and document the solution"  
- ❌ **WRONG**: Create a BUGFIX_DOCUMENTATION.md file
- ✅ **RIGHT**: Fix the bug, add comments in code, update relevant docs/ if needed

**User**: "Implement user authentication API"
- ❌ **WRONG**: Create PROJECT_PLAN.md or ARCHITECTURE.md files
- ✅ **RIGHT**: Implement API, update README.md usage section, add API docs in docs/api.md

**User**: "Plan how to implement this feature"
- ❌ **WRONG**: Create IMPLEMENTATION_PLAN.md
- ✅ **RIGHT**: Use TodoWrite tool, explain plan in chat

## Remember

Essential documentation (README.md, docs/) enables project success and developer onboarding. Speculative documentation creates maintenance burden. Create what users NEED to understand and use the project, but never create random "helpful" files.

**Essential documentation = automatic. Speculative documentation = ask first.**

## Documentation Placement Rules (When Documentation IS Explicitly Requested)

**IF the user explicitly requests documentation creation:**

### 1. NEVER Place Documentation in Project Root Unless Specifically Requested
- ❌ **WRONG**: Auto-placing README.md in project root
- ✅ **RIGHT**: Ask "Would you like this in the project root or docs/ directory?"

### 2. Research Project Documentation Conventions First
**BEFORE creating any documentation file:**
- Check if project has existing `docs/`, `documentation/`, or `wiki/` directory
- Look for existing documentation patterns in the codebase
- Follow the project's established structure

### 3. Preferred Documentation Locations (In Order of Preference)
1. **docs/** directory (most common convention)
2. **documentation/** directory  
3. **wiki/** or project-specific docs folder
4. **Project root ONLY if explicitly requested or no docs directory exists**

### 4. Always Ask About Location
Even when documentation is explicitly requested:
- ✅ **"Where would you like this documentation file? In docs/ directory or project root?"**
- ✅ **"I see you have a docs/ folder. Should I place this README there or in the root?"**
- ✅ **"This project follows [pattern]. Should I maintain that convention?"**

### 5. Maintain Project Documentation Architecture
- **Respect existing patterns**: If project uses `docs/api/` for API docs, continue that pattern
- **Follow naming conventions**: Match existing file naming (kebab-case, snake_case, etc.)
- **Mirror directory structure**: If code is organized by feature, organize docs similarly

## Minimalist Documentation Principles

**When creating ANY documentation (even when requested):**

### Be Intentionally Effective  
- **Every sentence must have clear value** - Remove fluff and pleasantries, but include sufficient detail
- **One purpose per document** - Each document should serve a specific user need
- **Eliminate redundancy** - Don't repeat information available elsewhere
- **Choose the right format** - Sometimes comprehensive documentation is better than code comments

### Question Documentation Necessity
**Before writing ANY documentation, ask:**
- Is this information obvious from reading the code?
- Will this become outdated quickly?
- Can this be expressed as a code comment instead?
- Does this solve a real problem users have?
- Is there already similar documentation elsewhere?

### Keep Documentation Minimal and Focused
```markdown
✅ GOOD: Minimal, focused documentation
# User Authentication

## Quick Start
1. Import: `from auth import login`
2. Use: `token = login(username, password)`
3. Headers: `Authorization: Bearer {token}`

## Error Codes
- 401: Invalid credentials
- 429: Rate limited
```

```markdown
❌ BAD: Verbose, over-documented
# Comprehensive User Authentication System Documentation

Welcome to our authentication system! This document will guide you through...

## Table of Contents
1. Introduction
2. Overview
3. Getting Started
4. Prerequisites
5. Installation
6. Configuration
7. Usage Examples
...
```

## The Golden Rule of Documentation

**Good documentation is essential for complex projects. Users need sufficient information to understand what the project is, how to use it, and how to contribute. However, documentation should be created intentionally, placed appropriately, and written with clear purpose - not generated automatically or speculatively.**

**Examples of Good Documentation Structure:**
- Clear README.md explaining project purpose, features, and getting started
- Well-organized docs/ directory with specific guides (quickstart, API reference, architecture)  
- Each document serves a specific user need (new users, developers, contributors)
- Sufficient detail without unnecessary verbosity