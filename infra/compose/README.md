# Local Docker Compose Environment (Module 2)
**Owner: Chamara WPR (234250D)**

This directory contains the multi-container configuration for the Corporate Employee Shuttle Platform.

### Services Included
- **PostGIS 16**: Port 5432, auto-initializes with `docker/initdb.sql` and `docker/seed.sql`.
- **API Gateway**: Port 8080, reverse proxy with rate limiting, correlation IDs, and standard error envelopes.
- **Auth Service**: Port 3001, handles user registration, JWT generation, and RBAC.
- **Booking Service**: Port 3002, handles fleet schedules, search, seat allocation, and cancellations.
- **Routing Engine**: Port 3000, handles graph navigation and Dijkstra path calculations.
- **pgAdmin (Optional)**: Profile `tools`, port 5050.

### Usage
Run from root:
```bash
docker compose up --build
```
Or with pgAdmin:
```bash
docker compose --profile tools up
```
