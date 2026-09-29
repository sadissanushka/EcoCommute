# Spatial & PostGIS Integration Conventions
### Team Integration Guide — PostGIS SRID 4326 & Coordinate Standards
**Author:** Amaraweera MTP (244015X)  
**Applicability:** Modules 1, 2, 3, 4, 5

---

## 1. Spatial Reference System Identifier (SRID)
- **Standard:** **`EPSG:4326`** (WGS 84 ellipsoidal coordinate system).
- All database columns storing coordinates MUST be explicitly typed as:
  ```sql
  geom GEOMETRY(Point, 4326) NOT NULL
  geom GEOMETRY(LineString, 4326) NOT NULL
  geom GEOMETRY(Polygon, 4326) NOT NULL
  ```

---

## 2. Coordinate Order Specification

### PostGIS & GeoJSON Standard: (Longitude, Latitude)
In PostGIS, GIS tools, and GeoJSON (RFC 7946), coordinates follow the cartesian mathematical convention:
- **Axis 1 (X): Longitude (`lng`)** — Sri Lanka ranges roughly `[79.5°, 81.9°E]`
- **Axis 2 (Y): Latitude (`lat`)** — Sri Lanka ranges roughly `[5.9°, 9.9°N]`

> [!CAUTION]
> **PostGIS `ST_MakePoint` takes (X, Y) = (Longitude, Latitude)!**  
> `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)`  
> Passing latitude first will invert coordinates into the Indian Ocean or Antarctica.

### REST & WebSocket JSON Payloads: Explicit Named Keys or GeoJSON
To prevent human error across web/mobile clients:
1. **Explicit object notation (Recommended for APIs):**
   ```json
   {
     "lat": 6.9042,
     "lng": 79.9547,
     "accuracy": 4.5,
     "heading": 180.0,
     "speed": 12.3
   }
   ```
2. **Standard GeoJSON Feature / Geometry (For GIS layers):**
   ```json
   {
     "type": "Point",
     "coordinates": [79.9547, 6.9042]
   }
   ```
   *Note: In `coordinates: [x, y]`, the first number is ALWAYS longitude.*

---

## 3. Distance Computations: Spheroid vs Equirectangular

1. **Database PostGIS queries:**
   Cast geometry to `geography` when measuring real-world distances in meters:
   ```sql
   ST_Distance(geom1::geography, geom2::geography) -- returns distance in meters
   ST_DWithin(geom1::geography, geom2::geography, 250) -- index-assisted proximity check
   ```

2. **In-Memory Real-time WebSocket calculations (Anomaly Detector):**
   To avoid database roundtrips on every 1 Hz GPS tick, compute Haversine or Equirectangular projection in memory:
   $$\Delta x = (\lambda_2 - \lambda_1) \cdot \cos\left(\frac{\phi_1 + \phi_2}{2}\right) \cdot \frac{\pi R}{180}$$
   $$\Delta y = (\phi_2 - \phi_1) \cdot \frac{\pi R}{180}$$
   $$d = \sqrt{\Delta x^2 + \Delta y^2}$$
   Where $R = 6,371,000 \text{ m}$. For sub-5km distances in Sri Lanka, equirectangular approximation introduces less than 0.1% error and runs in nanoseconds.

---

## 4. Indexing Standard
All spatial tables MUST include a GIST index:
```sql
CREATE INDEX idx_<table>_<column> ON <table> USING GIST(<column>);
```
For composite filtering (e.g. querying a trip's points over time), maintain a secondary B-Tree composite index `(trip_id, recorded_at DESC)`.
