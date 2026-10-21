/**
 * Comprehensive Endpoint Verification Test Harness
 * Tests each endpoint across all 5 modules up to Phase 2
 */
import path from 'path';
import dotenv from 'dotenv';

// Ensure shared environment is loaded first
dotenv.config({ path: path.resolve(__dirname, '../.env') });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-change-in-prod-2026!';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/corporate_shuttle';

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Module 1 imports
import { RoadGraph } from '../services/routing-engine/src/graph/graph';
import { createServer as createRoutingServer } from '../services/routing-engine/src/api/server';

// Module 2 imports
import { authRouter } from '../services/auth/src/routes/auth.routes';
import { bookingRouter } from '../services/booking/src/routes/booking.routes';

// Module 3 imports
import { walletRouter } from '../services/wallet/src/routes/wallet.routes';
import { carbonRouter } from '../services/wallet/src/routes/carbon.routes';
import { fairSplitRouter } from '../services/wallet/src/routes/fairSplit.routes';

// Module 4 imports
import { healthRouter as safetyHealthRouter } from '../services/safety/src/routes/health';
import { otpRouter as safetyOtpRouter } from '../services/safety/src/routes/otp';
import { sosRouter as safetySosRouter } from '../services/safety/src/routes/sos';
import { ticketRouter as safetyTicketRouter } from '../services/safety/src/routes/ticket';

// Module 5 imports
import { analyticsRouter } from '../services/analytics/src/routes/analytics.routes';
import { govRouter } from '../services/analytics/src/routes/gov.routes';

interface TestResult {
  module: string;
  phase: string;
  method: string;
  endpoint: string;
  expectedStatus: number;
  actualStatus: number;
  durationMs: number;
  status: 'PASSED' | 'FAILED';
  details?: string;
}

const results: TestResult[] = [];

async function recordTest(
  module: string,
  phase: string,
  method: string,
  endpoint: string,
  expectedStatus: number,
  testFn: () => Promise<request.Response>,
  validator?: (res: request.Response) => void
) {
  const start = Date.now();
  try {
    const res = await testFn();
    const durationMs = Date.now() - start;
    if (res.status === expectedStatus) {
      if (validator) {
        validator(res);
      }
      results.push({
        module,
        phase,
        method,
        endpoint,
        expectedStatus,
        actualStatus: res.status,
        durationMs,
        status: 'PASSED',
      });
      console.log(`  ✔ [${module}] [${phase}] ${method} ${endpoint} -> ${res.status} (${durationMs}ms)`);
    } else {
      results.push({
        module,
        phase,
        method,
        endpoint,
        expectedStatus,
        actualStatus: res.status,
        durationMs,
        status: 'FAILED',
        details: JSON.stringify(res.body || res.text),
      });
      console.error(`  ✖ [${module}] [${phase}] ${method} ${endpoint} -> Expected ${expectedStatus}, Got ${res.status}: ${JSON.stringify(res.body || res.text)}`);
    }
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({
      module,
      phase,
      method,
      endpoint,
      expectedStatus,
      actualStatus: 500,
      durationMs,
      status: 'FAILED',
      details: err.message,
    });
    console.error(`  ✖ [${module}] [${phase}] ${method} ${endpoint} -> Threw error: ${err.message}`);
  }
}

