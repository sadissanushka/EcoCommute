-- Migration: 202610051400__analytics__seed_fact_trips_and_companies.sql
-- Schema: analytics
-- Description: Seed data v1 for companies, consent flags, fact_trips, and initial materialized view refresh

-- >>> UP >>>

-- 1. Ensure core companies exist
INSERT INTO core.companies (id, name, email_domains) VALUES
  (1, 'Dialog Axiata PLC', ARRAY['dialog.lk', 'axiata.com']),
  (2, 'MAS Holdings', ARRAY['masholdings.com']),
  (3, 'John Keells Holdings', ARRAY['keells.com']),
  (4, 'Commercial Bank of Ceylon', ARRAY['combank.net']),
  (5, 'WSO2 Lanka', ARRAY['wso2.com'])
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Urban Planning Consent Flags
INSERT INTO analytics.company_consent (company_id, shared_for_urban_planning) VALUES
  (1, true),
  (2, true),
  (3, true),
  (4, true),
  (5, true)
ON CONFLICT (company_id) DO NOTHING;

-- 3. Seed Pilot Fact Trips (Covering July, August, September 2026)
INSERT INTO analytics.fact_trips (
  trip_id, company_id, department, kind, started_at, ended_at,
  distance_km, occupancy, seats_offered, seats_used,
  fuel_reimbursed_minor, co2_kg, co2_avoided_kg, origin_zone_id, dest_zone_id
) VALUES
  (1001, 1, 'Engineering & IT', 'carpool', '2026-07-15 08:15:00+05:30', '2026-07-15 08:55:00+05:30', 18.5, 3.0, 4, 3, 51100, 3.568, 7.136, 6, 2),
  (1002, 1, 'Engineering & IT', 'carpool', '2026-07-15 17:30:00+05:30', '2026-07-15 18:15:00+05:30', 22.0, 2.0, 4, 2, 60800, 4.244, 4.244, 2, 6),
  (1003, 1, 'Operations & Logistics', 'shuttle', '2026-07-16 07:45:00+05:30', '2026-07-16 08:40:00+05:30', 32.5, 14.0, 16, 14, 133000, 11.647, 62.894, 5, 1),
  (1004, 1, 'Operations & Logistics', 'carpool', '2026-07-31 23:45:00+05:30', '2026-08-01 00:30:00+05:30', 15.0, 2.0, 4, 2, 41500, 2.893, 2.893, 3, 2),
  (1005, 1, 'Customer Support', 'carpool', '2026-08-05 08:00:00+05:30', '2026-08-05 08:45:00+05:30', 14.0, 3.0, 4, 3, 38700, 2.700, 5.400, 4, 1),
  (1006, 1, 'Sales & Marketing', 'shuttle', '2026-08-10 17:45:00+05:30', '2026-08-10 18:35:00+05:30', 28.0, 12.0, 16, 12, 114600, 10.034, 50.170, 2, 5),
  (1007, 1, 'Finance & Accounting', 'carpool', '2026-08-20 08:30:00+05:30', '2026-08-20 09:10:00+05:30', 16.5, 2.0, 4, 2, 45600, 3.183, 3.183, 6, 4),
  (1008, 1, 'Human Resources', 'carpool', '2026-09-02 08:15:00+05:30', '2026-09-02 08:50:00+05:30', 12.0, 2.0, 4, 2, 33200, 2.315, 2.315, 3, 1),
  (1009, 1, 'Engineering & IT', 'shuttle', '2026-09-15 07:30:00+05:30', '2026-09-15 08:25:00+05:30', 35.0, 15.0, 16, 15, 143300, 12.544, 75.264, 5, 2),
  (1010, 1, 'Engineering & IT', 'carpool', '2026-09-28 17:30:00+05:30', '2026-09-28 18:10:00+05:30', 19.0, 3.0, 4, 3, 52500, 3.665, 7.330, 2, 6),
  -- Company 2 pilot trip
  (2001, 2, 'Human Resources', 'carpool', '2026-08-12 08:00:00+05:30', '2026-08-12 08:40:00+05:30', 16.0, 2.0, 4, 2, 44200, 3.086, 3.086, 6, 3)
ON CONFLICT (trip_id) DO NOTHING;

-- 4. Initial Materialized Views Refresh
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_trips_by_department_day;
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_occupancy_by_route_day;
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_fuel_reimbursed_month;
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_co2_by_company_month;
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_zone_flow_hour;

-- 5. Seed Watermark
INSERT INTO analytics.etl_watermarks (source, last_loaded_at, records_processed)
VALUES ('core_trips', '2026-09-30 23:59:59+05:30', 11)
ON CONFLICT (source) DO UPDATE SET
  last_loaded_at = EXCLUDED.last_loaded_at,
  records_processed = EXCLUDED.records_processed;

-- >>> DOWN >>>
DELETE FROM analytics.fact_trips WHERE trip_id BETWEEN 1001 AND 2001;
DELETE FROM analytics.company_consent;
