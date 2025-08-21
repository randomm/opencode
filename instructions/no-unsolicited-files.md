# No Unsolicited Files Policy

**CRITICAL RULE: NEVER create documentation, plans, or "nice-to-have" files unless EXPLICITLY requested by the user.**

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