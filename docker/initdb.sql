-- ============================================================================
-- Corporate Employee Shuttle Platform - Unified Database Initialization (v1.0)
-- Schema Namespaces agreed across Group 05 "Stack Kings"
-- Modules:
--   - core:      Shared entities owned by Amaraweera (M4)
--   - auth:      Authentication & credentials owned by Chamara (M2)
--   - booking:   Fleet, shuttle trips & seat reservations owned by Chamara (M2)
--   - routing:   Road network & ride matching owned by Thisera (M1)
--   - wallet:    Fares, ledgers & cost-splitting owned by Zainy (M3)
--   - safety:    GPS tracking & anomalies owned by Amaraweera (M4)
--   - analytics: Reporting & ETL aggregations owned by Kulapputhanthri (M5)
-- ============================================================================

-- 0. Required Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Schema Namespaces
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS booking;
CREATE SCHEMA IF NOT EXISTS routing;
CREATE SCHEMA IF NOT EXISTS wallet;
CREATE SCHEMA IF NOT EXISTS safety;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Set search path to include core, booking, auth, routing, and public
ALTER DATABASE corporate_shuttle SET search_path TO core, booking, auth, routing, public;

-- ============================================================================
-- CORE SCHEMA (Amaraweera M4 - Shared Entities)
-- ============================================================================

CREATE TABLE IF NOT EXISTS core.companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email_domains TEXT[] NOT NULL,            -- e.g. ARRAY['syscolabs.com', 'virtusa.com']
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.users (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES core.companies(id) ON DELETE SET NULL,
  email CITEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'driver', 'admin', 'policymaker')),
  gender TEXT,
  phone TEXT,
  corporate_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_core_users_company ON core.users(company_id);
CREATE INDEX IF NOT EXISTS idx_core_users_role ON core.users(role);

CREATE TABLE IF NOT EXISTS core.trips (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('carpool', 'shuttle')),
  company_id BIGINT REFERENCES core.companies(id) ON DELETE SET NULL,
  driver_user_id BIGINT REFERENCES core.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'boarding', 'in_progress', 'completed', 'cancelled')),
  planned_start TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_core_trips_company ON core.trips(company_id);
CREATE INDEX IF NOT EXISTS idx_core_trips_status ON core.trips(status);

