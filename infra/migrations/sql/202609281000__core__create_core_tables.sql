-- Migration: 202609281000__core__create_core_tables.sql
-- Schema: core
-- Description: Core companies, users, and trips shared schemas

-- >>> UP >>>
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS core;

CREATE TABLE IF NOT EXISTS core.companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email_domains TEXT[] NOT NULL,
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

CREATE TABLE IF NOT EXISTS core.trip_participants (
  trip_id BIGINT REFERENCES core.trips(id) ON DELETE CASCADE,
  user_id BIGINT REFERENCES core.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('driver', 'rider')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);

-- >>> DOWN >>>
DROP TABLE IF EXISTS core.trip_participants CASCADE;
DROP TABLE IF EXISTS core.trips CASCADE;
DROP TABLE IF EXISTS core.users CASCADE;
DROP TABLE IF EXISTS core.companies CASCADE;
