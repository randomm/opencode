# Essential Documentation Standards

**MANDATE: Every project MUST have proper README.md and docs/ structure for developer onboarding and user success.**

## Required Documentation Structure

### README.md (Always in Project Root)
**MUST contain these sections:**
- **Project Overview**: What it does, why it exists
- **Quick Start**: Installation and basic usage in 2-3 steps  
- **Requirements**: Dependencies, versions, system requirements
- **Basic Usage**: Core features with minimal examples
- **Documentation**: Link to docs/ for detailed guides

**Keep README.md concise but complete** - users should understand the project and get started within 5 minutes.

### docs/ Directory (When Features Warrant Detail)
**Create docs/ when project has:**
- Complex setup procedures
- API endpoints requiring documentation  
- Multiple usage patterns or configurations
- Advanced features needing explanation

**Standard docs/ structure:**
```
docs/
├── quickstart.md      # Detailed setup and first steps
├── api/              # API documentation 
│   └── endpoints.md
├── guides/           # Feature-specific guides
│   ├── authentication.md
│   └── configuration.md
└── troubleshooting.md
```

## Content Standards

### Concise but Complete
- **Every sentence must provide value** - no fluff, but sufficient detail
- **Focus on user needs** - setup, usage, troubleshooting
- **Include working examples** - code snippets that actually work
- **Update when features change** - documentation debt is technical debt

### Standard Sections for Feature Documentation
1. **Purpose**: What the feature does
2. **Usage**: How to use it with examples  
3. **Configuration**: Available options/parameters
4. **Common Issues**: Known problems and solutions

## When to Create/Update

### Automatic Documentation Updates
- **New project**: Always create README.md
- **API implementation**: Add/update API documentation in docs/api/
- **Complex features**: Add guide in docs/guides/
- **Setup changes**: Update README.md and quickstart.md
- **Breaking changes**: Update all affected documentation

### Documentation Triggers
- ✅ **Feature affects user workflow** → Update docs
- ✅ **Setup process changes** → Update README.md  
- ✅ **API endpoints added/changed** → Update API docs
- ✅ **Configuration options added** → Update configuration guide
- ❌ **Internal refactoring only** → No documentation needed

## Placement Rules

### Always Follow Project Conventions
1. **Check existing structure** - maintain consistency
2. **README.md in root** - universal convention
3. **docs/ for detailed guides** - most common pattern
4. **Organized by feature/domain** - group related documentation

### File Naming Conventions
- Use **kebab-case** for file names (api-reference.md, quick-start.md)
- Use **descriptive names** (authentication.md, not auth.md)  
- **Group by purpose** (guides/, api/, examples/)

## Quality Standards

### Essential Documentation Quality
- **Tested examples** - all code snippets must work
- **Current information** - no outdated installation instructions
- **Clear language** - avoid jargon, explain technical terms
- **Logical flow** - organize information by user journey

**Remember: Good documentation prevents user confusion and enables project adoption. Every essential document should solve a real user problem.**