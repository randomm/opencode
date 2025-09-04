# No Unsolicited Files Policy

**CRITICAL RULE: NEVER create documentation, plans, or "nice-to-have" files unless EXPLICITLY requested by the user.**

**ULTRA-CRITICAL MINIMALIST ENGINEERING PRINCIPLE: Every file is a liability. Every line of code is technical debt. Every documentation file requires maintenance. Question the necessity of EVERYTHING.**

## What This Means

### NEVER Create Without Explicit Request:
- ❌ README.md files
- ❌ CHANGELOG.md files  
- ❌ TODO.md or ROADMAP.md files
- ❌ PROJECT_PLAN.md or similar planning documents
- ❌ CONTRIBUTING.md or CODE_OF_CONDUCT.md
- ❌ Architecture diagrams or documentation
- ❌ API documentation files
- ❌ Any markdown files the user didn't specifically ask for
- ❌ "Helpful" boilerplate or template files

### What Counts as "Explicit Request":
✅ "Create a README file"
✅ "Write documentation for this API"
✅ "Generate a project plan"
✅ "I need a TODO list file"

### What DOESN'T Count:
❌ "Document this function" → Use code comments, not files
❌ "Plan the implementation" → Use TodoWrite tool, not files
❌ "Track this for later" → Use memory tools, not files
❌ "Explain the architecture" → Explain in chat, not files
❌ Starting a new project → Don't auto-create README
❌ Making improvements → Don't add documentation files

## Why This Matters

1. **Minimalism**: Every file is a maintenance burden
2. **User Control**: Users decide what files they need
3. **Focus**: Concentrate on requested work, not extras
4. **Cleanliness**: Avoid cluttering repositories
5. **Respect**: Don't assume what the user wants

## What to Do Instead

### When You Want to Document:
- **Use code comments** for explaining complex logic
- **Use memory tools** to store project information
- **Use TodoWrite** for task tracking
- **Explain in chat** when asked about architecture
- **Wait for user request** before creating any documentation file

### When Starting New Projects:
- Only create the **essential code files**
- Only add **required configuration** (.gitignore, package.json, etc.)
- **ASK** before adding any documentation: "Would you like me to create a README?"
- Let the user decide what documentation they need

### When Improving Code:
- Focus on the code quality itself
- Add comments IN the code files
- Store patterns in memory
- Don't create separate documentation

## Examples

**User**: "Create a new Python project for data analysis"
- ❌ **WRONG**: Automatically create README.md, requirements.txt, setup.py, docs/
- ✅ **RIGHT**: Create only the Python files needed, ask about documentation

**User**: "Fix the login bug and document the solution"  
- ❌ **WRONG**: Create a BUGFIX_DOCUMENTATION.md file
- ✅ **RIGHT**: Fix the bug, add comments in code, explain in chat

**User**: "Plan how to implement this feature"
- ❌ **WRONG**: Create IMPLEMENTATION_PLAN.md
- ✅ **RIGHT**: Use TodoWrite tool, explain plan in chat

## Remember

The user is in control. They will ask for what they need. Your job is to do exactly what's requested - no more, no less. Being "helpful" by creating extra files is actually unhelpful. 

**When in doubt, DON'T create the file. Ask first.**

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