-- ============================================================================
-- Corporate Employee Shuttle Platform - Seed Data v0
-- 1 Company, 10 Users (4 roles), 3 Vehicles, 2 Shuttle Routes, 10 Trips
-- Group 05 "Stack Kings" - Module 2 (Chamara WPR - 234250D)
-- ============================================================================

-- 1. Seed Company
INSERT INTO core.companies (id, name, email_domains)
VALUES (1, 'Sysco LABS Sri Lanka', ARRAY['syscolabs.com'])
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email_domains = EXCLUDED.email_domains;

-- Reset sequence for companies
SELECT setval('core.companies_id_seq', (SELECT MAX(id) FROM core.companies));

-- 2. Seed Users (1 Admin, 2 Drivers, 1 Policymaker, 6 Employees)
INSERT INTO core.users (id, company_id, email, full_name, role, gender, corporate_verified)
VALUES
  (1,  1, 'admin@syscolabs.com',       'Admin User',            'admin',       'male',   true),
  (2,  1, 'driver1@syscolabs.com',     'Sunil Perera',          'driver',      'male',   true),
  (3,  1, 'driver2@syscolabs.com',     'Kamal Fernando',        'driver',      'male',   true),
  (4,  1, 'policymaker@syscolabs.com', 'Nirosha Silva',         'policymaker', 'female', true),
  (5,  1, 'emp1@syscolabs.com',        'Kasun Wijesinghe',      'employee',    'male',   true),
  (6,  1, 'emp2@syscolabs.com',        'Anushka Ranasinghe',    'employee',    'male',   true),
  (7,  1, 'emp3@syscolabs.com',        'Dilani Wickramasinghe', 'employee',    'female', true),
  (8,  1, 'emp4@syscolabs.com',        'Chathura Bandara',      'employee',    'male',   true),
  (9,  1, 'emp5@syscolabs.com',        'Saman Kumara',          'employee',    'male',   true),
  (10, 1, 'emp6@syscolabs.com',        'Sanduni Jayawardena',   'employee',    'female', true)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  corporate_verified = EXCLUDED.corporate_verified;

SELECT setval('core.users_id_seq', (SELECT MAX(id) FROM core.users));

-- 3. Seed Auth Credentials (Default Password: Password123!)
-- Hash generated via bcrypt (cost 10): $2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
INSERT INTO auth.credentials (user_id, password_hash)
VALUES
  (1,  '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW'),
  (2,  '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW'),
  (3,  '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW'),
  (4,  '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW'),
  (5,  '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW'),
  (6,  '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW'),
  (7,  '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW'),
  (8,  '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW'),
  (9,  '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW'),
  (10, '$2b$10$ok60C2fzOkDsOsfIR3dl1uCdNVzemKV7XzPSoZ.s.KdlLMyGJJjrW')
ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- 4. Seed Vehicles (3 Vehicles)
INSERT INTO booking.vehicles (id, company_id, plate_no, type, capacity, seat_layout_json, active)
VALUES
  (1, 1, 'NC-8821', 'Toyota Coaster', 30, '{"rows":10,"cols":3,"aisleAfterCol":2}'::jsonb, true),
  (2, 1, 'WP-6490', 'Toyota HiAce',   14, '{"rows":4,"cols":4,"aisleAfterCol":2}'::jsonb,  true),
  (3, 1, 'CP-4521', 'Nissan Civilian', 22, '{"rows":7,"cols":3,"aisleAfterCol":2}'::jsonb, true)
ON CONFLICT (id) DO UPDATE SET
  plate_no = EXCLUDED.plate_no,
  type = EXCLUDED.type,
  capacity = EXCLUDED.capacity,
  seat_layout_json = EXCLUDED.seat_layout_json;

SELECT setval('booking.vehicles_id_seq', (SELECT MAX(id) FROM booking.vehicles));

-- 5. Seed Seats for Vehicle 1 (Toyota Coaster - 30 seats: 10 rows x 3 columns: A, B, C)
DO $$
DECLARE
  r INT;
  c INT;
  lbl TEXT;
  is_win BOOLEAN;
  is_ais BOOLEAN;
  is_acc BOOLEAN;
