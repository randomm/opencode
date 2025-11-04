# PostgreSQL MCP Databases

Production PostgreSQL databases accessed via Model Context Protocol for read-only queries.

## Databases

### Fuzu Production Database

**MCP Tool Name:** `fuzu-production-db`

Access the Fuzu production database for schema inspection, debugging, and analytics queries.

- **Type:** Read-only (credentials enforce this)
- **Connection:** Docker-based MCP server with PostgreSQL driver
- **Environment Variable:** `FUZU_PRODUCTION_DB_RO`

**Usage in Prompts:**
```
Use fuzu-production-db to query user account history
Use fuzu-production-db to check payment transaction tables
```

### Barona Production Database

**MCP Tool Name:** `barona-production-db`

Access the Barona production database for cross-system queries and diagnostics.

- **Type:** Read-only (credentials enforce this)
- **Connection:** Docker-based MCP server with PostgreSQL driver
- **Environment Variable:** `BARONA_PRODUCTION_DB_RO`

**Usage in Prompts:**
```
Use barona-production-db to examine order records
Use barona-production-db to investigate schema structure
```

## Safety Guidelines

### Read-Only Enforcement

Both databases use read-only credentials enforced at the database user level. All write operations (`INSERT`, `UPDATE`, `DELETE`, `DROP`) are blocked by PostgreSQL permissions.

**Critical:** Never attempt write operations. The database will reject them with permission errors.

### Production Data Sensitivity

Both databases contain live production data. Handle with care:
- **No PII extraction** - Don't copy sensitive customer data into conversations
- **Aggregate results** - Use `COUNT()`, `SUM()`, averages instead of individual records
- **Avoid full table scans** - Use `LIMIT` and specific `WHERE` clauses
- **No expensive queries** - Avoid `SELECT *` or unindexed scans on large tables

### Query Patterns

**Good:**
```sql
-- Fast, indexed lookup
SELECT COUNT(*) FROM users WHERE status = 'active';

-- Aggregation, minimal data
SELECT DATE(created_at), COUNT(*) FROM transactions GROUP BY DATE(created_at);

-- Specific subset
SELECT id, name FROM products LIMIT 100;
```

**Bad:**
```sql
-- Full table scan
SELECT * FROM large_transaction_table;

-- Expensive join without limit
SELECT * FROM orders o JOIN items i ON o.id = i.order_id;

-- Complex analytical query during investigation
SELECT ... expensive analysis ... FROM massive_table;
```

## Agent Access

**Primary User:**
- `@postgres-specialist` - Full access for database investigation, query optimization, and schema analysis

**Secondary Users:**
- `@research-specialist` - Can use for investigation tasks (read-only operations only)

**Restricted:**
- `@project-manager` - No access to MCP database tools
- All other agents - No access

## Configuration

Both databases are configured as MCP servers in `opencode.work.json` under the `mcp` section:

```json
"fuzu-production-db": {
  "type": "local",
  "command": ["docker", "run", "-i", "--rm", "mcp/postgres", "{env:FUZU_PRODUCTION_DB_RO}"],
  "enabled": true
},
"barona-production-db": {
  "type": "local",
  "command": ["docker", "run", "-i", "--rm", "mcp/postgres", "{env:BARONA_PRODUCTION_DB_RO}"],
  "enabled": true
}
```

Both require the respective environment variables (`FUZU_PRODUCTION_DB_RO` and `BARONA_PRODUCTION_DB_RO`) to be set with read-only PostgreSQL connection strings.