async function run() {
  console.log('\n================================================================');
  console.log('   EcoCommute — End-to-End API Endpoint Verification (to Phase 2)');
  console.log('================================================================\n');

  // Shared test tokens
  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-change-in-prod-2026!';
  const employeeToken = jwt.sign(
    { sub: '5', userId: 5, email: 'emp1@syscolabs.com', role: 'employee', companyId: 1, verified: true, corporateVerified: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const adminToken = jwt.sign(
    { sub: '1', userId: 1, email: 'admin@syscolabs.com', role: 'admin', companyId: 1, verified: true, corporateVerified: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const policymakerToken = jwt.sign(
    { sub: '4', userId: 4, email: 'policymaker@syscolabs.com', role: 'policymaker', companyId: 1, verified: true, corporateVerified: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // ============================================================================
  // MODULE 1: Routing Engine & Custom Navigation (Thisera WSSA - 244208R)
  // ============================================================================
  console.log('\n--- [Module 1] Routing Engine Endpoints (Phase 1 & Phase 2) ---');
  const graph = new RoadGraph();
  await graph.loadFromPostgres();
  const routingApp = createRoutingServer(graph);

  // Phase 1 endpoints
  await recordTest('Module 1', 'Phase 1', 'GET', '/health', 200, () =>
    request(routingApp).get('/health')
  );

  await recordTest('Module 1', 'Phase 1', 'POST', '/route (Dijkstra Shortest Path)', 200, () =>
    request(routingApp)
      .post('/route')
      .send({
        origin: { lat: 6.9344, lng: 79.8428 },
        destination: { lat: 6.7969, lng: 79.9018 },
        algorithm: 'dijkstra',
        mode: 'distance',
      })
  );

  await recordTest('Module 1', 'Phase 1', 'POST', '/route (Validation 400 on invalid lat)', 400, () =>
    request(routingApp)
      .post('/route')
      .send({
        origin: { lat: 999.0, lng: 79.8428 },
        destination: { lat: 6.7969, lng: 79.9018 },
      })
  );

  // Phase 2 endpoints
  await recordTest('Module 1', 'Phase 2', 'POST', '/route (A* Heuristic Shortest Path)', 200, () =>
    request(routingApp)
      .post('/route')
      .send({
        origin: { lat: 6.9344, lng: 79.8428 },
        destination: { lat: 6.7969, lng: 79.9018 },
        algorithm: 'astar',
        mode: 'distance',
      })
  );

  await recordTest('Module 1', 'Phase 2', 'POST', '/route (A* Fastest Path by Time)', 200, () =>
    request(routingApp)
      .post('/route')
      .send({
        origin: { lat: 6.9344, lng: 79.8428 },
        destination: { lat: 6.7969, lng: 79.9018 },
        algorithm: 'astar',
        mode: 'time',
      })
  );

  await recordTest('Module 1', 'Phase 1/2', 'GET', '/graph-geojson', 200, () =>
    request(routingApp).get('/graph-geojson')
  );

  await recordTest('Module 1', 'Phase 1/2', 'GET', '/openapi.json', 200, () =>
    request(routingApp).get('/openapi.json')
  );

  await recordTest('Module 1', 'Phase 2', 'POST', '/rides (Publish Ride Offer)', 201, () =>
    request(routingApp)
      .post('/rides')
      .send({
        type: 'offer',
        userId: 'driver-101',
        userName: 'Nimal Perera',
        origin: { lat: 6.9344, lng: 79.8428 },
        destination: { lat: 6.7969, lng: 79.9018 },
        seats: 3,
        womenOnly: false,
      })
  );

  await recordTest('Module 1', 'Phase 2', 'POST', '/rides (Publish Ride Request)', 201, () =>
    request(routingApp)
      .post('/rides')
      .send({
        type: 'request',
        userId: 'rider-202',
        userName: 'Sunil Silva',
        origin: { lat: 6.9271, lng: 79.8612 },
        destination: { lat: 6.8000, lng: 79.9000 },
        seats: 1,
        womenOnly: false,
      })
  );

  await recordTest('Module 1', 'Phase 2', 'GET', '/rides (List Active)', 200, () =>
    request(routingApp).get('/rides')
  );

  await recordTest('Module 1', 'Phase 2', 'GET', '/matches (Ranked Candidate Matches)', 200, () =>
    request(routingApp).get('/matches')
  );

  await recordTest('Module 1', 'Phase 2', 'POST', '/multi-stop/order (2-opt Pickup Tour)', 200, () =>
    request(routingApp)
      .post('/multi-stop/order')
      .send({
        origin: { name: 'Fort CBD', lat: 6.9344, lng: 79.8428 },
        destination: { name: 'Moratuwa UoM', lat: 6.7969, lng: 79.9018 },
        stops: [
          { name: 'Borella', lat: 6.915, lng: 79.878 },
          { name: 'Kollupitiya', lat: 6.9065, lng: 79.851 },
          { name: 'Wellawatte', lat: 6.874, lng: 79.859 },
        ],
      })
  );

  // ============================================================================
  // MODULE 2: Authentication Microservice (Chamara WPR - 234250D)
  // ============================================================================
  console.log('\n--- [Module 2] Authentication Endpoints (Phase 1 & Phase 2) ---');
  const authApp = express();
  authApp.use(express.json());
  authApp.get('/health', async (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));
  authApp.use('/auth', authRouter);

  await recordTest('Module 2 (Auth)', 'Phase 1', 'GET', '/health', 200, () =>
    request(authApp).get('/health')
  );

  const testEmail = `verify.${Date.now()}@syscolabs.com`;
  let registeredRefreshToken = '';

  await recordTest('Module 2 (Auth)', 'Phase 1', 'POST', '/auth/register (New User)', 201, async () => {
    const res = await request(authApp).post('/auth/register').send({
      email: testEmail,
      password: 'StrongPassword123!',
      fullName: 'Kamal Jayawardena',
      role: 'employee',
      gender: 'male',
    });
    if (res.body?.tokens?.refreshToken) {
      registeredRefreshToken = res.body.tokens.refreshToken;
    }
    return res;
  });

  await recordTest('Module 2 (Auth)', 'Phase 1', 'POST', '/auth/register (Validation Error 400)', 400, () =>
    request(authApp).post('/auth/register').send({
      email: 'not-an-email',
      password: 'short',
    })
  );

  await recordTest('Module 2 (Auth)', 'Phase 1', 'POST', '/auth/register (Duplicate Email 409)', 409, () =>
    request(authApp).post('/auth/register').send({
      email: testEmail,
      password: 'StrongPassword123!',
      fullName: 'Kamal Duplicate',
    })
  );

  await recordTest('Module 2 (Auth)', 'Phase 1', 'POST', '/auth/login (Success 200)', 200, () =>
    request(authApp).post('/auth/login').send({
      email: testEmail,
      password: 'StrongPassword123!',
    })
  );

  await recordTest('Module 2 (Auth)', 'Phase 1', 'POST', '/auth/login (Invalid Password 401)', 401, () =>
    request(authApp).post('/auth/login').send({
      email: testEmail,
      password: 'WrongPassword!',
    })
  );

  if (registeredRefreshToken) {
    await recordTest('Module 2 (Auth)', 'Phase 1', 'POST', '/auth/refresh (Token Rotation 200)', 200, () =>
      request(authApp).post('/auth/refresh').send({
        refreshToken: registeredRefreshToken,
      })
    );
  }

  await recordTest('Module 2 (Auth)', 'Phase 1', 'GET', '/auth/me (Authenticated User)', 200, () =>
    request(authApp).get('/auth/me').set('Authorization', `Bearer ${employeeToken}`)
  );

  await recordTest('Module 2 (Auth)', 'Phase 1', 'GET', '/auth/me (Unauthorized 401)', 401, () =>
    request(authApp).get('/auth/me')
  );

  // ============================================================================
  // MODULE 2: Booking Microservice (Chamara WPR - 234250D)
  // ============================================================================
  console.log('\n--- [Module 2] Booking & Fleet Endpoints (Phase 1 & Phase 2) ---');
  const bookingApp = express();
  bookingApp.use(express.json());
  bookingApp.get('/health', async (_req, res) => res.json({ status: 'ok', service: 'booking-service' }));
  bookingApp.use('/', bookingRouter);

  await recordTest('Module 2 (Booking)', 'Phase 1', 'GET', '/health', 200, () =>
    request(bookingApp).get('/health')
  );

  let firstTripId = 1;
  await recordTest('Module 2 (Booking)', 'Phase 1', 'GET', '/trips (Trip Search)', 200, async () => {
    const res = await request(bookingApp).get('/trips?seatsNeeded=1');
    if (res.body?.trips?.length > 0) {
      firstTripId = res.body.trips[0].id;
    }
    return res;
  });

  await recordTest('Module 2 (Booking)', 'Phase 1', 'GET', `/trips/:id (Detail & Seat Matrix)`, 200, () =>
    request(bookingApp).get(`/trips/${firstTripId}`)
  );

  await recordTest('Module 2 (Booking)', 'Phase 1', 'GET', '/vehicles (Fleet List)', 200, () =>
    request(bookingApp).get('/vehicles')
  );

  const testPlate = `NA-${Math.floor(1000 + Math.random() * 9000)}`;
  let createdVehicleId = 0;
  await recordTest('Module 2 (Booking)', 'Phase 1', 'POST', '/vehicles (Admin Create)', 201, async () => {
    const res = await request(bookingApp)
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plateNo: testPlate,
        type: 'Toyota HiAce Luxury',
        capacity: 14,
        seatLayoutJson: { rows: 4, cols: 4, aisles: [2] },
      });
    if (res.body?.vehicle?.id) {
      createdVehicleId = res.body.vehicle.id;
    }
    return res;
  });

  if (createdVehicleId) {
    await recordTest('Module 2 (Booking)', 'Phase 1', 'PATCH', '/vehicles/:id (Admin Update)', 200, () =>
      request(bookingApp)
        .patch(`/vehicles/${createdVehicleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          active: true,
          type: 'Toyota HiAce Premium',
        })
    );
  }

  // Schedule a trip for booking test
  const futureDepart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const futureArrive = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
  const futureCutoff = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  let createdTripId = 0;

  await recordTest('Module 2 (Booking)', 'Phase 1', 'POST', '/trips (Admin Schedule)', 201, async () => {
    const res = await request(bookingApp)
      .post('/trips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        routeId: 1,
        vehicleId: 1,
        departAt: futureDepart,
        arriveAt: futureArrive,
        bookingCutoffAt: futureCutoff,
      });
    if (res.body?.trip?.id) {
      createdTripId = res.body.trip.id;
    }
    return res;
  });

  const bookingTripTarget = createdTripId || firstTripId;
  const idemKey = `idem-${Date.now()}-${Math.random()}`;
  let createdBookingId = 0;

  // Dedicated commuter token for this trip (user 5 from core.users)
  const bookingCommuterId = 5;
  const bookingCommuterToken = jwt.sign(
    { sub: String(bookingCommuterId), userId: bookingCommuterId, email: 'emp1@syscolabs.com', role: 'employee', companyId: 1, verified: true },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  await recordTest('Module 2 (Booking)', 'Phase 1/2', 'POST', '/trips/:id/bookings (Seat Allocation)', 201, async () => {
    const res = await request(bookingApp)
      .post(`/trips/${bookingTripTarget}/bookings`)
      .set('Authorization', `Bearer ${bookingCommuterToken}`)
      .set('Idempotency-Key', idemKey)
      .send({ partySize: 1 });
    if (res.body?.booking?.id) {
      createdBookingId = res.body.booking.id;
    }
    return res;
  });

  // Idempotent Replay (Phase 2 RFC replay shield)
  await recordTest('Module 2 (Booking)', 'Phase 2', 'POST', '/trips/:id/bookings (Idempotent Replay 200)', 200, () =>
    request(bookingApp)
      .post(`/trips/${bookingTripTarget}/bookings`)
      .set('Authorization', `Bearer ${bookingCommuterToken}`)
      .set('Idempotency-Key', idemKey)
      .send({ partySize: 1 })
  );

  // Idempotency mismatch (Phase 2 RFC shield)
  await recordTest('Module 2 (Booking)', 'Phase 2', 'POST', '/trips/:id/bookings (Idempotency Mismatch 422)', 422, () =>
    request(bookingApp)
      .post(`/trips/${bookingTripTarget}/bookings`)
      .set('Authorization', `Bearer ${bookingCommuterToken}`)
      .set('Idempotency-Key', idemKey)
      .send({ partySize: 2 })
  );

  await recordTest('Module 2 (Booking)', 'Phase 1', 'GET', '/bookings/me (Current User Bookings)', 200, () =>
    request(bookingApp)
      .get('/bookings/me')
      .set('Authorization', `Bearer ${bookingCommuterToken}`)
  );

  if (createdBookingId) {
    await recordTest('Module 2 (Booking)', 'Phase 1', 'GET', '/bookings/:id (Booking Details)', 200, () =>
      request(bookingApp)
        .get(`/bookings/${createdBookingId}`)
        .set('Authorization', `Bearer ${bookingCommuterToken}`)
    );

    await recordTest('Module 2 (Booking)', 'Phase 1', 'DELETE', '/bookings/:id (Cancel Booking)', 200, () =>
      request(bookingApp)
        .delete(`/bookings/${createdBookingId}`)
        .set('Authorization', `Bearer ${bookingCommuterToken}`)
    );
  }

  // ============================================================================
  // MODULE 3: Wallet & Carbon Accounting (Zainy TNS - 244236B)
  // ============================================================================
  console.log('\n--- [Module 3] Wallet, Carbon & Fair-Split Endpoints (Phase 1 & Phase 2) ---');
  const walletApp = express();
  walletApp.use(express.json());
  walletApp.get('/health', async (_req, res) => res.json({ status: 'ok', service: 'wallet-carbon-service' }));
  walletApp.use('/wallet', walletRouter);
  walletApp.use('/carbon', carbonRouter);
  walletApp.use('/fair-split', fairSplitRouter);

  await recordTest('Module 3', 'Phase 1', 'GET', '/health', 200, () =>
    request(walletApp).get('/health')
  );

  await recordTest('Module 3', 'Phase 1', 'GET', '/carbon/factors (DEFRA 2024 Lookup)', 200, () =>
    request(walletApp).get('/carbon/factors')
  );

  await recordTest('Module 3', 'Phase 1', 'GET', '/carbon/prices (CPC Fuel Prices)', 200, () =>
    request(walletApp).get('/carbon/prices')
  );

  await recordTest('Module 3', 'Phase 1', 'POST', '/carbon/calculate (Trip Fuel & CO2)', 200, () =>
    request(walletApp)
      .post('/carbon/calculate')
      .send({
        distanceKm: 28.5,
        kmPerLitre: 12.0,
        fuelTypeCode: 'PETROL_92',
        priceMinorPerLitre: 33200,
      })
  );

  await recordTest('Module 3', 'Phase 2', 'POST', '/carbon/avoided (Avoided CO2 vs Solo Baseline)', 200, () =>
    request(walletApp)
      .post('/carbon/avoided')
      .send({
        actualTrip: {
          distanceKm: 30.0,
          kmPerLitre: 12.0,
          fuelTypeCode: 'PETROL_92',
          passengerCount: 2,
        },
        driverSoloDistanceKm: 25.0,
        passengers: [
          { userId: 101, soloDistanceKm: 22.0, soloFuelTypeCode: 'PETROL_92', soloKmPerLitre: 10.0 },
          { userId: 102, soloDistanceKm: 18.0, soloFuelTypeCode: 'AUTO_DIESEL', soloKmPerLitre: 14.0 },
        ],
      })
  );

  await recordTest('Module 3', 'Phase 2', 'POST', '/fair-split/calculate (Hamilton-Hare Detour Split)', 200, () =>
    request(walletApp)
      .post('/fair-split/calculate')
      .send({
        totalTripCostMinor: 48500,
        driverSoloCostMinor: 20000,
        passengers: [
          { userId: 201, marginalDetourKm: 3.2 },
          { userId: 202, marginalDetourKm: 5.8 },
          { userId: 203, marginalDetourKm: 1.1 },
        ],
      })
  );

  await recordTest('Module 3', 'Phase 2', 'POST', '/fair-split/shapley-compare (Exact Game Split)', 200, () =>
    request(walletApp)
      .post('/fair-split/shapley-compare')
      .send({
        numPassengers: 3,
        coalitionCosts: {
          '0': 1500,
          '1': 1800,
          '2': 2100,
          '0,1': 2400,
          '0,2': 2600,
          '1,2': 2900,
          '0,1,2': 3300,
        },
      })
  );

  await recordTest('Module 3', 'Phase 1', 'GET', '/wallet/balance (Balance Inquiry)', 200, () =>
    request(walletApp)
      .get('/wallet/balance')
      .set('Authorization', `Bearer ${employeeToken}`)
  );

  await recordTest('Module 3', 'Phase 1', 'GET', '/wallet/transactions (Ledger History)', 200, () =>
    request(walletApp)
      .get('/wallet/transactions')
      .set('Authorization', `Bearer ${employeeToken}`)
  );

  await recordTest('Module 3', 'Phase 1', 'POST', '/wallet/topup (Corporate Top-up)', 201, () =>
    request(walletApp)
      .post('/wallet/topup')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        amountMinor: 250000,
        idempotencyKey: `topup-${Date.now()}-${Math.random()}`,
      })
  );

  await recordTest('Module 3', 'Phase 2', 'POST', '/wallet/settle-trip (Double-Entry Settlement)', 200, () =>
    request(walletApp)
      .post('/wallet/settle-trip')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        tripId: 9999,
        driverUserId: 1,
        passengerSplits: [
          { userId: 2, shareMinor: 15000 },
          { userId: 3, shareMinor: 18000 },
        ],
      })
  );

  // ============================================================================
  // MODULE 4: Safety & Telematics (Amaraweera MTP - 244015X)
  // ============================================================================
  console.log('\n--- [Module 4] Safety, OTP & Real-Time Tracking Endpoints (Phase 1 & Phase 2) ---');
  const safetyApp = express();
  safetyApp.use(express.json());
  safetyApp.use('/', safetyHealthRouter);
  safetyApp.use('/safety/otp', safetyOtpRouter);
  safetyApp.use('/safety/sos', safetySosRouter);
  safetyApp.use('/safety', safetyTicketRouter);

  await recordTest('Module 4', 'Phase 1', 'GET', '/healthz (Liveness Probe)', 200, () =>
    request(safetyApp).get('/healthz')
  );

  await recordTest('Module 4', 'Phase 1', 'GET', '/readyz (Readiness Probe)', 200, () =>
    request(safetyApp).get('/readyz')
  );

  const otpTestEmail = `safety.test.${Date.now()}@syscolabs.com`;
  await recordTest('Module 4', 'Phase 1', 'POST', '/safety/otp/request (Generate 6-Digit OTP)', 200, () =>
    request(safetyApp)
      .post('/safety/otp/request')
      .send({ email: otpTestEmail })
  );

  await recordTest('Module 4', 'Phase 1', 'POST', '/safety/otp/request (Reject Unauthorized Domain 400)', 400, () =>
    request(safetyApp)
      .post('/safety/otp/request')
      .send({ email: 'intruder@gmail.com' })
  );

  await recordTest('Module 4', 'Phase 1', 'POST', '/safety/otp/confirm (Reject Wrong Code 400)', 400, () =>
    request(safetyApp)
      .post('/safety/otp/confirm')
      .send({ email: otpTestEmail, otp: '000000' })
  );

  await recordTest('Module 4', 'Phase 1', 'POST', '/safety/ticket (30s Single-Use WS Ticket)', 201, () =>
    request(safetyApp)
      .post('/safety/ticket')
      .set('Authorization', `Bearer ${employeeToken}`)
  );

  let sosEventId = 0;
  await recordTest('Module 4', 'Phase 2', 'POST', '/safety/sos (Trigger Emergency SOS)', 201, async () => {
    const res = await request(safetyApp)
      .post('/safety/sos')
      .set('Authorization', `Bearer ${employeeToken}`)
      .send({
        tripId: 1,
        lat: 6.9065,
        lng: 79.851,
        note: 'Vehicle tyre blowout along Galle Road',
      });
    if (res.body?.event?.id) {
      sosEventId = res.body.event.id;
    }
    return res;
  });

  if (sosEventId) {
    await recordTest('Module 4', 'Phase 2', 'POST', '/safety/sos/:id/ack (Acknowledge SOS Event)', 200, () =>
      request(safetyApp)
        .post(`/safety/sos/${sosEventId}/ack`)
        .set('Authorization', `Bearer ${adminToken}`)
    );

    await recordTest('Module 4', 'Phase 2', 'POST', '/safety/sos/:id/resolve (Resolve SOS Event)', 200, () =>
      request(safetyApp)
        .post(`/safety/sos/${sosEventId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ note: 'Tow vehicle dispatched. All passengers transferred safely.' })
    );
  }

  // ============================================================================
  // MODULE 5: Analytics & Privacy Engine (Kulapputhanthri AJ - 244108K)
  // ============================================================================
  console.log('\n--- [Module 5] Analytics, ESG & Privacy Endpoints (Phase 1 & Phase 2) ---');
  const analyticsApp = express();
  analyticsApp.use(express.json());
  analyticsApp.get('/health', async (_req, res) => res.json({ status: 'ok', service: 'analytics-privacy-service' }));
  analyticsApp.use('/analytics', analyticsRouter);
  analyticsApp.use('/gov', govRouter);

  await recordTest('Module 5', 'Phase 1', 'GET', '/health', 200, () =>
    request(analyticsApp).get('/health')
  );

  await recordTest('Module 5', 'Phase 1', 'GET', '/analytics/summary (ESG KPI Cards)', 200, () =>
    request(analyticsApp)
      .get('/analytics/summary')
      .set('Authorization', `Bearer ${adminToken}`)
  );

  await recordTest('Module 5', 'Phase 1', 'GET', '/analytics/by-department (Department Carbon Breakdown)', 200, () =>
    request(analyticsApp)
      .get('/analytics/by-department')
      .set('Authorization', `Bearer ${adminToken}`)
  );

  await recordTest('Module 5', 'Phase 2', 'GET', '/analytics/timeseries (Daily / Monthly Trends)', 200, () =>
    request(analyticsApp)
      .get('/analytics/timeseries?granularity=day')
      .set('Authorization', `Bearer ${adminToken}`)
  );

  await recordTest('Module 5', 'Phase 2', 'GET', '/analytics/by-zone (Zone Flow Aggregates)', 200, () =>
    request(analyticsApp)
      .get('/analytics/by-zone')
      .set('Authorization', `Bearer ${adminToken}`)
  );

  await recordTest('Module 5', 'Phase 2', 'GET', '/analytics/export (JSON Analytical Export)', 200, () =>
    request(analyticsApp)
      .get('/analytics/export?format=json')
      .set('Authorization', `Bearer ${adminToken}`)
  );

  await recordTest('Module 5', 'Phase 2', 'GET', '/analytics/export (CSV Scope 3 ESG Export)', 200, () =>
    request(analyticsApp)
      .get('/analytics/export?format=csv')
      .set('Authorization', `Bearer ${adminToken}`)
  );

  await recordTest('Module 5', 'Phase 2', 'GET', '/gov/budget (Policymaker Privacy Budget Status)', 200, () =>
    request(analyticsApp)
      .get('/gov/budget')
      .set('Authorization', `Bearer ${policymakerToken}`)
  );

  await recordTest('Module 5', 'Phase 2', 'GET', '/gov/noise-profile (Theoretical Noise Profile Visualizer)', 200, () =>
    request(analyticsApp)
      .get('/gov/noise-profile?epsilon=0.5&sensitivity=2.0')
      .set('Authorization', `Bearer ${policymakerToken}`)
  );

  await recordTest('Module 5', 'Phase 2', 'GET', '/gov/flows (Differentially Private Commute Flows)', 200, () =>
    request(analyticsApp)
      .get('/gov/flows?epsilon=0.5&k=5')
      .set('Authorization', `Bearer ${policymakerToken}`)
  );

  // ============================================================================
  // SUMMARY REPORT
  // ============================================================================
  console.log('\n================================================================');
  console.log('                 FINAL TEST VERIFICATION SUMMARY                ');
  console.log('================================================================');

  const total = results.length;
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;

  console.log(`\nTotal Endpoints Tested: ${total}`);
  console.log(`Passed:                 ${passed} / ${total} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed:                 ${failed} / ${total}\n`);

  // Group by Module
  const modules = Array.from(new Set(results.map((r) => r.module)));
  for (const mod of modules) {
    const modResults = results.filter((r) => r.module === mod);
    const modPassed = modResults.filter((r) => r.status === 'PASSED').length;
    console.log(`  • ${mod.padEnd(20)}: ${modPassed}/${modResults.length} endpoints working`);
  }

  // Group by Phase
  const phases = Array.from(new Set(results.map((r) => r.phase)));
  for (const ph of phases) {
    const phResults = results.filter((r) => r.phase === ph);
    const phPassed = phResults.filter((r) => r.status === 'PASSED').length;
    console.log(`  • Phase ${ph.padEnd(16)}: ${phPassed}/${phResults.length} endpoints working`);
  }

  if (failed > 0) {
    console.log('\nFailed Tests:');
    for (const r of results.filter((r) => r.status === 'FAILED')) {
      console.log(`  - [${r.module}] ${r.method} ${r.endpoint}: ${r.details}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL ENDPOINTS UP TO PHASE 2 ARE VERIFIED WORKING PERFECTLY!\n');
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
