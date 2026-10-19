-- Migration: 202610191200__wallet__seed_fuel_emission_factors_and_demo_wallets.sql
-- Schema: wallet
-- Description: Seed data v1 for fuel types, DEFRA 2024 factors, CPC fuel prices, and demo wallets

-- >>> UP >>>

-- 1. Seed Fuel Types
INSERT INTO wallet.fuel_types (code, name, unit) VALUES
  ('PETROL_92', 'Petrol 92 Octane', 'litre'),
  ('AUTO_DIESEL', 'Auto Diesel', 'litre'),
  ('HYBRID', 'Petrol-Electric Hybrid', 'litre'),
  ('ELECTRIC', 'Battery Electric Vehicle (BEV)', 'kWh')
ON CONFLICT (code) DO NOTHING;

-- 2. Seed Standard Vehicle Types
INSERT INTO wallet.vehicle_types (name, fuel_type_id, avg_km_per_litre, default_occupancy)
SELECT 'Compact / Small Car', id, 16.5, 1 FROM wallet.fuel_types WHERE code = 'PETROL_92'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.vehicle_types (name, fuel_type_id, avg_km_per_litre, default_occupancy)
SELECT 'Mid-size Sedan', id, 12.0, 1 FROM wallet.fuel_types WHERE code = 'PETROL_92'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.vehicle_types (name, fuel_type_id, avg_km_per_litre, default_occupancy)
SELECT 'Hybrid Hatchback / Sedan', id, 22.0, 1 FROM wallet.fuel_types WHERE code = 'HYBRID'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.vehicle_types (name, fuel_type_id, avg_km_per_litre, default_occupancy)
SELECT 'SUV / Crossover', id, 9.5, 1 FROM wallet.fuel_types WHERE code = 'AUTO_DIESEL'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.vehicle_types (name, fuel_type_id, avg_km_per_litre, default_occupancy)
SELECT 'Corporate Commuter Van (14-seater)', id, 8.5, 8 FROM wallet.fuel_types WHERE code = 'AUTO_DIESEL'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.vehicle_types (name, fuel_type_id, avg_km_per_litre, default_occupancy)
SELECT 'Large Corporate Shuttle (32-seater)', id, 4.5, 20 FROM wallet.fuel_types WHERE code = 'AUTO_DIESEL'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.vehicle_types (name, fuel_type_id, avg_km_per_litre, default_occupancy)
SELECT 'Electric Commuter Vehicle', id, 6.5, 1 FROM wallet.fuel_types WHERE code = 'ELECTRIC'
ON CONFLICT DO NOTHING;

-- 3. Seed Emission Factors (UK DEFRA 2024 & Sri Lanka CEB 2024)
INSERT INTO wallet.emission_factors (fuel_type_id, kg_co2e_per_litre, kg_co2e_per_km, source, source_year, region)
SELECT id, 2.31495, NULL, 'UK DEFRA GHG Conversion Factors 2024 (Petrol - 100% mineral)', 2024, 'GLOBAL'
FROM wallet.fuel_types WHERE code = 'PETROL_92'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.emission_factors (fuel_type_id, kg_co2e_per_litre, kg_co2e_per_km, source, source_year, region)
SELECT id, 2.68779, NULL, 'UK DEFRA GHG Conversion Factors 2024 (Diesel - 100% mineral)', 2024, 'GLOBAL'
FROM wallet.fuel_types WHERE code = 'AUTO_DIESEL'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.emission_factors (fuel_type_id, kg_co2e_per_litre, kg_co2e_per_km, source, source_year, region)
SELECT id, 1.62410, NULL, 'UK DEFRA GHG Conversion Factors 2024 (Hybrid car average)', 2024, 'GLOBAL'
FROM wallet.fuel_types WHERE code = 'HYBRID'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.emission_factors (fuel_type_id, kg_co2e_per_litre, kg_co2e_per_km, source, source_year, region)
SELECT id, NULL, 0.08450, 'Sri Lanka Sustainable Energy Authority (CEB Grid Mix 2024)', 2024, 'LK'
FROM wallet.fuel_types WHERE code = 'ELECTRIC'
ON CONFLICT DO NOTHING;

-- 4. Seed Ceylon Petroleum Corporation (CPC) Fuel Prices (in LKR Cents)
INSERT INTO wallet.fuel_prices (fuel_type_id, price_minor_per_litre, effective_from, source)
SELECT id, 33200, '2026-01-01 00:00:00+05:30', 'CPC Ceylon Petroleum Corporation'
FROM wallet.fuel_types WHERE code = 'PETROL_92'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.fuel_prices (fuel_type_id, price_minor_per_litre, effective_from, source)
SELECT id, 30700, '2026-01-01 00:00:00+05:30', 'CPC Ceylon Petroleum Corporation'
FROM wallet.fuel_types WHERE code = 'AUTO_DIESEL'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.fuel_prices (fuel_type_id, price_minor_per_litre, effective_from, source)
SELECT id, 33200, '2026-01-01 00:00:00+05:30', 'CPC Ceylon Petroleum Corporation'
FROM wallet.fuel_types WHERE code = 'HYBRID'
ON CONFLICT DO NOTHING;

INSERT INTO wallet.fuel_prices (fuel_type_id, price_minor_per_litre, effective_from, source)
SELECT id, 8000, '2026-01-01 00:00:00+05:30', 'CEB Commercial Tier Estimate'
FROM wallet.fuel_types WHERE code = 'ELECTRIC'
ON CONFLICT DO NOTHING;

-- 5. Seed System and Demo Corporate Wallets
INSERT INTO wallet.accounts (owner_type, owner_id, currency) VALUES
  ('system', 1, 'LKR'),    -- System Platform Treasury Account
  ('company', 1, 'LKR'),   -- Dialog Axiata PLC Commute Subsidy Wallet
  ('user', 1, 'LKR'),      -- Admin User Wallet
  ('user', 2, 'LKR'),      -- Demo Driver Wallet
  ('user', 3, 'LKR')       -- Demo Commuter Wallet
ON CONFLICT (owner_type, owner_id, currency) DO NOTHING;

-- >>> DOWN >>>
DELETE FROM wallet.fuel_prices;
DELETE FROM wallet.emission_factors;
DELETE FROM wallet.vehicle_types;
DELETE FROM wallet.fuel_types;
