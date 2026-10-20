-- Migration: 202610021430__wallet__create_vehicle_types_and_emissions.sql
-- Schema: wallet
-- Description: Fuel types, vehicle registries, DEFRA emission factors, and fuel prices

-- >>> UP >>>
CREATE SCHEMA IF NOT EXISTS wallet;

CREATE TABLE IF NOT EXISTS wallet.fuel_types (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,                -- PETROL_92, AUTO_DIESEL, ELECTRIC, HYBRID
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'litre'        -- litre, kWh
);

CREATE TABLE IF NOT EXISTS wallet.vehicle_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                       -- Small Car, Sedan, SUV, Van, Minibus, Large Bus
  fuel_type_id INT NOT NULL REFERENCES wallet.fuel_types(id),
  avg_km_per_litre FLOAT NOT NULL CHECK (avg_km_per_litre > 0),
  default_occupancy INT NOT NULL DEFAULT 1 CHECK (default_occupancy >= 1)
);

CREATE TABLE IF NOT EXISTS wallet.emission_factors (
  id SERIAL PRIMARY KEY,
  fuel_type_id INT NOT NULL REFERENCES wallet.fuel_types(id),
  vehicle_type_id INT REFERENCES wallet.vehicle_types(id) ON DELETE SET NULL,
  kg_co2e_per_litre FLOAT,                  -- Direct combustion emission factor
  kg_co2e_per_km FLOAT,                     -- Average per-km factor
  source TEXT NOT NULL,                     -- e.g. 'UK DEFRA GHG 2024', 'Sri Lanka Sustainable Energy Authority'
  source_year INT NOT NULL,
  region TEXT NOT NULL DEFAULT 'GLOBAL',    -- 'LK', 'GLOBAL', 'UK'
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emission_lookup ON wallet.emission_factors(fuel_type_id, region);

CREATE TABLE IF NOT EXISTS wallet.fuel_prices (
  id SERIAL PRIMARY KEY,
  fuel_type_id INT NOT NULL REFERENCES wallet.fuel_types(id),
  price_minor_per_litre INT NOT NULL CHECK (price_minor_per_litre > 0), -- in LKR cents (e.g. 33200 = 332.00 LKR)
  effective_from TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'CPC Ceylon Petroleum Corporation',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fuel_price_lookup ON wallet.fuel_prices(fuel_type_id, effective_from DESC);

-- >>> DOWN >>>
DROP TABLE IF EXISTS wallet.fuel_prices CASCADE;
DROP TABLE IF EXISTS wallet.emission_factors CASCADE;
DROP TABLE IF EXISTS wallet.vehicle_types CASCADE;
DROP TABLE IF EXISTS wallet.fuel_types CASCADE;
