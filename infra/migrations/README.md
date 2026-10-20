# Versioned Database Migrations (Module 3)
**Owner: Zainy TNS (244236B)**

This engine manages versioned migrations across all schemas: `core`, `wallet`, `booking`, `routing`, `safety`, `analytics`.

### Rules
1. **Never edit a merged migration**: Always create a new sequential migration.
2. Naming convention: `YYYYMMDDHHmm__<schema>__<desc>.sql`.

### Commands
```bash
# Apply pending migrations
npm run migrate:up

# Revert last migration
npm run migrate:down

# Check migration status
npm run migrate:status

# Create a new migration file
npm run migrate:create <schema> <description>
```
