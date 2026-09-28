-- Module 1: Ride Matching & Custom Navigation Engine Schema
-- Shared PostgreSQL + PostGIS Database for Corporate Employee Shuttle Platform

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Road Network Graph
CREATE TABLE IF NOT EXISTS road_nodes (
  id BIGINT PRIMARY KEY,
  geom GEOMETRY(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_road_nodes_geom ON road_nodes USING GIST(geom);

CREATE TABLE IF NOT EXISTS road_edges (
  id BIGSERIAL PRIMARY KEY,
  source BIGINT NOT NULL REFERENCES road_nodes(id) ON DELETE CASCADE,
  target BIGINT NOT NULL REFERENCES road_nodes(id) ON DELETE CASCADE,
  distance_m FLOAT NOT NULL,
  speed_kmh FLOAT NOT NULL DEFAULT 40.0,
  is_oneway BOOLEAN NOT NULL DEFAULT false,
  geom GEOMETRY(LineString, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_road_edges_source ON road_edges(source);
CREATE INDEX IF NOT EXISTS idx_road_edges_target ON road_edges(target);
CREATE INDEX IF NOT EXISTS idx_road_edges_geom ON road_edges USING GIST(geom);

-- 2. Ride Offers & Requests
CREATE TABLE IF NOT EXISTS ride_offers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  origin GEOMETRY(Point, 4326) NOT NULL,
  destination GEOMETRY(Point, 4326) NOT NULL,
  time_window_start TIMESTAMPTZ,
  time_window_end TIMESTAMPTZ,
  recurring BOOLEAN DEFAULT false,
  women_only BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ride_offers_origin ON ride_offers USING GIST(origin);
CREATE INDEX IF NOT EXISTS idx_ride_offers_destination ON ride_offers USING GIST(destination);

CREATE TABLE IF NOT EXISTS ride_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  origin GEOMETRY(Point, 4326) NOT NULL,
  destination GEOMETRY(Point, 4326) NOT NULL,
  time_window_start TIMESTAMPTZ,
  time_window_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ride_requests_origin ON ride_requests USING GIST(origin);
CREATE INDEX IF NOT EXISTS idx_ride_requests_destination ON ride_requests USING GIST(destination);

-- 3. Ride Matches
CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  offer_id BIGINT REFERENCES ride_offers(id) ON DELETE CASCADE,
  request_id BIGINT REFERENCES ride_requests(id) ON DELETE CASCADE,
  overlap_pct FLOAT,
  detour_added_m FLOAT,
  status TEXT DEFAULT 'proposed', -- proposed | confirmed | rejected
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Helper Function: Snap Point to Nearest Road Node using PostGIS KNN (<->)
CREATE OR REPLACE FUNCTION snap_to_nearest_road_node(
  p_lng DOUBLE PRECISION,
  p_lat DOUBLE PRECISION
)
RETURNS TABLE (
  node_id BIGINT,
  distance_m DOUBLE PRECISION,
  node_geom GEOMETRY(Point, 4326)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rn.id AS node_id,
    ST_Distance(rn.geom::geography, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) AS distance_m,
    rn.geom AS node_geom
  FROM road_nodes rn
  ORDER BY rn.geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
