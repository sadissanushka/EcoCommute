# EcoCommute — Corporate Employee Shuttle & Carpool Platform

**Group 05 ("Stack Kings")** — Full-stack microservices platform for corporate shuttle fleet booking, custom OSM-based carpool navigation, double-entry fare & carbon accounting, real-time route deviation safety, and privacy-preserving municipal analytics.

---

## 1. Team & Module Architecture

| Module | Scope | Lead | Service / App | Port |
| :--- | :--- | :--- | :--- | :--- |
| **Module 1** | **Ride Matching & Custom Navigation Engine** (Dijkstra, A\*, Bidirectional A\*, NN + 2-opt, Route-Overlap Matcher, Self-Hosted Tiles) | Thisera W.S.S.A. (`244208R`) | `services/routing-engine`, `infra/tiles` | `3000` |
| **Module 2** | **Fleet & Shuttle Booking + Auth & API Gateway** (JWT/RBAC, `FOR UPDATE` seat locks, Idempotency, Hidden Bookings) | Chamara W.P.R. (`234250D`) | `services/auth`, `services/booking`, `services/gateway`, `apps/shuttle-admin` | `3001`, `3002`, `8080` |
| **Module 3** | **Wallet & Carbon Accounting** (Double-entry append-only LKR-cents ledger, DEFRA 2024 GHG, Marginal Detour Fair-Split, DB Migrations) | Zainy T.N.S. (`244236B`) | `services/wallet`, `infra/migrations`, `apps/mobile` | `8083` (`3003` local) |
| **Module 4** | **Safety Layer & Real-Time Telematics** (WebSocket GPS rooms, Haversine route-deviation ladder, Manual/Auto SOS, Corporate OTP, Nginx TLS) | Amaraweera M.T.P. (`244015X`) | `services/safety`, `infra/nginx` | `4400` |
| **Module 5** | **Admin & Government Dashboards + Privacy Engine** (ETL, Materialized Views, $k$-Anonymity, Laplace $\varepsilon$-DP, Privacy Budget Ledger) | Kulapputhanthri A.J. (`244108K`) | `services/analytics`, `apps/dashboards` | `8085`, `3005` |
| **Web Client** | **Unified Commuter Web Portal** (Map Studio, Ride Matching, Shuttle Booking, My Bookings, Wallet, Live Tracking, SOS) | Shared (`apps/commuter-web`) | `apps/commuter-web` | `5173` |

---

## 2. System Overview

```text
  Commuter Web (:5173) / Mobile App / Executive Dashboards (:3005)
                                │
                    Nginx TLS Reverse Proxy (:80 / :443)
                      ├── /api/   ──► API Gateway (:8080) ──► Auth (:3001), Booking (:3002),
                      │                                       Routing (:3000), Wallet (:8083),
                      │                                       Safety (:4400), Analytics (:8085)
                      ├── /ws     ──► Safety WebSocket Server (:4400)
                      └── /tiles/ ──► Self-Hosted Tileserver-GL (:8088, Planetiler MBTiles)
                                │
                                ▼
             PostgreSQL 16 + PostGIS 3.4 (:5432 / corporate_shuttle)
     Schemas: core | auth | booking | routing (public) | wallet | safety | analytics
```

---

## 3. Module 1 Highlights (Routing & Matching Engine)

- **Hand-Written Pathfinding (`services/routing-engine/src/routing/`):**
  - `dijkstra.ts` — Shortest distance and fastest travel-time search respecting `is_oneway` edges.
  - `astar.ts` — Admissible Haversine heuristic search ($f(n) = g(n) + h(n)$).
  - `bidirectional.ts` — Simultaneous forward/backward search with consistent symmetric potentials (`algorithm: "bidirectional"`).
- **Ordered Multi-Waypoint Cost Oracle (`POST /route`):** Supports optional `waypoints[]` with leg-by-leg distance/ETA breakdown for Module 3 Fair-Split calculations.
- **Multi-Stop Ordering & Carpool Matching (`services/routing-engine/src/matching/`):**
  - `multiStop.ts` — Nearest-Neighbour construction + 2-opt local search using the road-graph A\* cost oracle.
  - `matcher.ts` — Detour-bounded (2,500 m) route-overlap scoring, `womenOnly` preference sync (`safety.safety_preferences`), global greedy capacity assignment, home-coordinate privacy masking on `GET /rides`, and `POST /matches/confirm` publishing planned `LINESTRING` corridors into `safety.route_boundaries`.
- **Self-Hosted Vector Tiles (`infra/tiles/`):** Planetiler Sri Lanka `.osm.pbf` $\rightarrow$ `sri-lanka.mbtiles` build script + `tileserver-gl` Docker profile (`tiles`).

---

## 4. Getting Started

### 1. Start Database & Entire Stack with Docker Compose
```bash
docker compose up -d --build
```
*(Optional)* To also build and serve self-hosted Sri Lanka vector tiles:
```bash
./infra/tiles/build-tiles.sh
docker compose --profile tiles up -d tileserver
```

### 2. Run Versioned Database Migrations
```bash
cd infra/migrations
npm install
npm run migrate:up
```

### 3. Populate Sri Lanka OSM Road Graph (Optional Full Extract)
```bash
python scripts/download_osm.py
python scripts/osm_to_postgis.py data/sri-lanka-latest.osm.pbf [limit]
```

### 4. Local Development (Routing Engine & Commuter Web)
```bash
# Routing Engine (:3000)
cd services/routing-engine
npm install
npm run dev

# Commuter Web (:5173)
cd apps/commuter-web
npm install
npm run dev
```

---

## 5. Verification & Benchmarks

```bash
# Module 1: Routing & Matching Engine (35 unit & API tests)
cd services/routing-engine && npm test

# Module 1: Concurrent /route load benchmark
cd services/routing-engine && npx tsx scripts/loadTestRoute.ts

# Module 2: Booking Service (17 unit & visibility tests)
cd services/booking && npm test

# Module 2: Auth Service
cd services/auth && npm test

# Commuter Web Production Build
cd apps/commuter-web && npm run build
```

---

## 6. Key Documentation
- [`Plan/Team_Integration_Guide_Stack_Kings.md`](Plan/Team_Integration_Guide_Stack_Kings.md) — Cross-module contracts (C1–C11) & shared DB conventions
- [`Plan/EcoCommute_Master_Demo_Presentation_Guide.md`](Plan/EcoCommute_Master_Demo_Presentation_Guide.md) — End-to-end system demo walkthrough
- [`docs/openapi/openapi.yaml`](docs/openapi/openapi.yaml) — Unified OpenAPI 3.1 specification
