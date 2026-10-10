# Corporate Employee Shuttle Platform — Module 1
## Ride Matching & Custom Navigation Engine

This module implements the custom navigation and ride-matching engine for the Corporate Employee Shuttle Platform (Module 1).

### Implemented Architecture (Phase 0)

```
OSM PBF Extract (Sri Lanka)
         │
         │  (scripts/download_osm.py & scripts/osm_to_postgis.py)
         ▼
PostgreSQL 16 + PostGIS 3.4 (Docker)
  ├── road_nodes (Point geometries + GiST spatial index)
  ├── road_edges (LineString geometries + distance/speed/oneway tags)
  ├── ride_offers & ride_requests
  └── matches
         │
         ▼
Routing Engine Service (Node.js + TypeScript / Express)
  ├── services/routing-engine/src/graph/    (PostGIS loader, in-memory graph, KNN snapper)
  ├── services/routing-engine/src/routing/  (MinPriorityQueue, Haversine, Dijkstra pathfinder)
  ├── services/routing-engine/src/api/      (REST endpoints: /health, /route)
  └── services/routing-engine/src/matching/ (Route overlap matcher & detour calculator)
```

---

### Getting Started

#### 1. Start Database and Infrastructure
```bash
docker compose up -d postgis
```

#### 2. Download OpenStreetMap Sri Lanka Extract
```bash
python scripts/download_osm.py
```

#### 3. Parse OSM and Ingest into PostGIS
```bash
# Ingest entire extract or pass a segment limit for quick testing
python scripts/osm_to_postgis.py data/sri-lanka-latest.osm.pbf [limit]
```

#### 4. Run Routing Engine (Local Development)
```bash
cd services/routing-engine
npm install
npm run dev
```

#### 5. Run Unit & Integration Tests
```bash
cd services/routing-engine
npm test
```

#### 6. Run Entire Stack in Docker
```bash
docker compose up -d --build
```
