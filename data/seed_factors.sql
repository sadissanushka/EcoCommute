-- Seed Data for Emission Factors and Fuel Prices (Module 3)
-- Standards: DEFRA 2024 / CPC Sri Lanka 2026

-- 1. Fuel Types
INSERT INTO wallet.fuel_types (id, code, name, unit)
VALUES
  (1, 'PETROL_92',    'Lanka Petrol 92 Octane', 'litre'),
  (2, 'AUTO_DIESEL',   'Lanka Auto Diesel',      'litre'),
  (3, 'HYBRID_PETROL', 'Petrol Hybrid (HEV)',    'litre'),
  (4, 'ELECTRIC',      'Battery Electric (BEV)', 'kWh')
ON CONFLICT (code) DO NOTHING;

-- 2. Vehicle Types
INSERT INTO wallet.vehicle_types (id, name, fuel_type_id, avg_km_per_litre, default_occupancy)
VALUES
  (1, 'Small Petrol Car (<1.4L)',         1, 15.5, 1),
  (2, 'Medium Petrol Sedan (1.4L - 2.0L)', 1, 12.0, 1),
  (3, 'Large Petrol SUV (>2.0L)',          1,  8.5, 1),
  (4, 'Diesel Commuter Van (14-seater)',   2,  9.5, 10),
  (5, 'Corporate Shuttle Bus (30-seater)', 2,  5.0, 22)
ON CONFLICT (id) DO NOTHING;

-- 3. DEFRA Emission Factors
INSERT INTO wallet.emission_factors (fuel_type_id, vehicle_type_id, kg_co2e_per_litre, kg_co2e_per_km, source, source_year, region)
VALUES
  (1, NULL, 2.16274, 0.18023, 'UK DEFRA GHG Conversion Factors', 2024, 'GLOBAL'),
  (2, NULL, 2.55784, 0.26925, 'UK DEFRA GHG Conversion Factors', 2024, 'GLOBAL'),
  (3, NULL, 1.83150, 0.11500, 'UK DEFRA GHG Conversion Factors', 2024, 'GLOBAL'),
  (4, NULL, 0.00000, 0.04500, 'UK DEFRA GHG Conversion Factors', 2024, 'GLOBAL');

-- 4. Fuel Prices (CPC Sri Lanka retail prices in LKR cents)
INSERT INTO wallet.fuel_prices (fuel_type_id, price_minor_per_litre, effective_from, source)
VALUES
  (1, 33200, '2026-10-01 00:00:00+05:30', 'Ceylon Petroleum Corporation (CPC)'),
  (2, 30700, '2026-10-01 00:00:00+05:30', 'Ceylon Petroleum Corporation (CPC)');
