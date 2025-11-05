# Rollbar MCP Server Integration - Work Machine Only

This instruction is ONLY loaded on the work machine configuration. It provides Rollbar MCP Server awareness for error investigation and debugging workflows.

## Available on This Machine

The Rollbar MCP Server (`@rollbar/mcp-server`) is installed and configured for accessing production error data. This official TypeScript-based stdio server from Rollbar enables AI-integrated error investigation without manual API calls.

## Project Manager Responsibilities

**@project-manager** has direct access to Rollbar MCP tools for context gathering before delegation.

### When to Use Rollbar MCP Directly

The PM can query Rollbar directly for:
- Getting top errors from production: `get-top-items(environment)`
- Quick error context before delegation: `get-item-details(item_id)`
- Checking deployment history: `get-deployments(limit)`
- Verifying version-specific errors: `get-version(version, environment)`

### When to Delegate to Research Specialist

The PM delegates detailed investigation to @research-specialist for:
- Complex root cause analysis requiring stack trace study
- Multi-deployment error pattern comparison
- Analyzing error context within application code
- Producing comprehensive error reports with recommendations

### Typical Workflow Pattern

```
1. User: "Investigate critical auth errors in production"

2. PM: Uses get-top-items("production")
   → Returns: List of top errors with occurrence counts

3. PM: Identifies critical error, e.g., "AuthenticationError: JWT expired" (ID: 45678)

4. PM decides if investigation needed:
   - Simple investigation → Use get-item-details(45678) directly
   - Complex root cause → Delegate to @research-specialist

5. If delegating to Research Specialist:
   Research uses: get-item-details(45678) for full stack trace
   Research analyzes: Occurrence patterns, affected versions, timeline
   Research stores: Findings in remory with recommendations
   Research returns: Root cause analysis with next steps

6. PM: Reports findings to user with actionable recommendations
```

## MCP Tools Available

### get-top-items(environment)

**Purpose:** Retrieve the most critical errors from the last 24 hours in a specific environment.

**Parameters:**
- `environment` (string, required): Environment name (e.g., "production", "staging")

**Returns:** Array of top error items with:
- Item ID (unique identifier for the error)
- Title (error message/type)
- Occurrence count (how many times it occurred)
- Last occurrence timestamp
- Environment and status

**Example:**
```
User Query: "Show me top errors in production"

Tool Call: get-top-items("production")

Response:
{
  "items": [
    {
      "id": 45678,
      "title": "AuthenticationError: JWT token expired",
      "occurrences": 342,
      "lastOccurrence": "2024-11-05T14:32:00Z",
      "environment": "production",
      "level": "critical"
    },
    {
      "id": 45679,
      "title": "DatabaseConnectionError: Connection timeout",
      "occurrences": 156,
      "lastOccurrence": "2024-11-05T14:15:00Z",
      "environment": "production",
      "level": "error"
    }
  ]
}
```

**Use Cases:**
- Quick assessment of production health
- Identifying critical errors requiring immediate attention
- Finding errors to investigate before delegating to specialists

### get-item-details(item_id, max_tokens?)

**Purpose:** Get comprehensive error information including full stack trace, context, and occurrence details.

**Parameters:**
- `item_id` (number, required): Rollbar item ID
- `max_tokens` (number, optional): Maximum tokens for response (default: 20000)

**Returns:** Complete error details including:
- Full stack trace with file paths and line numbers
- Error message and type
- Context data (user, environment, version)
- Last occurrence details and timestamp
- Affected deployment version
- Request/response information (if available)
- Custom data attached to error

**Example Stack Trace Response:**
```
{
  "item": {
    "id": 45678,
    "title": "AuthenticationError: JWT token expired",
    "environment": "production",
    "stack": [
      {
        "filename": "src/middleware/auth.ts",
        "method": "verifyToken",
        "lineno": 42,
        "code": "const payload = jwt.verify(token, SECRET_KEY);"
      },
      {
        "filename": "src/routes/api.ts",
        "method": "authenticateRequest",
        "lineno": 15,
        "code": "const user = await verifyToken(req.headers.authorization);"
      }
    ],
    "lastOccurrence": {
      "timestamp": "2024-11-05T14:32:00Z",
      "request": {
        "method": "GET",
        "url": "/api/user/profile",
        "headers": { "authorization": "Bearer eyJ..." }
      }
    },
    "version": "2.1.0",
    "occurrences": 342
  }
}
```

