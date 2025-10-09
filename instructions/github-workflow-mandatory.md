# Mandatory GitHub Workflow - Universal Enforcement

**CRITICAL: ALL development work MUST follow GitHub issue + feature branch workflow.**
**EXCEPTION: Pure research/analysis tasks can be delegated directly without GitHub issues.**

**GITHUB OPERATIONS: Use `gh` CLI exclusively** (never browser, never API calls)
Delegate to @git-autonomous-agent for: `gh issue`, `gh pr`, `gh run` commands

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
- **IF NO ISSUE**: Delegate to @git-autonomous-agent: "Create issue via gh CLI for [task description]"
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
- **NEVER fix code quality issues discovered in CI** - delegate to Project Manager for proper routing
- **ONLY work within your domain expertise** - report cross-domain issues to Project Manager
- **NEVER modify application code to fix linting/type errors** - delegate to appropriate language specialist
- **NEVER add suppression comments** (`# noqa`, `# type: ignore`, `@ts-ignore`) to application code files
- **NEVER edit code files to resolve quality issues** - report findings to Project Manager for proper delegation
- **SCOPE VIOLATION PREVENTION**: If you discover issues outside your domain during work, STOP and report to Project Manager immediately
- **DOMAIN RESTRICTIONS**: Only work on tasks explicitly within your technology stack and expertise area

**For Project Manager:**
- **DEVELOPMENT tasks**: Create GitHub issue before delegating to @git-autonomous-agent
- **RESEARCH tasks**: Delegate directly to appropriate specialist (no issue needed)
- Ensure agents follow feature branch workflow for development
- Monitor CI status before declaring development completion
- Coordinate PR creation and review process
- **ENFORCE SPECIALIST DOMAIN RESTRICTIONS** - redirect cross-domain work to appropriate specialists
- **COORDINATE MULTI-DOMAIN TASKS** - plan sequential delegation for cross-cutting features

### **9. SPECIALIST DOMAIN RESTRICTIONS - MANDATORY**

**🚨 CRITICAL DOMAIN BOUNDARIES - CROSSING THESE IS A VIOLATION:**

**@python-best-practices-architect**:
- ✅ Python code, testing, linting, type checking
- ✅ pytest, ruff, mypy, black configurations
- ✅ Python import errors, type hints, async patterns
- ❌ NEVER Dockerfiles, CI/CD configs, infrastructure
- ❌ NEVER JavaScript, React, or other language code

**@javascript-typescript-architect**:
- ✅ JavaScript/TypeScript code, Node.js
- ✅ ESLint, TypeScript configurations
- ✅ JavaScript import errors, type checking issues
- ❌ NEVER Dockerfiles, CI/CD configs, infrastructure
- ❌ NEVER Python, Ruby, or other language code

**@react-frontend-specialist**:
- ✅ React components, frontend code, UI/UX
- ✅ TypeScript interfaces for frontend
- ✅ JSX syntax issues, React-specific linting problems
- ❌ NEVER backend logic, database queries, infrastructure
- ❌ NEVER Python, Ruby, or other backend code

**@rails-architect**:
- ✅ Ruby/Rails code, ActiveRecord models, RSpec testing
- ✅ RuboCop configurations
- ✅ Rails routing, model, controller issues
- ❌ NEVER Dockerfiles, CI/CD configs, infrastructure
- ❌ NEVER Python, JavaScript, or other language code

**@rust-tdd-architect**:
- ✅ Rust code, systems programming, memory safety
- ✅ clippy, rustfmt configurations
- ✅ Rust compilation errors, borrow checker issues
- ❌ NEVER Dockerfiles, CI/CD configs, infrastructure
- ❌ NEVER Python, JavaScript, Ruby, or other language code

**@devops-infrastructure**:
- ✅ CI/CD pipelines, Docker, Kubernetes, infrastructure configs
- ✅ Infrastructure as Code (Terraform, CloudFormation)
- ✅ Deployment strategies and rollback procedures
- ✅ Monitoring, logging, and observability setup
- ❌ **NEVER** application code fixes, linting, type errors, test failures
- ❌ **NEVER** add `# noqa`, `# type: ignore`, `@ts-ignore` or similar suppression comments
- ❌ **NEVER** modify linter configuration files to ignore errors
- ❌ **NEVER** edit application code files to resolve quality issues
- ❌ **NEVER** fix import errors, syntax issues, or any language-specific problems
- **ONLY**: Report code quality issues to @project-manager for proper delegation

**@postgres-database-expert**:
- ✅ Database schema, queries, migrations, performance
- ✅ SQL syntax errors, indexing problems, query optimization
- ❌ NEVER application code, frontend components, infrastructure
- ❌ NEVER Python, JavaScript, Ruby, or other language code

**@aws-rds-postgresql-expert**:
- ✅ AWS RDS/Aurora PostgreSQL infrastructure
- ✅ Cloud database performance, scaling, monitoring
- ❌ NEVER application code, frontend components
- ❌ NEVER Python, JavaScript, Ruby, or other language code

**@api-design-architect**:
- ✅ API design, endpoints, documentation
- ✅ REST principles, HTTP status codes, versioning
- ❌ NEVER implementation code, infrastructure
- ❌ NEVER Python, JavaScript, Ruby, or other language code

**@shell-script-architect**:
- ✅ Shell scripts, automation, system utilities
- ✅ Bash syntax, POSIX compliance, portability issues
- ❌ NEVER application code, infrastructure configs
- ❌ NEVER Python, JavaScript, Ruby, or other language code

### **10. SCOPE VIOLATION HANDLING**

**When ANY specialist discovers issues outside their domain:**
- **STOP WORK IMMEDIATELY** - Do not attempt to fix cross-domain issues
- **REPORT to @project-manager** with clear details about the discovered issues
- **WAIT for proper delegation** from @project-manager to the appropriate specialist
- **CONTINUE with authorized work only** after reporting scope violations

**Example of proper scope violation handling:**
```
❌ WRONG: "@devops-infrastructure discovered Python linting errors and is fixing them directly"
✅ RIGHT: "@devops-infrastructure discovered Python linting errors during CI investigation and is reporting them to @project-manager for proper delegation to @python-best-practices-architect"
```

### **11. EMERGENCY BYPASS PROTOCOL**
**ONLY for critical production hotfixes:**
- Explicit user approval required
- Must include "HOTFIX" in all commit messages  
- Create GitHub issue retroactively
- Follow up with proper PR for audit trail

### **12. WORKFLOW VERIFICATION CHECKLIST**
Before reporting any development task complete:

- ✅ GitHub issue exists and is referenced
- ✅ Work done in feature branch (not main)
- ✅ Code pushed to remote feature branch
- ✅ Pull request created
- ✅ CI pipeline green on PR
- ✅ Code review completed (if required)
- ✅ Issue updated with completion status
- ✅ Worktree cleanup delegated (if work done in worktree)

**REMEMBER: This workflow prevents technical debt, ensures code quality, maintains project history, and enables team collaboration. No shortcuts allowed.**