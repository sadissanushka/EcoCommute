-- Migration: 202610011200__analytics__create_analytics_schema.sql
-- Schema: analytics
-- Description: Analytics fact tables, spatial zones, materialized views, and privacy budget ledger

-- >>> UP >>>
CREATE SCHEMA IF NOT EXISTS analytics;

-- 1. Spatial Zones Table (Colombo / Western Province Grid)
CREATE TABLE IF NOT EXISTS analytics.zones (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  geom GEOMETRY(Polygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_zones_geom ON analytics.zones USING GIST(geom);

-- 2. Fact Trips Table (One row per completed trip loaded via ETL)
CREATE TABLE IF NOT EXISTS analytics.fact_trips (
  trip_id BIGINT PRIMARY KEY,
  company_id BIGINT NOT NULL,
  department TEXT NOT NULL DEFAULT 'Operations',
  kind TEXT NOT NULL CHECK (kind IN ('carpool', 'shuttle', 'solo')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  distance_km REAL NOT NULL CHECK (distance_km >= 0),
  occupancy REAL NOT NULL DEFAULT 1.0 CHECK (occupancy >= 1.0),
  seats_offered INT NOT NULL DEFAULT 1,
  seats_used INT NOT NULL DEFAULT 1,
  fuel_reimbursed_minor BIGINT NOT NULL DEFAULT 0,
  co2_kg REAL NOT NULL DEFAULT 0.0,
  co2_avoided_kg REAL NOT NULL DEFAULT 0.0,
  origin_zone_id INT REFERENCES analytics.zones(id) ON DELETE SET NULL,
  dest_zone_id INT REFERENCES analytics.zones(id) ON DELETE SET NULL,
  loaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fact_trips_company_time ON analytics.fact_trips (company_id, started_at);
CREATE INDEX IF NOT EXISTS idx_fact_trips_company_dept ON analytics.fact_trips (company_id, department);
CREATE INDEX IF NOT EXISTS idx_fact_trips_zones ON analytics.fact_trips (origin_zone_id, dest_zone_id, started_at);

-- 3. ETL Watermarks & Monitoring
CREATE TABLE IF NOT EXISTS analytics.etl_watermarks (
  source TEXT PRIMARY KEY,
  last_loaded_at TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01 00:00:00+00',
  records_processed BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analytics.etl_issues (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  record_identifier TEXT,
  issue_type TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Differential Privacy Budget Ledger & Company Consent
CREATE TABLE IF NOT EXISTS analytics.privacy_budget_ledger (
  id BIGSERIAL PRIMARY KEY,
  principal_id TEXT NOT NULL,              -- policymaker or API key ID
  dataset TEXT NOT NULL,                  -- 'colombo_commute_flows'
  epsilon_spent REAL NOT NULL CHECK (epsilon_spent > 0),
  query_hash TEXT NOT NULL,
  cached_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_principal ON analytics.privacy_budget_ledger (principal_id, dataset);
CREATE INDEX IF NOT EXISTS idx_budget_query_hash ON analytics.privacy_budget_ledger (query_hash);

CREATE TABLE IF NOT EXISTS analytics.company_consent (
  company_id BIGINT PRIMARY KEY,
  shared_for_urban_planning BOOLEAN NOT NULL DEFAULT true,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Materialized Views for High-Speed Dashboards (<200ms query latency)

-- MV 1: Trips and riders aggregated by department and day
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_trips_by_department_day AS
SELECT
  company_id,
  department,
  (started_at AT TIME ZONE 'Asia/Colombo')::DATE AS day,
  COUNT(*)::INT AS total_trips,
  SUM(seats_used)::INT AS total_riders,
  ROUND(SUM(distance_km)::numeric, 2)::REAL AS total_distance_km,
  ROUND(SUM(co2_avoided_kg)::numeric, 2)::REAL AS total_co2_avoided_kg
FROM analytics.fact_trips
GROUP BY company_id, department, (started_at AT TIME ZONE 'Asia/Colombo')::DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_trips_dept_day_pk 
ON analytics.mv_trips_by_department_day (company_id, department, day);

-- MV 2: Average occupancy and seat utilisation by route/kind and day
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_occupancy_by_route_day AS
SELECT
  company_id,
  kind,
  (started_at AT TIME ZONE 'Asia/Colombo')::DATE AS day,
  COUNT(*)::INT AS trip_count,
  ROUND(AVG(occupancy)::numeric, 2)::REAL AS avg_occupancy,
  ROUND((SUM(seats_used)::numeric / NULLIF(SUM(seats_offered), 0) * 100)::numeric, 2)::REAL AS seat_utilisation_pct
FROM analytics.fact_trips
GROUP BY company_id, kind, (started_at AT TIME ZONE 'Asia/Colombo')::DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_occupancy_day_pk 
ON analytics.mv_occupancy_by_route_day (company_id, kind, day);

-- MV 3: Monthly fuel reimbursement by department
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_fuel_reimbursed_month AS
SELECT
  company_id,
  department,
  to_char(started_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM') AS month_bucket,
  SUM(fuel_reimbursed_minor)::BIGINT AS total_fuel_reimbursed_minor,
  ROUND((SUM(fuel_reimbursed_minor) / 100.0)::numeric, 2)::REAL AS total_fuel_reimbursed_lkr
FROM analytics.fact_trips
GROUP BY company_id, department, to_char(started_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_fuel_month_pk 
ON analytics.mv_fuel_reimbursed_month (company_id, department, month_bucket);

-- MV 4: Monthly corporate ESG Carbon footprint and savings
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_co2_by_company_month AS
SELECT
  company_id,
  to_char(started_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM') AS month_bucket,
  ROUND(SUM(co2_kg)::numeric, 2)::REAL AS total_co2_kg,
  ROUND(SUM(co2_avoided_kg)::numeric, 2)::REAL AS total_co2_avoided_kg,
  COUNT(*)::INT AS completed_trips
FROM analytics.fact_trips
GROUP BY company_id, to_char(started_at AT TIME ZONE 'Asia/Colombo', 'YYYY-MM');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_co2_month_pk 
ON analytics.mv_co2_by_company_month (company_id, month_bucket);

-- MV 5: Raw urban zone flow by hour (base table for privacy engine; NEVER exposed directly)
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_zone_flow_hour AS
SELECT
  t.origin_zone_id,
  t.dest_zone_id,
  date_trunc('hour', t.started_at AT TIME ZONE 'Asia/Colombo') AS hour_bucket,
  COUNT(*)::INT AS raw_trip_count,
  ROUND(SUM(t.distance_km)::numeric, 2)::REAL AS raw_total_distance_km
FROM analytics.fact_trips t
JOIN analytics.company_consent c ON c.company_id = t.company_id
WHERE c.shared_for_urban_planning = true
  AND t.origin_zone_id IS NOT NULL 
  AND t.dest_zone_id IS NOT NULL
GROUP BY t.origin_zone_id, t.dest_zone_id, date_trunc('hour', t.started_at AT TIME ZONE 'Asia/Colombo');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_zone_flow_pk 
ON analytics.mv_zone_flow_hour (origin_zone_id, dest_zone_id, hour_bucket);

-- Pre-seed Standard Colombo Metropolitan Zones
INSERT INTO analytics.zones (name, code, geom) VALUES
  ('Colombo Fort / Financial Hub', 'CMB-01', ST_GeomFromText('POLYGON((79.840 6.930, 79.860 6.930, 79.860 6.945, 79.840 6.945, 79.840 6.930))', 4326)),
  ('Slave Island / Union Place Tech Corridor', 'CMB-02', ST_GeomFromText('POLYGON((79.845 6.915, 79.865 6.915, 79.865 6.930, 79.845 6.930, 79.845 6.915))', 4326)),
  ('Kollupitiya / Bambalapitiya Coastal Zone', 'CMB-03', ST_GeomFromText('POLYGON((79.848 6.885, 79.865 6.885, 79.865 6.915, 79.848 6.915, 79.848 6.885))', 4326)),
  ('Cinnamon Gardens / IT & R&D Hub', 'CMB-07', ST_GeomFromText('POLYGON((79.865 6.900, 79.885 6.900, 79.885 6.920, 79.865 6.920, 79.865 6.900))', 4326)),
  ('Rajagiriya / Battaramulla Administrative City', 'KJW-01', ST_GeomFromText('POLYGON((79.890 6.890, 79.925 6.890, 79.925 6.920, 79.890 6.920, 79.890 6.890))', 4326)),
  ('Dehiwala / Mount Lavinia Commuter Belt', 'DEH-01', ST_GeomFromText('POLYGON((79.855 6.830, 79.880 6.830, 79.880 6.885, 79.855 6.885, 79.855 6.830))', 4326))
ON CONFLICT (code) DO NOTHING;

-- >>> DOWN >>>
DROP MATERIALIZED VIEW IF EXISTS analytics.mv_zone_flow_hour CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.mv_co2_by_company_month CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.mv_fuel_reimbursed_month CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.mv_occupancy_by_route_day CASCADE;
DROP MATERIALIZED VIEW IF EXISTS analytics.mv_trips_by_department_day CASCADE;
DROP TABLE IF EXISTS analytics.company_consent CASCADE;
DROP TABLE IF EXISTS analytics.privacy_budget_ledger CASCADE;
DROP TABLE IF EXISTS analytics.etl_issues CASCADE;
DROP TABLE IF EXISTS analytics.etl_watermarks CASCADE;
DROP TABLE IF EXISTS analytics.fact_trips CASCADE;
DROP TABLE IF EXISTS analytics.zones CASCADE;
