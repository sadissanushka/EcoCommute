# PostGIS Spatial Query Plans & Performance Benchmarks
### Module 4: Safety Layer + Real-time Tracking & Anomaly Detection
**Author:** Amaraweera MTP (244015X)  
**Target:** PostGIS 16-3.4 on PostgreSQL 16 (SRID 4326)

---

## 1. Overview
The real-time safety layer processes high-frequency GPS position reports from active drivers and riders, validates proximity to planned trip route boundaries, detects deviations/stalls, and facilitates emergency SOS routing. 

To ensure sub-10ms response times under load, spatial queries rely on dual spatial indexing:
- **`GIST(geom)`**: R-Tree index for spatial envelope comparisons (`ST_DWithin`, bounding box `&&`, and KNN `<->` distance operators).
- **B-Tree Compound `(trip_id, recorded_at DESC)`**: Chronological index for fetching latest telemetry without scanning unrelated trips.

---

## 2. Benchmark Query 1: Latest Telemetry Point per Active Trip
Retrieve the most recent GPS fix for a given active trip room (used upon client reconnection to rehydrate UI map state).

### SQL Statement
```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT 
  id,
  trip_id,
  user_id,
  ST_X(geom) AS lng,
  ST_Y(geom) AS lat,
  speed_mps,
  heading,
  accuracy_m,
  recorded_at
FROM safety.tracking_points
WHERE trip_id = 1
ORDER BY recorded_at DESC
LIMIT 1;
```

### Execution Plan
```text
Limit  (cost=0.29..2.51 rows=1 width=56) (actual time=0.042..0.043 rows=1 loops=1)
  Buffers: shared hit=3
  ->  Index Scan using idx_tracking_points_trip_time on tracking_points  (cost=0.29..44.80 rows=20 width=56) (actual time=0.040..0.041 rows=1 loops=1)
        Index Cond: (trip_id = 1)
        Buffers: shared hit=3
Planning Time: 0.118 ms
Execution Time: 0.065 ms
```

### Analysis
- Utilizes the compound B-Tree index `idx_tracking_points_trip_time`.
- Direct index scan executes in **0.065 ms** with only **3 shared buffer hits**, avoiding table sequential scans.

---

## 3. Benchmark Query 2: Nearest Route Lookup & Distance Computation
Calculate the minimum orthogonal distance from an incoming GPS point to the planned corridor polyline `safety.route_boundaries.geom` for deviation validation.

### SQL Statement
```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT 
  rb.trip_id,
  rb.mild_threshold_m,
  rb.severe_threshold_m,
  ST_Distance(
    rb.geom::geography, 
    ST_SetSRID(ST_MakePoint(79.9412, 6.9015), 4326)::geography
  ) AS distance_meters,
  ST_LineLocatePoint(
    rb.geom, 
    ST_SetSRID(ST_MakePoint(79.9412, 6.9015), 4326)
  ) AS route_fraction
FROM safety.route_boundaries rb
WHERE rb.trip_id = 1;
```

### Execution Plan
```text
Index Scan using route_boundaries_pkey on route_boundaries rb  (cost=0.15..8.17 rows=1 width=48) (actual time=0.082..0.085 rows=1 loops=1)
  Index Cond: (trip_id = 1)
  Buffers: shared hit=2
Planning Time: 0.142 ms
Execution Time: 0.108 ms
```

### Analysis
- Primary key lookup resolves in **0.108 ms**.
- Geography distance calculation (`ST_Distance(geog, geog)`) accounts for ellipsoidal curvature (WGS 84), providing sub-meter precision to validate the 250m mild and 1000m severe deviation thresholds.

---

## 4. Benchmark Query 3: Bounding-Box Spatial Window Query
Retrieve all tracking points occurring within a rectangular viewport or geographic polygon bounding box (used by operator dispatch map view).

### SQL Statement
```sql
EXPLAIN (ANALYZE, BUFFERS, COSTS)
SELECT 
  id,
  trip_id,
  user_id,
  ST_AsGeoJSON(geom)::jsonb AS geojson,
  speed_mps,
  recorded_at
FROM safety.tracking_points
WHERE geom && ST_MakeEnvelope(79.8400, 6.8900, 79.9600, 6.9400, 4326)
  AND recorded_at >= now() - interval '1 hour'
ORDER BY recorded_at DESC;
```

### Execution Plan
```text
Sort  (cost=12.45..12.50 rows=20 width=64) (actual time=0.125..0.128 rows=3 loops=1)
  Sort Key: recorded_at DESC
  Sort Method: quicksort  Memory: 25kB
  Buffers: shared hit=4
  ->  Bitmap Heap Scan on tracking_points  (cost=4.20..11.85 rows=20 width=64) (actual time=0.055..0.060 rows=3 loops=1)
        Recheck Cond: (geom && '0103000020E61000000100000005000000...'::geometry)
        Filter: (recorded_at >= (now() - '01:00:00'::interval))
        Buffers: shared hit=4
        ->  Bitmap Index Scan on idx_tracking_points_geom  (cost=0.00..4.19 rows=20 width=0) (actual time=0.042..0.042 rows=3 loops=1)
              Index Cond: (geom && '0103000020E61000000100000005000000...'::geometry)
              Buffers: shared hit=2
Planning Time: 0.165 ms
Execution Time: 0.155 ms
```

### Analysis
- Spatial GIST index `idx_tracking_points_geom` prunes candidates rapidly using bounding box intersection (`&&`).
- Bitmap index scan executes in **0.155 ms**, ensuring rapid viewport rendering under heavy spatial data density.
