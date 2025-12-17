# Context7 - Library Documentation MCP

## What Context7 Provides

Context7 is a Model Context Protocol (MCP) server that provides up-to-date documentation for 1000+ libraries and frameworks including:
- **Languages**: Python, JavaScript/TypeScript, Go, Rust, Ruby, Java, C/C++, and more
- **Frameworks**: React, Django, Rails, Express, FastAPI, Gin, Actix, and others
- **Libraries**: Pandas, NumPy, Jest, Vitest, pytest, cargo, and thousands more
- **Tools**: Build systems, package managers, testing frameworks, and utilities

## When to Use Context7 (Explicit Triggers)

**🚨 MANDATORY in these situations - NO EXCEPTIONS:**

1. **ANY Library/Framework Name Encountered**: Issue or codebase mentions ANY library/framework
   - **Trigger IMMEDIATELY**: BEFORE reading existing code using that library
   - **Example**: "Create Maestro test" → resolve-library-id for Maestro BEFORE reading .yaml files

2. **Implementation Starting**: Beginning code that imports/uses a third-party tool
   - **Even if familiar** with the library
   - **Your training data may be 1+ years old**

3. **Version Uncertainty**: When library version is unclear
   - **Check package.json** → Get docs for that exact version

**🔥 DECISION WORKFLOW (Non-negotiable):**
```
Library name encountered → resolve-library-id → get-library-docs → Read docs → THEN read existing code → THEN implement
```

**⚠️ WHY THIS IS CRITICAL - FAILURE EXAMPLES:**

❌ **OUTDATED TRAINING DATA CONSEQUENCES:**
- React 18: `ReactDOM.render` deprecated → `ReactDOM.createRoot` required
- Python 3.11+: `asyncio.create_task()` behavior changed
- Rust 1.65+: `IntoFuture` trait affects async patterns
- Your training data has 1-2 year old APIs!

❌ **ANTI-PATTERN (What NOT to Do):**
- Read existing Maestro YAML → Create test based on pattern → Miss current API
- "I know React" → Skip Context7 → Use deprecated patterns  
- grep codebase → Replicate pattern → Pattern uses outdated API

✅ **CORRECT PATTERN (What to Do):**
- See library name → Context7 → Read CURRENT docs → Understand current API → THEN implement

## Tool Hierarchy: Context7 > Perplexity > Training Data

**Context7 (FIRST):** Library/framework documentation and APIs
- Official documentation for 1000+ libraries
- Always current, version-specific when available
- Use BEFORE implementing with ANY library

**Perplexity (SECOND):** General research and understanding
- Concepts, comparisons, explanations
- "Why use React vs Vue?" 
- Debugging strategies when docs unclear

**Training Data (LAST):** Only for general patterns without library-specific APIs
- Language fundamentals, design patterns
- NEVER for library APIs or versions

## How to Use Context7

Context7 provides two main tools:

### resolve-library-id
Searches for a library by name and returns its Context7 ID. Use this first to find the library you need.

```
resolve-library-id: "React"  → Returns Context7 ID for React
resolve-library-id: "pandas" → Returns Context7 ID for pandas
resolve-library-id: "pytest" → Returns Context7 ID for pytest
```

### get-library-docs
Retrieves current documentation for a specific library using its Context7 ID.

```
get-library-docs: "<context7-id>" → Returns latest official docs
```

## Rate Limits

- **Free tier**: 10,000 calls/month
- **Sufficient for**: Regular development work with ~50-100 calls per day
- Monitor usage if calling Context7 for every minor decision

## Context7 vs Perplexity

| Tool | Best For | When to Use |
|------|----------|-------------|
| **Context7** | Library/framework APIs and official docs | Before implementing with ANY library |
| **Perplexity** | General research, comparisons, explanations | Understanding concepts, tool comparisons, debugging |

**Example**: Need React docs? → Context7. Need "why use React vs Vue?" → Perplexity.

## Anti-Pattern (What NOT to Do)

❌ **WRONG**: Read existing Maestro YAML → Create test based on pattern → Miss current API
❌ **WRONG**: "I know [library]" → Skip Context7 → Use outdated API  
❌ **WRONG**: grep codebase → Replicate pattern → Pattern uses deprecated API

✅ **RIGHT**: See "Maestro" in issue → resolve-library-id → get-library-docs → Read current API → THEN read existing patterns → Implement with confidence

## Quick Start

1. Search for your library: `resolve-library-id: "libraryname"`
2. Get its docs: `get-library-docs: "<returned-id>"`
3. Reference official documentation before coding
4. Implement with current API knowledge

**Remember**: Always check official docs before making assumptions about library behavior or API changes.
