-- Migration: 202611111200__booking__waitlist_holds_and_allocations.sql
-- Schema: booking
-- Description: Intelligent allocation, FIFO waitlist with promotion, and temporary seat holds

-- >>> UP >>>

-- 1. Extend waitlist_entries with audit, lifecycle timestamps, and booking link
ALTER TABLE booking.waitlist_entries 
  ADD COLUMN IF NOT EXISTS booking_id BIGINT REFERENCES booking.bookings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMPTZ;

-- Prevent duplicate active waitlist entries for the same employee and trip
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_waitlist_per_user_trip
  ON booking.waitlist_entries(trip_id, user_id)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_booking_waitlist_trip_waiting
  ON booking.waitlist_entries(trip_id, created_at)
  WHERE status = 'waiting';

-- 2. Create booking.holds to manage grouped temporary reservations
CREATE TABLE IF NOT EXISTS booking.holds (
  id BIGSERIAL PRIMARY KEY,
  trip_id BIGINT NOT NULL REFERENCES booking.shuttle_trips(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  party_size INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'confirmed', 'expired', 'released')),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  booking_id BIGINT REFERENCES booking.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_holds_trip_status
  ON booking.holds(trip_id, status);

CREATE INDEX IF NOT EXISTS idx_booking_holds_expires
  ON booking.holds(expires_at)
  WHERE status = 'held';

CREATE INDEX IF NOT EXISTS idx_booking_holds_user
  ON booking.holds(user_id, status);

-- 3. Extend seat_holds to connect to parent hold and enforce uniqueness per active seat
ALTER TABLE booking.seat_holds
  ADD COLUMN IF NOT EXISTS hold_id BIGINT REFERENCES booking.holds(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'confirmed', 'expired', 'released')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_seat_hold
  ON booking.seat_holds(trip_id, seat_id)
  WHERE status = 'held';

CREATE INDEX IF NOT EXISTS idx_booking_seat_holds_hold
  ON booking.seat_holds(hold_id);

-- >>> DOWN >>>

DROP INDEX IF EXISTS booking.idx_booking_seat_holds_hold;
DROP INDEX IF EXISTS booking.uq_active_seat_hold;

ALTER TABLE booking.seat_holds
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS hold_id;

DROP TABLE IF EXISTS booking.holds CASCADE;

DROP INDEX IF EXISTS booking.idx_booking_waitlist_trip_waiting;
DROP INDEX IF EXISTS booking.uq_active_waitlist_per_user_trip;

ALTER TABLE booking.waitlist_entries
  DROP COLUMN IF EXISTS promoted_at,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS booking_id;