CREATE TABLE IF NOT EXISTS core.trip_participants (
  trip_id BIGINT REFERENCES core.trips(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES core.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('driver', 'rider')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);

-- ============================================================================
-- AUTH SCHEMA (Chamara M2 - Authentication & Credentials)
-- ============================================================================

CREATE TABLE IF NOT EXISTS auth.credentials (
  user_id BIGINT PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  refresh_token_hash TEXT,
  last_login_at TIMESTAMPTZ,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON auth.refresh_tokens(user_id);

-- ============================================================================
-- BOOKING SCHEMA (Chamara M2 - Fleet & Seat Reservation Engine)
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking.vehicles (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES core.companies(id) ON DELETE SET NULL,
  plate_no TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,                      -- e.g. 'Coaster', 'HiAce', 'Civilian'
  capacity INT NOT NULL,
  seat_layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_cap CHECK (capacity > 0)
);

CREATE TABLE IF NOT EXISTS booking.seats (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id BIGINT NOT NULL REFERENCES booking.vehicles(id) ON DELETE CASCADE,
  seat_label TEXT NOT NULL,                -- e.g. '1A', '1B', '2A'
  row_no INT NOT NULL,
  col_no INT NOT NULL,
  is_window BOOLEAN NOT NULL DEFAULT false,
  is_aisle BOOLEAN NOT NULL DEFAULT false,
  is_accessible BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(vehicle_id, seat_label)
);
CREATE INDEX IF NOT EXISTS idx_booking_seats_vehicle ON booking.seats(vehicle_id);

CREATE TABLE IF NOT EXISTS booking.drivers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  licence_no TEXT NOT NULL,
  company_id BIGINT REFERENCES core.companies(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking.shuttle_routes (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES core.companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  origin_name TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  stops_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  distance_m FLOAT,
  estimated_duration_s INT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking.shuttle_trips (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT NOT NULL REFERENCES booking.shuttle_routes(id) ON DELETE CASCADE,
  vehicle_id BIGINT NOT NULL REFERENCES booking.vehicles(id) ON DELETE RESTRICT,
  driver_id BIGINT REFERENCES booking.drivers(id) ON DELETE SET NULL,
  depart_at TIMESTAMPTZ NOT NULL,
  arrive_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'boarding', 'in_progress', 'completed', 'cancelled')),
  booking_cutoff_at TIMESTAMPTZ NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_shuttle_trips_depart ON booking.shuttle_trips(depart_at);
CREATE INDEX IF NOT EXISTS idx_booking_shuttle_trips_route ON booking.shuttle_trips(route_id);

CREATE TABLE IF NOT EXISTS booking.bookings (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT NOT NULL REFERENCES booking.shuttle_trips(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE RESTRICT,
  party_size INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('held', 'confirmed', 'cancelled', 'waitlisted', 'no_show')),
  idempotency_key UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  version INT NOT NULL DEFAULT 1,
  CONSTRAINT chk_party CHECK (party_size BETWEEN 1 AND 6)
);

-- Unique index: A user cannot hold two active bookings on the same trip
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_booking_per_user_trip
  ON booking.bookings(trip_id, user_id) WHERE status IN ('held', 'confirmed', 'waitlisted');

CREATE TABLE IF NOT EXISTS booking.seat_assignments (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES booking.bookings(id) ON DELETE CASCADE,
  trip_id BIGINT NOT NULL REFERENCES booking.shuttle_trips(id) ON DELETE CASCADE,
  seat_id BIGINT NOT NULL REFERENCES booking.seats(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  assigned_at TIMESTAMPTZ DEFAULT now()
);

-- Unique index: A seat can have at most ONE active assignment per trip
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_seat_per_trip
  ON booking.seat_assignments(trip_id, seat_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS booking.waitlist_entries (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT NOT NULL REFERENCES booking.shuttle_trips(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  party_size INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'promoted', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_waitlist_trip_created
  ON booking.waitlist_entries(trip_id, created_at);

CREATE TABLE IF NOT EXISTS booking.seat_holds (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT NOT NULL REFERENCES booking.shuttle_trips(id) ON DELETE CASCADE,
  seat_id BIGINT NOT NULL REFERENCES booking.seats(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_seat_holds_expires ON booking.seat_holds(expires_at);

CREATE TABLE IF NOT EXISTS booking.booking_audit (
  id BIGSERIAL PRIMARY KEY,
  booking_id BIGINT NOT NULL REFERENCES booking.bookings(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id BIGINT REFERENCES core.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking.idempotency_keys (
  key TEXT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS booking.domain_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,                -- booking.confirmed | booking.cancelled | booking.promoted
  payload JSONB NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- ROUTING SCHEMA (Thisera M1 - Graph & Ride Matching)
-- Also exposed in public for backward compatibility with routing-engine
-- ============================================================================

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

CREATE TABLE IF NOT EXISTS matches (
  id BIGSERIAL PRIMARY KEY,
  offer_id BIGINT REFERENCES ride_offers(id) ON DELETE CASCADE,
  request_id BIGINT REFERENCES ride_requests(id) ON DELETE CASCADE,
  overlap_pct FLOAT,
  detour_added_m FLOAT,
  status TEXT DEFAULT 'proposed',          -- proposed | confirmed | rejected
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Helper function: Snap Point to Nearest Road Node
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

-- ============================================================================
-- SAFETY SCHEMA (Amaraweera M4 - Tracking, Route Boundaries & Anomalies)
-- ============================================================================

CREATE TABLE IF NOT EXISTS safety.tracking_points (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT NOT NULL REFERENCES core.trips(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  geom GEOMETRY(Point, 4326) NOT NULL,
  speed_mps REAL,
  heading REAL,
  accuracy_m REAL,
  recorded_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tracking_points_geom ON safety.tracking_points USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_tracking_points_trip_time ON safety.tracking_points (trip_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_points_user_time ON safety.tracking_points (user_id, recorded_at DESC);

CREATE TABLE IF NOT EXISTS safety.route_boundaries (
  trip_id BIGINT PRIMARY KEY REFERENCES core.trips(id) ON DELETE CASCADE,
  geom GEOMETRY(LineString, 4326) NOT NULL,
  mild_threshold_m INT NOT NULL DEFAULT 250,
  severe_threshold_m INT NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_route_boundaries_geom ON safety.route_boundaries USING GIST(geom);

CREATE TABLE IF NOT EXISTS safety.sos_events (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT REFERENCES core.trips(id) ON DELETE SET NULL,
  user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'auto_anomaly')),
  geom GEOMETRY(Point, 4326),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by BIGINT REFERENCES core.users(id) ON DELETE SET NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_sos_events_status ON safety.sos_events (status);
CREATE INDEX IF NOT EXISTS idx_sos_events_trip ON safety.sos_events (trip_id);
CREATE INDEX IF NOT EXISTS idx_sos_events_geom ON safety.sos_events USING GIST(geom);

CREATE TABLE IF NOT EXISTS safety.anomaly_log (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT NOT NULL REFERENCES core.trips(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES core.users(id) ON DELETE SET NULL,
  level TEXT NOT NULL CHECK (level IN ('warning', 'admin_alert', 'auto_sos', 'stall', 'trip_end')),
  distance_m REAL,
  geom GEOMETRY(Point, 4326),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anomaly_log_trip_level ON safety.anomaly_log (trip_id, level);
CREATE INDEX IF NOT EXISTS idx_anomaly_log_geom ON safety.anomaly_log USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_anomaly_log_created ON safety.anomaly_log (created_at DESC);

CREATE TABLE IF NOT EXISTS safety.verified_users (
  user_id BIGINT PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
  corporate_email CITEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_users_email ON safety.verified_users (corporate_email);

CREATE TABLE IF NOT EXISTS safety.otp_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES core.users(id) ON DELETE SET NULL,
  email CITEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  consumed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_otp_requests_email_active ON safety.otp_requests (email, consumed, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_requests_user ON safety.otp_requests (user_id);

CREATE TABLE IF NOT EXISTS safety.safety_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
  women_only BOOLEAN NOT NULL DEFAULT false,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

