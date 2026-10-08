# Secrets Management & Environment Convention
**Owner: Zainy TNS (Module 3)**

### 1. Core Principles
1. **Never Commit Secrets**: Any `.env` or plain-text credential file is strictly prohibited in git commits.
2. **Standard Templates**: Every service must maintain a checked-in `.env.example` defining every required key.
3. **Automated Auditing**: Every CI run performs a `gitleaks` scan to catch accidental token leakage.

### 2. Environment Naming Hierarchy
| Environment | Location | Injection Mechanism |
|---|---|---|
| Local Dev | `.env` (git-ignored) | Docker Compose or dotenv runtime |
| CI Pipeline | GitHub Actions Secrets | Secret variables injected into runner step |
| Production VM | `/etc/environment` or Docker secrets | Injected securely via SSH deployment |

### 3. Required Keys per Service
- **Database**: `DATABASE_URL`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- **Auth & JWT**: `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`
- **Service URLs**: `GATEWAY_PORT`, `AUTH_SERVICE_URL`, `BOOKING_SERVICE_URL`, `ROUTING_SERVICE_URL`
