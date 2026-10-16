import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { bookingRouter } from '../src/routes/booking.routes';
import { pool } from '../src/db/pool';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/', bookingRouter);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-change-in-prod-2026!';

function makeToken(userId: number, role: 'employee' | 'driver' | 'admin' | 'policymaker' = 'employee') {
  return jwt.sign(
    {
      sub: userId.toString(),
      userId,
      email: `user${userId}@syscolabs.com`,
      role,
      companyId: 1,
      corporateVerified: true,
      verified: true,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Module 2 - Booking Service Tests (Interim Step 1.5)', () => {
  afterAll(async () => {
    await pool.end();
  });

  describe('Party Size Constraints (Validation & chk_party)', () => {
    test('Zero party size is rejected with 400', async () => {
      const token = makeToken(1);
      const res = await request(app)
        .post('/trips/1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ partySize: 0 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.partySize).toBeDefined();
    });

    test('Negative party size is rejected with 400', async () => {
      const token = makeToken(1);
      const res = await request(app)
        .post('/trips/1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ partySize: -2 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.partySize).toBeDefined();
    });

    test('Party size > 6 is rejected with 400 (chk_party limit)', async () => {
      const token = makeToken(1);
      const res = await request(app)
        .post('/trips/1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ partySize: 7 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.partySize).toBeDefined();
    });
  });

  describe('Cutoff Time Enforcements', () => {
    test('Booking after booking_cutoff_at is rejected with 409 CUTOFF_PASSED', async () => {
      const token = makeToken(2);
      const pastCutoff = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{
              id: 1,
              vehicle_id: 1,
              status: 'scheduled',
              booking_cutoff_at: pastCutoff,
            }],
          }) // SELECT trip
          .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
        release: jest.fn(),
      };

      (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

      const res = await request(app)
        .post('/trips/1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ partySize: 1 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CUTOFF_PASSED');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Capacity & Last Seat Enforcements', () => {
    test('Exact capacity: booking remaining N seats of N succeeds', async () => {
      const token = makeToken(3);
      const futureCutoff = new Date(Date.now() + 3600000).toISOString();

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 1, vehicle_id: 1, status: 'scheduled', booking_cutoff_at: futureCutoff }],
          }) // SELECT trip
          .mockResolvedValueOnce({ rows: [] }) // active booking check (none)
          .mockResolvedValueOnce({
            rows: [{ id: 101 }, { id: 102 }],
          }) // available seats (exactly 2 seats available)
          .mockResolvedValueOnce({
            rows: [{ id: 50, trip_id: 1, user_id: 3, party_size: 2, status: 'confirmed', created_at: new Date().toISOString() }],
          }) // insert booking
          .mockResolvedValueOnce({ rows: [] }) // insert seat 101
          .mockResolvedValueOnce({ rows: [] }) // insert seat 102
          .mockResolvedValueOnce({ rows: [] }) // insert audit
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };

      (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

      const res = await request(app)
        .post('/trips/1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ partySize: 2 });

      expect(res.status).toBe(201);
      expect(res.body.booking.partySize).toBe(2);
      expect(res.body.booking.assignedSeatIds).toEqual([101, 102]);
    });

    test('Exceeding capacity: booking N+1 when only N are available is rejected with 409 INSUFFICIENT_CAPACITY', async () => {
      const token = makeToken(4);
      const futureCutoff = new Date(Date.now() + 3600000).toISOString();

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 1, vehicle_id: 1, status: 'scheduled', booking_cutoff_at: futureCutoff }],
          }) // SELECT trip
          .mockResolvedValueOnce({ rows: [] }) // active booking check (none)
          .mockResolvedValueOnce({
            rows: [{ id: 101 }], // only 1 seat available, but partySize is 3
          })
          .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
        release: jest.fn(),
      };

      (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

      const res = await request(app)
        .post('/trips/1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ partySize: 3 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INSUFFICIENT_CAPACITY');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('Last seat: booking 1 seat when exactly 1 seat remains succeeds', async () => {
      const token = makeToken(5);
      const futureCutoff = new Date(Date.now() + 3600000).toISOString();

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 1, vehicle_id: 1, status: 'scheduled', booking_cutoff_at: futureCutoff }],
          }) // SELECT trip
          .mockResolvedValueOnce({ rows: [] }) // active booking check (none)
          .mockResolvedValueOnce({
            rows: [{ id: 999 }], // exactly 1 seat
          })
          .mockResolvedValueOnce({
            rows: [{ id: 51, trip_id: 1, user_id: 5, party_size: 1, status: 'confirmed', created_at: new Date().toISOString() }],
          }) // insert booking
          .mockResolvedValueOnce({ rows: [] }) // insert seat 999
          .mockResolvedValueOnce({ rows: [] }) // insert audit
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };

      (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

      const res = await request(app)
        .post('/trips/1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ partySize: 1 });

      expect(res.status).toBe(201);
      expect(res.body.booking.partySize).toBe(1);
      expect(res.body.booking.assignedSeatIds).toEqual([999]);
    });
  });

  describe('Duplicate Bookings & Idempotency', () => {
    test('User with existing active booking is rejected with 409 DUPLICATE_BOOKING', async () => {
      const token = makeToken(6);
      const futureCutoff = new Date(Date.now() + 3600000).toISOString();

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 1, vehicle_id: 1, status: 'scheduled', booking_cutoff_at: futureCutoff }],
          })
          .mockResolvedValueOnce({
            rows: [{ id: 42 }], // Existing active booking found
          })
          .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
        release: jest.fn(),
      };

      (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

      const res = await request(app)
        .post('/trips/1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ partySize: 1 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('DUPLICATE_BOOKING');
      expect(res.body.error.details.existingBookingId).toBe(42);
    });

    test('Idempotency replay returns cached response', async () => {
      const token = makeToken(7);
      const cachedResponse = {
        booking: {
          id: 77,
          tripId: 1,
          userId: 7,
          partySize: 1,
          status: 'confirmed',
          assignedSeatIds: [5],
        },
      };

      const body = { partySize: 1 };
      const bodyHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');

      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{
              response_json: cachedResponse,
              request_hash: bodyHash,
            }],
          }) // Idempotency check hit
          .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
        release: jest.fn(),
      };

      (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

      const res = await request(app)
        .post('/trips/1/bookings')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(cachedResponse);
    });
  });

  describe('Cancellation', () => {
    test('Non-owner cannot cancel another user booking (403 FORBIDDEN)', async () => {
      const token = makeToken(8); // user 8
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 100, user_id: 99, trip_id: 1, status: 'confirmed' }], // belongs to user 99
          })
          .mockResolvedValueOnce({ rows: [] }), // ROLLBACK
        release: jest.fn(),
      };

      (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

      const res = await request(app)
        .delete('/bookings/100')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('Booking owner successfully cancels booking (200 OK)', async () => {
      const token = makeToken(9); // user 9
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 105, user_id: 9, trip_id: 1, status: 'confirmed' }],
          })
          .mockResolvedValueOnce({ rows: [] }) // release seats
          .mockResolvedValueOnce({ rows: [] }) // update booking
          .mockResolvedValueOnce({ rows: [] }) // insert audit
          .mockResolvedValueOnce({ rows: [] }), // COMMIT
        release: jest.fn(),
      };

      (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

      const res = await request(app)
        .delete('/bookings/105')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