**Use Cases:**
- Getting stack traces for detailed analysis
- Understanding error context and affected versions
- Identifying code locations where errors originate
- Analyzing request/response data associated with errors

### get-deployments(limit)

**Purpose:** View project deployment history with version details.

**Parameters:**
- `limit` (number, required): Number of recent deployments to retrieve

**Returns:** List of recent deployments with:
- Deployment ID
- Version/SHA deployed
- Deployment timestamp
- Environment deployed to
- Deployment status (success/failed)
- Commit message or release notes

**Example:**
```
Tool Call: get-deployments(5)

Response:
{
  "deployments": [
    {
      "id": "deploy-789",
      "version": "2.1.2",
      "timestamp": "2024-11-05T12:00:00Z",
      "environment": "production",
      "status": "success",
      "sha": "abc123def456",
      "notes": "Fixed JWT expiration handling"
    },
    {
      "id": "deploy-788",
      "version": "2.1.1",
      "timestamp": "2024-11-04T15:30:00Z",
      "environment": "production",
      "status": "success",
      "sha": "xyz789uvw012",
      "notes": "Added auth rate limiting"
    },
    {
      "id": "deploy-787",
      "version": "2.1.0",
      "timestamp": "2024-11-03T10:15:00Z",
      "environment": "production",
      "status": "failed",
      "sha": "old789sha123",
      "notes": "Reverted due to auth middleware issue"
    }
  ]
}
```

**Use Cases:**
- Checking if recent deployments introduced errors
- Comparing error patterns before/after deployment
- Finding when errors started appearing
- Identifying failed deployments

### get-version(version, environment)

**Purpose:** Get error details specific to a deployed version in an environment.

**Parameters:**
- `version` (string, required): Version string or git SHA
- `environment` (string, required): Environment name (e.g., "production", "staging")

**Returns:** Version-specific error data including:
- Errors occurring in this version
- Occurrence count per error type
- First and last occurrence timestamps
- Error severity levels

**Example:**
```
Tool Call: get-version("2.1.0", "production")

Response:
{
  "version": "2.1.0",
  "environment": "production",
  "errors": [
    {
      "id": 45678,
      "title": "AuthenticationError: JWT token expired",
      "occurrences": 342,
      "firstOccurrence": "2024-11-03T10:30:00Z",
      "lastOccurrence": "2024-11-05T14:32:00Z",
      "level": "critical"
    },
    {
      "id": 45679,
      "title": "DatabaseConnectionError: Connection timeout",
      "occurrences": 89,
      "firstOccurrence": "2024-11-03T11:00:00Z",
      "lastOccurrence": "2024-11-05T13:15:00Z",
      "level": "error"
    }
  ]
}
```

**Use Cases:**
- Analyzing errors introduced in specific deployments
- Comparing error rates between versions
- Identifying version-specific issues
- Decision-making for version rollbacks

## Authentication & Configuration

### ROLLBAR_ACCESS_TOKEN Environment Variable

The MCP server requires a Rollbar project access token with read scope:

**Token Requirements:**
- Type: Project Access Token (not personal account token)
- Scope: `read` (minimum) or `read:write` (if using update-item tool)
- Environment: Set as `ROLLBAR_ACCESS_TOKEN` environment variable
- Never commit to version control

**How to Obtain Token:**

1. Log in to Rollbar dashboard
2. Navigate to Project Settings → Project Access Tokens
3. Click "Create New Token"
4. Select scope: "Read" (for investigation) or "Read and Write" (for status updates)
5. Copy token and set as environment variable:
   ```bash
   export ROLLBAR_ACCESS_TOKEN="<your_token_here>"
   ```

**Token Scope Guidance:**
- **Read scope:** Investigation, error analysis, viewing stack traces
- **Read:Write scope:** Investigation + updating error status, assignments, resolving errors

### Configuration Verification

The MCP server is pre-configured in `opencode.work.json`:

```json
{
  "mcpServers": {
    "rollbar": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@rollbar/mcp-server@latest"
      ],
      "env": {
        "ROLLBAR_ACCESS_TOKEN": "<your_token>"
      }
    }
  }
}
```

