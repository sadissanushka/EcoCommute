-- Migration: 202611060930__booking__add_hidden_bookings.sql
-- Schema: booking
-- Description: Add user-scoped visibility state for cancelled bookings

-- >>> UP >>>
CREATE SCHEMA IF NOT EXISTS booking;

CREATE TABLE IF NOT EXISTS booking.hidden_bookings (
  booking_id BIGINT NOT NULL REFERENCES booking.bookings(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES core.users(id) ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, user_id)
);

-- >>> DOWN >>>
DROP TABLE IF EXISTS booking.hidden_bookings;
