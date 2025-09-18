# Mandatory GitHub Workflow - Universal Enforcement

**CRITICAL: ALL development work MUST follow GitHub issue + feature branch workflow.**
**EXCEPTION: Pure research/analysis tasks can be delegated directly without GitHub issues.**

## Workflow Requirements by Task Type

### **🔍 RESEARCH/ANALYSIS TASKS (NO ISSUE REQUIRED):**
**Direct delegation allowed for:**
- Information gathering and research
- Technology evaluation and comparison  
- Pricing analysis and cost assessment
- Feasibility studies without implementation
- Tool/service recommendations
- Architecture research and analysis

**Keywords indicating research:** research, investigate, analyze, compare, evaluate, find, assess, study, pricing, alternatives, feasibility, pros/cons

### **💻 DEVELOPMENT TASKS (GITHUB ISSUE MANDATORY):**

### **1. NO DEVELOPMENT WITHOUT GITHUB ISSUE**
- **BEFORE ANY DEVELOPMENT**: Verify GitHub issue exists for the task
- **IF NO ISSUE**: Immediately delegate to @git-autonomous-agent: "Create GitHub issue for [task description]"
- **REFUSE ALL DEVELOPMENT WORK** without proper GitHub issue tracking
- **INCLUDE ISSUE REFERENCE** in all commits and communications

### **2. FEATURE BRANCH WORKFLOW MANDATORY**
- **NEVER work directly in main branch**
- **ALWAYS create feature branch**: `feature/issue-123-description` or `fix/issue-456-bugname`
- **BRANCH FIRST**: Create branch before any code changes
- **PUSH TO FEATURE BRANCH**: All work goes to feature branch, not main

### **3. DEVELOPMENT WORKFLOW ENFORCEMENT STEPS**
Every development agent MUST follow this sequence for DEVELOPMENT tasks only:

1. **VERIFY ISSUE**: Check if GitHub issue exists
2. **CREATE ISSUE** (if missing): Delegate to @git-autonomous-agent
3. **CREATE FEATURE BRANCH**: From current main branch  
4. **IMPLEMENT CHANGES**: Work in feature branch only
5. **PUSH TO REMOTE**: Push feature branch regularly
6. **CREATE PR**: When work complete
7. **CI VERIFICATION**: Ensure CI passes on PR
8. **ONLY THEN COMPLETE**: Report success after CI green

### **4. DEVELOPMENT WORKFLOW VIOLATION DETECTION**
Development agents MUST check for violations before starting DEVELOPMENT work:

**RED FLAGS (STOP IMMEDIATELY):**
- Working in main branch
- No GitHub issue reference
- Direct commits to main
- Missing feature branch
- Local-only work without remote push

**RESPONSE TO VIOLATIONS:**
- **STOP ALL WORK** immediately
- **DELEGATE TO @git-autonomous-agent** to fix workflow
- **DO NOT PROCEED** until proper workflow established

### **5. GITHUB ISSUE REQUIREMENTS**
Every GitHub issue MUST contain:
- **Clear description** of work to be done
- **Acceptance criteria** or definition of done
- **Labels** for work type (feature, bug, docs, etc.)
- **Milestone** if part of larger effort

### **6. FEATURE BRANCH NAMING**
Use consistent naming patterns:
- **Features**: `feature/123-user-authentication`
- **Bug fixes**: `fix/456-login-error`  
- **Documentation**: `docs/789-api-documentation`
- **Refactoring**: `refactor/101-database-optimization`

### **7. COMMIT MESSAGE REQUIREMENTS**
Every commit MUST:
- **Reference GitHub issue**: "feat: add user auth (#123)"
- **Follow conventional commits**: type(scope): description
- **Be atomic**: One logical change per commit
- **Have clear description**: What and why changed

### **8. AGENT-SPECIFIC ENFORCEMENT**

**For Development Agents (when handling DEVELOPMENT tasks):**
- Check for GitHub issue at start of work
- Create feature branch before first commit
- Reference issue number in all commits
- Push to feature branch regularly
- Never work directly in main branch
- Report completion only after PR + CI success

**For Project Manager:**
- **DEVELOPMENT tasks**: Create GitHub issue before delegating to @git-autonomous-agent
- **RESEARCH tasks**: Delegate directly to appropriate specialist (no issue needed)
- Ensure agents follow feature branch workflow for development
- Monitor CI status before declaring development completion
- Coordinate PR creation and review process

### **9. EMERGENCY BYPASS PROTOCOL**
**ONLY for critical production hotfixes:**
- Explicit user approval required
- Must include "HOTFIX" in all commit messages  
- Create GitHub issue retroactively
- Follow up with proper PR for audit trail

### **10. WORKFLOW VERIFICATION CHECKLIST**
Before reporting any development task complete:

- ✅ GitHub issue exists and is referenced
- ✅ Work done in feature branch (not main)
- ✅ Code pushed to remote feature branch
- ✅ Pull request created
- ✅ CI pipeline green on PR
- ✅ Code review completed (if required)
- ✅ Issue updated with completion status

**REMEMBER: This workflow prevents technical debt, ensures code quality, maintains project history, and enables team collaboration. No shortcuts allowed.**