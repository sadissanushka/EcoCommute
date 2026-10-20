-- Migration: 202609291100__safety__create_safety_schema_and_tables.sql
-- Schema: safety
-- Author: Amaraweera MTP (244015X)
-- Description: Module 4 Safety tables - live GPS tracking points, planned route boundaries,
--              anomaly logs, SOS emergency events, corporate OTP verification, and safety preferences.

-- >>> UP >>>
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS safety;

-- 1. Real-time GPS Tracking Points ingested from active riders and drivers
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

-- Spatial GIST index for fast spatial lookup and proximity queries
CREATE INDEX IF NOT EXISTS idx_tracking_points_geom ON safety.tracking_points USING GIST(geom);
-- Btree compound index for retrieving latest trip points sorted chronologically
CREATE INDEX IF NOT EXISTS idx_tracking_points_trip_time ON safety.tracking_points (trip_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_points_user_time ON safety.tracking_points (user_id, recorded_at DESC);

-- 2. Planned Route Boundaries (published by Routing Engine Module 1 / Shuttle operator)
CREATE TABLE IF NOT EXISTS safety.route_boundaries (
  trip_id BIGINT PRIMARY KEY REFERENCES core.trips(id) ON DELETE CASCADE,
  geom GEOMETRY(LineString, 4326) NOT NULL,
  mild_threshold_m INT NOT NULL DEFAULT 250,
  severe_threshold_m INT NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_route_boundaries_geom ON safety.route_boundaries USING GIST(geom);

-- 3. SOS Emergency Events (triggered manually by riders/drivers or automatically via anomaly ladder)
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

-- 4. Anomaly Log (deviation alerts, stalls, and trip-end transitions logged by detector state machine)
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

-- 5. Corporate Email Verified Users (links core.users with validated corporate domains)
CREATE TABLE IF NOT EXISTS safety.verified_users (
  user_id BIGINT PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
  corporate_email CITEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_users_email ON safety.verified_users (corporate_email);

-- 6. Corporate Email OTP Requests (HMAC-SHA256 hashed storage, rate limiting, and expiry tracking)
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

-- 7. User Safety Preferences (women-only carpool filter, emergency contacts)
CREATE TABLE IF NOT EXISTS safety.safety_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES core.users(id) ON DELETE CASCADE,
  women_only BOOLEAN NOT NULL DEFAULT false,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- >>> DOWN >>>
DROP TABLE IF EXISTS safety.safety_preferences CASCADE;
DROP TABLE IF EXISTS safety.otp_requests CASCADE;
DROP TABLE IF EXISTS safety.verified_users CASCADE;
DROP TABLE IF EXISTS safety.anomaly_log CASCADE;
DROP TABLE IF EXISTS safety.sos_events CASCADE;
DROP TABLE IF EXISTS safety.route_boundaries CASCADE;
DROP TABLE IF EXISTS safety.tracking_points CASCADE;
DROP SCHEMA IF EXISTS safety CASCADE;