BEGIN
  FOR r IN 1..10 LOOP
    FOR c IN 1..3 LOOP
      lbl := r || CHR(64 + c); -- 1A, 1B, 1C
      is_win := (c = 1 OR c = 3);
      is_ais := (c = 2);
      is_acc := (r = 1); -- Row 1 is accessible
      INSERT INTO booking.seats (vehicle_id, seat_label, row_no, col_no, is_window, is_aisle, is_accessible)
      VALUES (1, lbl, r, c, is_win, is_ais, is_acc)
      ON CONFLICT (vehicle_id, seat_label) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Seed Seats for Vehicle 2 (Toyota HiAce - 14 seats: Rows 1-3 has 3 seats, Row 4 has 4 seats + jump seats)
DO $$
DECLARE
  r INT;
  c INT;
  lbl TEXT;
BEGIN
  -- Rows 1 to 3 (3 seats each: 1A, 1B, 1C)
  FOR r IN 1..3 LOOP
    FOR c IN 1..3 LOOP
      lbl := r || CHR(64 + c);
      INSERT INTO booking.seats (vehicle_id, seat_label, row_no, col_no, is_window, is_aisle, is_accessible)
      VALUES (2, lbl, r, c, (c = 1 OR c = 3), (c = 2), (r = 1))
      ON CONFLICT (vehicle_id, seat_label) DO NOTHING;
    END LOOP;
  END LOOP;
  -- Row 4 (5 seats: 4A, 4B, 4C, 4D, 4E)
  FOR c IN 1..5 LOOP
    lbl := '4' || CHR(64 + c);
    INSERT INTO booking.seats (vehicle_id, seat_label, row_no, col_no, is_window, is_aisle, is_accessible)
    VALUES (2, lbl, 4, c, (c = 1 OR c = 5), (c = 2 OR c = 4), false)
    ON CONFLICT (vehicle_id, seat_label) DO NOTHING;
  END LOOP;
END $$;

-- Seed Seats for Vehicle 3 (Nissan Civilian - 22 seats: 7 rows x 3 cols + 1 rear)
DO $$
DECLARE
  r INT;
  c INT;
  lbl TEXT;
BEGIN
  FOR r IN 1..7 LOOP
    FOR c IN 1..3 LOOP
      lbl := r || CHR(64 + c);
      INSERT INTO booking.seats (vehicle_id, seat_label, row_no, col_no, is_window, is_aisle, is_accessible)
      VALUES (3, lbl, r, c, (c = 1 OR c = 3), (c = 2), (r = 1))
      ON CONFLICT (vehicle_id, seat_label) DO NOTHING;
    END LOOP;
  END LOOP;
  INSERT INTO booking.seats (vehicle_id, seat_label, row_no, col_no, is_window, is_aisle, is_accessible)
  VALUES (3, '8A', 8, 1, true, false, false)
  ON CONFLICT (vehicle_id, seat_label) DO NOTHING;
END $$;

-- 6. Seed Drivers
INSERT INTO booking.drivers (id, user_id, licence_no, company_id, active)
VALUES
  (1, 2, 'B1234567', 1, true),
  (2, 3, 'B7654321', 1, true)
ON CONFLICT (id) DO UPDATE SET licence_no = EXCLUDED.licence_no;

SELECT setval('booking.drivers_id_seq', (SELECT MAX(id) FROM booking.drivers));

