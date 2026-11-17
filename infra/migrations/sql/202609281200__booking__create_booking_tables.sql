-- Migration: 202609281200__booking__create_booking_tables.sql
-- Schema: booking
-- Description: Fleet, shuttle routes, trips, seats, bookings, waitlist, holds, audit, idempotency, and domain events

-- >>> UP >>>
CREATE SCHEMA IF NOT EXISTS booking;

CREATE TABLE IF NOT EXISTS booking.vehicles (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES core.companies(id) ON DELETE SET NULL,
  plate_no TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  capacity INT NOT NULL,
  seat_layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_cap CHECK (capacity > 0)
);

CREATE TABLE IF NOT EXISTS booking.seats (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id BIGINT NOT NULL REFERENCES booking.vehicles(id) ON DELETE CASCADE,
  seat_label TEXT NOT NULL,
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
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- >>> DOWN >>>
DROP TABLE IF EXISTS booking.domain_events CASCADE;
DROP TABLE IF EXISTS booking.idempotency_keys CASCADE;
DROP TABLE IF EXISTS booking.booking_audit CASCADE;
DROP TABLE IF EXISTS booking.seat_holds CASCADE;
DROP TABLE IF EXISTS booking.waitlist_entries CASCADE;
DROP TABLE IF EXISTS booking.seat_assignments CASCADE;
DROP TABLE IF EXISTS booking.bookings CASCADE;
DROP TABLE IF EXISTS booking.shuttle_trips CASCADE;
DROP TABLE IF EXISTS booking.shuttle_routes CASCADE;
DROP TABLE IF EXISTS booking.drivers CASCADE;
DROP TABLE IF EXISTS booking.seats CASCADE;
DROP TABLE IF EXISTS booking.vehicles CASCADE;
DROP SCHEMA IF EXISTS booking CASCADE;