**Verification:**
- Token must be set in environment before MCP server starts
- Work machine only (personal machine configuration doesn't include Rollbar MCP)

## Workflow Patterns

### Pattern 1: User Reports Production Error

```
USER: "Critical authentication errors in production - investigate"

PM: I'll check for critical errors in production.
    [Executes: get-top-items("production")]

PM: Found critical error (ID: 45678): "AuthenticationError: JWT expired"
    - 342 occurrences in last 24 hours
    - Last occurrence: 2024-11-05 14:32 UTC
    
    This is a critical issue. Delegating to @research-specialist for
    root cause analysis and recommendations.

RESEARCH SPECIALIST: [Receives delegation with item ID 45678]
                     [Executes: get-item-details(45678)]
                     
    Analyzes:
    - Stack trace shows error in src/middleware/auth.ts line 42
    - Issue: jwt.verify() failing with expired tokens
    - Affected version: 2.1.0
    - Started after deployment on 2024-11-03
    
    [Executes: get-deployments(5)]
    
    Finds: Version 2.1.0 deployed 2024-11-03 with auth changes
    Previous version 2.0.9 had no JWT issues
    
    [Stores findings in memory]
    remory add "Rollbar item 45678: AuthenticationError JWT token
    expired in production. 342 occurrences. Root cause: jwt.verify()
    validation logic changed in 2.1.0 deployment. Issue started
    immediately after 2024-11-03 deployment. Stack trace points to
    src/middleware/auth.ts:42. Recommendation: Review JWT expiration
    handling in 2.1.0 changes, increase token TTL or implement refresh
    mechanism. Urgent: affects 100% of JWT-authenticated requests."
    --user-id "$PROJECT_ID" --infer false
    
    [Returns to PM]

PM: Receives detailed analysis:
    Root cause identified: JWT expiration logic in 2.1.0
    Impact: All JWT-authenticated requests affected
    Recommendation: Fix token refresh mechanism or extend TTL
    
    Reports to user with actionable next steps
```

### Pattern 2: Deployment-Related Error Investigation

```
USER: "Check if recent deployment caused errors"

PM: I'll check recent deployments and error patterns.
    [Executes: get-deployments(3)]
    
    Shows:
    - 2024-11-05 12:00 UTC: Version 2.1.2 (success)
    - 2024-11-04 15:30 UTC: Version 2.1.1 (success)
    - 2024-11-03 10:15 UTC: Version 2.1.0 (failed initially)

PM: [Executes: get-version("2.1.2", "production")]
    [Executes: get-version("2.1.1", "production")]
    
    Compares error rates:
    - 2.1.2: 15 new errors (minor)
    - 2.1.1: 89 errors (moderate)
    
    2.1.2 appears to have reduced errors from 2.1.1.
    
    Provides summary: Recent deployment (2.1.2) improved error rate.
    No critical issues detected from latest deployment.
```

### Pattern 3: Recurring Error Analysis

```
USER: "Analyze recurring auth errors over time"

PM: [Executes: get-top-items("production")]
    
    Identifies: AuthenticationError consistently in top 3 errors
    
    [Delegates to @research-specialist]
    "Investigate recurring AuthenticationError (#45678) pattern:
    is it getting worse, stable, or improving?"

RESEARCH: [Uses get-item-details(45678) with max_tokens=50000]
          [Analyzes: Error occurrence timeline, affected users]
          [Checks: get-version across multiple deployments]
          
          Determines: Error rate stable at ~10 occurrences/hour
          Pattern: Peaks during high-traffic periods
          Root cause: Resource exhaustion under load
          
          [Stores comprehensive analysis in memory]
          Returns: Findings with scaling recommendations
```

## Research Specialist Support

**@research-specialist** has full access to all Rollbar MCP tools for detailed error investigation workflows.

### Primary Responsibilities

- Receive error IDs or environment context from PM
- Use MCP tools to gather comprehensive error data
- Analyze stack traces and identify root causes
- Correlate errors with deployments and versions
- Store findings in project memory with `--infer false`
- Return detailed analysis and recommendations to PM

### Investigation Workflow

```
1. Receive delegation from PM with error ID and context

2. Gather error details:
   get-item-details(item_id) - Full stack trace and context

3. Analyze deployment correlation:
   get-deployments(10) - Check if error started after deployment
   get-version(version, environment) - Version-specific error analysis

4. Store findings in memory:
   remory add "Rollbar item [ID]: [title]. Root cause: [analysis].
   Affected versions: [list]. Timeline: [when started]. Impact:
   [severity]. Recommendations: [next steps]."
   --user-id "$PROJECT_ID" --infer false

5. Return to PM with:
   - Clear root cause identification
   - Stack trace walkthrough
   - Affected deployments/versions
   - Impact assessment
   - Recommended fixes or workarounds
   - Urgency level
```

## Additional MCP Tools

### list-items(environment)

**Purpose:** List items filtered by status, environment, and search query.

**Parameters:**
- `environment` (string, required): Environment name
- Optional: status, search query filters

**Use Cases:**
- Finding specific error patterns
- Filtering errors by status (active, resolved, muted)
- Searching for errors by title or message

### update-item(itemId, status?, level?, title?, assignedUserId?, resolvedInVersion?, snoozed?, teamId?)

**Purpose:** Update an item's properties (requires write-scoped token).

**Parameters:**
- `itemId` (required): Rollbar item ID
- `status`: Change status (active/resolved/muted)
- `level`: Change severity (debug/info/warning/error/critical)
- `title`: Update error title
- `assignedUserId`: Assign to team member
- `resolvedInVersion`: Mark resolved in specific version
- `snoozed`: Snooze error notifications
- `teamId`: Assign to team

**Use Cases:**
- Marking errors as resolved after fix deployed
- Updating error severity
- Assigning errors to team members
- Snoozing non-critical errors

**Example:**
```
After fix deployed in version 2.2.0:
update-item(45678, {"status": "resolved", "resolvedInVersion": "2.2.0"})
```

## When to Use REST API Instead

Use the Rollbar REST API directly for:
- Automated monitoring/dashboards requiring programmatic access
- Complex filtering beyond MCP tool capabilities
- CI/CD pipeline integration for deployment tracking
- Custom analysis scripts requiring direct API calls
- Bulk operations on multiple errors

**REST API Examples:**

```bash
# List production errors with custom filters
curl -H "X-Rollbar-Access-Token: $ROLLBAR_TOKEN" \
  "https://api.rollbar.com/api/1/items?environment=production&status=active&level=error"

# Get specific item occurrences
curl -H "X-Rollbar-Access-Token: $ROLLBAR_TOKEN" \
  "https://api.rollbar.com/api/1/item/45678/instances?limit=20"

# Get deployment-specific data
curl -H "X-Rollbar-Access-Token: $ROLLBAR_TOKEN" \
  "https://api.rollbar.com/api/1/projects/1/deploys?environment=production&limit=10"
```

**When to Use Which:**
- **MCP Server:** Interactive investigation, AI-powered analysis, ad-hoc error exploration
- **REST API:** Automated workflows, CI/CD integration, programmatic monitoring

## Security Considerations

### Token Management

- **Read-scoped tokens only** for investigation (no write operations unless required)
- **Work machine only** - Rollbar tokens are production-sensitive data
- **Environment variable storage** - Never commit `ROLLBAR_ACCESS_TOKEN` to version control
- **Minimal exposure** - Tokens only available to MCP server subprocess

### Data Handling

- Stack traces contain sensitive code paths and business logic
- Production error data may include user information or transaction details
- Aggregate findings for reporting (avoid copying raw error details)
- Store findings in memory with context (not raw API responses)

### Subprocess Isolation

- MCP server runs as isolated subprocess (stdio protocol)
- No network exposure beyond Rollbar API
- Error logs contained within MCP server output
- Token passed only to subprocess, not exposed in parent shell

## Comparison: Rollbar MCP Server vs rollbar-cli

These are different tools for different purposes:

### Rollbar MCP Server (Error Investigation)
- **Purpose:** Interactive error investigation and root cause analysis
- **Use:** AI agents querying production errors, detailed stack trace analysis
- **Tools:** get-top-items, get-item-details, get-deployments, get-version
- **Scope:** Reading error data for investigation
- **Integration:** Model Context Protocol stdio

### rollbar-cli (Deployment Automation)
- **Purpose:** Deployment automation, source map uploads, notification triggers
- **Use:** CI/CD pipelines, release workflows, source map management
- **Tools:** Deploy notifications, source maps, project config
- **Scope:** Deployment lifecycle automation
- **Integration:** Command-line tool

**Use Correctly:**
- Rollbar MCP Server: `get-item-details(45678)` for stack trace analysis
- rollbar-cli: `rollbar deploy --version 2.1.0` for deployment notifications

## Error Handling

### Token Authentication Failures

```
Error: "Invalid or missing ROLLBAR_ACCESS_TOKEN"

Troubleshooting:
1. Verify token is set: echo $ROLLBAR_ACCESS_TOKEN
2. Verify token scope has read access
3. Verify token hasn't been revoked in Rollbar dashboard
4. Check token format (should not have quotes)

Solution: Obtain new token from Rollbar Project Settings → Access Tokens
```

### Item Not Found

```
Error: "Item ID 45678 not found"

Troubleshooting:
1. Verify item ID is correct (use get-top-items first)
2. Verify environment matches where error occurred
3. Item may be archived or deleted
4. Check if error existed in specified environment

Solution: Get correct item ID from get-top-items("environment")
```

### Rate Limiting

```
Error: "Rate limit exceeded - too many requests"

Details: Rollbar API has rate limits (typically 600 requests/minute)

Solutions:
1. Wait 60 seconds before retrying
2. Batch queries efficiently (use single get-item-details call, not multiple)
3. Use max_tokens parameter to limit response size
4. Report to PM if rate limits are consistently hit

Note: Normal investigation usage rarely hits rate limits
```

### Work Machine Only Error

On personal machine:
```
PM Response: "Rollbar MCP Server is only available on work machine.
I cannot investigate production errors from this environment.
Please use the work machine for error investigation,
or provide error details directly without Rollbar integration."
```

## Cross-Agent Communication Patterns

### PM → Research Specialist

```
PM delegates: "Investigate Rollbar item #45678 for root cause analysis.
Use MCP tools to get stack trace, correlate with deployments,
and provide recommendations."

Research uses: get-item-details(45678) + get-deployments(5) + get-version()
Research stores: Comprehensive findings in remory with analysis
Research returns: Root cause, impact assessment, recommendations
```

### PM → Git Autonomous Agent

```
PM delegates: "User reported critical error #45678. After fix deployed
in version 2.2.0, mark the error as resolved."

Git agent: Uses update-item(45678, {"status": "resolved", 
          "resolvedInVersion": "2.2.0"})
Git agent: Confirms resolution in Rollbar
```

### Specialist → PM (Error Report)

```
Specialist: Completes investigation of error #45678
Specialist reports: "Root cause identified: JWT validation change
in 2.1.0. Impact: 342 occurrences. Severity: critical.
Recommendation: Revert JWT logic or extend token TTL."

PM: Coordinates fix implementation and reports to user
```

## Tools Summary

### Project Manager Can Use Directly

- `get-top-items(environment)` - Quick assessment of critical errors
- `get-item-details(item_id)` - Get error context before delegation
- `get-deployments(limit)` - Check deployment history
- `get-version(version, environment)` - Verify version-specific errors

### Project Manager Must Delegate

- Complex root cause analysis → @research-specialist
- Detailed stack trace interpretation → @research-specialist
- Multi-factor error correlation → @research-specialist
- Error status updates → @git-agent (if write scope available)

### Research Specialist Can Use

- All MCP tools directly
- `get-item-details(item_id, max_tokens?)` - Full analysis capability
- `get-deployments(limit)` - Deployment correlation
- `get-version(version, environment)` - Version analysis
- `list-items(environment)` - Error filtering and pattern discovery

### Git Autonomous Agent Can Use

- `get-item-details(item_id)` - Verify error details
- `update-item(itemId, ...)` - Update status after fix (requires write scope)
- `get-deployments(limit)` - Verify deployment context

## Remember

1. **Rollbar MCP only on work machine** - This instruction not loaded on personal config
2. **PM gathers context first** - Use get-top-items before delegating investigation
3. **Research specialist does analysis** - Complex interpretation of stack traces and patterns
4. **Store findings in memory** - Use remory with `--infer false` for comprehensive context
5. **Token security** - ROLLBAR_ACCESS_TOKEN is production-sensitive, never commit
6. **Clear separation** - PM orchestrates, research performs analysis, git-agent manages item status

This integration enables AI-powered error investigation directly in your development workflow, reducing time spent in manual error triage and accelerating root cause analysis.