-- 7. Seed Shuttle Routes (2 Routes)
INSERT INTO booking.shuttle_routes (id, company_id, name, origin_name, destination_name, distance_m, estimated_duration_s, stops_json, active)
VALUES
  (
    1, 1, 'Kaduwela Express', 'Kaduwela Interchange', 'Colombo Fort', 18500, 2700,
    '[
      {"name": "Kaduwela Interchange", "lat": 6.9315, "lng": 79.9822},
      {"name": "Malabe Junction",      "lat": 6.9042, "lng": 79.9547},
      {"name": "Battaramulla",         "lat": 6.8996, "lng": 79.9234},
      {"name": "Rajagiriya",           "lat": 6.9085, "lng": 79.8967},
      {"name": "Colombo Fort",         "lat": 6.9344, "lng": 79.8428}
    ]'::jsonb,
    true
  ),
  (
    2, 1, 'Moratuwa Coastal Line', 'Moratuwa Bus Stand', 'Colombo Fort', 21000, 3100,
    '[
      {"name": "Moratuwa Bus Stand",   "lat": 6.7731, "lng": 79.8816},
      {"name": "Ratmalana Airport Jn", "lat": 6.8219, "lng": 79.8732},
      {"name": "Mount Lavinia",        "lat": 6.8378, "lng": 79.8656},
      {"name": "Bambalapitiya",        "lat": 6.8914, "lng": 79.8557},
      {"name": "Colombo Fort",         "lat": 6.9344, "lng": 79.8428}
    ]'::jsonb,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  origin_name = EXCLUDED.origin_name,
  destination_name = EXCLUDED.destination_name,
  stops_json = EXCLUDED.stops_json;

SELECT setval('booking.shuttle_routes_id_seq', (SELECT MAX(id) FROM booking.shuttle_routes));

-- 8. Seed 10 Shuttle Trips (Morning & Evening Peak Schedules across 3 days)
INSERT INTO booking.shuttle_trips (id, route_id, vehicle_id, driver_id, depart_at, arrive_at, status, booking_cutoff_at)
VALUES
  -- Route 1 (Kaduwela Express) - 5 Trips
  (1,  1, 1, 1, now() + interval '2 hours',  now() + interval '3 hours',  'scheduled', now() + interval '90 minutes'),
  (2,  1, 2, 2, now() + interval '4 hours',  now() + interval '5 hours',  'scheduled', now() + interval '210 minutes'),
  (3,  1, 1, 1, now() + interval '8 hours',  now() + interval '9 hours',  'scheduled', now() + interval '7 hours'),
  (4,  1, 3, 2, now() + interval '12 hours', now() + interval '13 hours', 'scheduled', now() + interval '11 hours'),
  (5,  1, 1, 1, now() + interval '16 hours', now() + interval '17 hours', 'scheduled', now() + interval '15 hours'),

  -- Route 2 (Moratuwa Coastal Line) - 5 Trips
  (6,  2, 3, 2, now() + interval '2 hours 30 minutes', now() + interval '3 hours 45 minutes', 'scheduled', now() + interval '2 hours'),
  (7,  2, 1, 1, now() + interval '5 hours',            now() + interval '6 hours 15 minutes', 'scheduled', now() + interval '4 hours 30 minutes'),
  (8,  2, 2, 2, now() + interval '9 hours',            now() + interval '10 hours 15 minutes','scheduled', now() + interval '8 hours 30 minutes'),
  (9,  2, 3, 1, now() + interval '13 hours',           now() + interval '14 hours 15 minutes','scheduled', now() + interval '12 hours 30 minutes'),
  (10, 2, 1, 2, now() + interval '18 hours',           now() + interval '19 hours 15 minutes','scheduled', now() + interval '17 hours 30 minutes')
ON CONFLICT (id) DO UPDATE SET
  route_id = EXCLUDED.route_id,
  vehicle_id = EXCLUDED.vehicle_id,
  driver_id = EXCLUDED.driver_id,
  depart_at = EXCLUDED.depart_at,
  arrive_at = EXCLUDED.arrive_at,
  status = EXCLUDED.status,
  booking_cutoff_at = EXCLUDED.booking_cutoff_at;

SELECT setval('booking.shuttle_trips_id_seq', (SELECT MAX(id) FROM booking.shuttle_trips));

-- ============================================================================
-- 9. Seed Core Trips & Trip Participants (for Real-time Tracking and Safety)
-- ============================================================================
INSERT INTO core.trips (id, kind, company_id, driver_user_id, status, planned_start)
VALUES
  (1, 'shuttle', 1, 2, 'in_progress', now() - interval '20 minutes'),
  (2, 'carpool', 1, 3, 'in_progress', now() - interval '10 minutes')
ON CONFLICT (id) DO UPDATE SET
  kind = EXCLUDED.kind,
  company_id = EXCLUDED.company_id,
  driver_user_id = EXCLUDED.driver_user_id,
  status = EXCLUDED.status;

SELECT setval('core.trips_id_seq', (SELECT MAX(id) FROM core.trips));

INSERT INTO core.trip_participants (trip_id, user_id, role)
VALUES
  (1, 2, 'driver'),
  (1, 5, 'rider'),
  (1, 6, 'rider'),
  (2, 3, 'driver'),
  (2, 7, 'rider')
ON CONFLICT (trip_id, user_id) DO NOTHING;

-- ============================================================================
-- 10. Seed Safety Route Boundaries (Kaduwela Express corridor polyline)
-- ============================================================================
INSERT INTO safety.route_boundaries (trip_id, geom, mild_threshold_m, severe_threshold_m)
VALUES
  (1, ST_GeomFromText('LINESTRING(79.9832 6.9319, 79.9547 6.9042, 79.9234 6.8996, 79.8967 6.9085, 79.8428 6.9344)', 4326), 250, 1000),
  (2, ST_GeomFromText('LINESTRING(79.8816 6.7731, 79.8732 6.8219, 79.8656 6.8378, 79.8557 6.8914, 79.8428 6.9344)', 4326), 250, 1000)
ON CONFLICT (trip_id) DO UPDATE SET
  geom = EXCLUDED.geom,
  mild_threshold_m = EXCLUDED.mild_threshold_m,
  severe_threshold_m = EXCLUDED.severe_threshold_m;

-- ============================================================================
-- 11. Seed Safety Verified Corporate Users & Preferences
-- ============================================================================
INSERT INTO safety.verified_users (user_id, corporate_email, verified_at)
VALUES
  (1,  'admin@syscolabs.com',       now() - interval '30 days'),
  (2,  'driver1@syscolabs.com',     now() - interval '25 days'),
  (3,  'driver2@syscolabs.com',     now() - interval '20 days'),
  (5,  'emp1@syscolabs.com',        now() - interval '14 days'),
  (6,  'emp2@syscolabs.com',        now() - interval '10 days'),
  (7,  'emp3@syscolabs.com',        now() - interval '8 days')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO safety.safety_preferences (user_id, women_only, emergency_contact_name, emergency_contact_phone, emergency_contact_email)
VALUES
  (5, false, 'Nimal Wijesinghe', '+94771234567', 'nimal.w@gmail.com'),
  (6, false, 'Malkanthi Ranasinghe', '+94719876543', 'malkanthi.r@gmail.com'),
  (7, true,  'Priyantha Wickramasinghe', '+94705551234', 'priyantha.w@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 12. Seed Initial Live Tracking Points (Trip 1 & Trip 2)
-- ============================================================================
INSERT INTO safety.tracking_points (trip_id, user_id, geom, speed_mps, heading, accuracy_m, recorded_at)
VALUES
  (1, 2, ST_SetSRID(ST_MakePoint(79.9545, 6.9041), 4326), 11.4, 260.0, 4.2, now() - interval '2 minutes'),
  (1, 2, ST_SetSRID(ST_MakePoint(79.9412, 6.9015), 4326), 12.8, 265.0, 3.8, now() - interval '1 minute'),
  (1, 2, ST_SetSRID(ST_MakePoint(79.9235, 6.8997), 4326), 10.5, 270.0, 4.0, now()),
  (2, 3, ST_SetSRID(ST_MakePoint(79.8730, 6.8220), 4326), 14.1, 350.0, 5.1, now() - interval '1 minute'),
  (2, 3, ST_SetSRID(ST_MakePoint(79.8658, 6.8380), 4326), 13.5, 348.0, 4.9, now());
