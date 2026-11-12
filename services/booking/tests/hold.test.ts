import request from 'supertest';
import express from 'express';
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

describe('M2-07: Temporary Seat Holds Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('Creates temporary seat hold with server-authoritative 5 min expiry (201)', async () => {
    const token = makeToken(50);
    const futureCutoff = new Date(Date.now() + 3600000).toISOString();
    const expiryDate = new Date(Date.now() + 300000).toISOString();

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/booking\.shuttle_trips/i.test(sql)) {
          return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled', booking_cutoff_at: futureCutoff }] };
        }
        if (/booking\.bookings/i.test(sql)) {
          return { rows: [] };
        }
        if (/SELECT id, expires_at FROM booking\.holds/i.test(sql)) {
          return { rows: [] }; // No active hold
        }
        if (/UPDATE booking\.(holds|seat_holds)/i.test(sql)) {
          return { rows: [], rowCount: 0 };
        }
        if (/booking\.vehicles/i.test(sql)) {
          return { rows: [{ seat_layout_json: { rows: 10, cols: 3, aisleAfterCol: 2 } }] };
        }
        if (/booking\.seats/i.test(sql)) {
          return {
            rows: [
              { id: 101, vehicle_id: 1, seat_label: '1A', row_no: 1, col_no: 1, is_window: true, is_aisle: false, is_accessible: false, is_available: true },
              { id: 102, vehicle_id: 1, seat_label: '1B', row_no: 1, col_no: 2, is_window: false, is_aisle: true, is_accessible: false, is_available: true },
            ],
          };
        }
        if (/INSERT INTO booking\.holds/i.test(sql)) {
          return {
            rows: [{
              id: 701,
              trip_id: 1,
              user_id: 50,
              party_size: 2,
              status: 'held',
              expires_at: expiryDate,
              created_at: new Date().toISOString(),
            }],
          };
        }
        if (/INSERT INTO booking\.seat_holds/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .post('/trips/1/holds')
      .set('Authorization', `Bearer ${token}`)
      .send({ partySize: 2 });

    expect(res.status).toBe(201);
    expect(res.body.hold.id).toBe(701);
    expect(res.body.hold.status).toBe('held');
    expect(res.body.hold.seatIds).toEqual([101, 102]);
    expect(res.body.hold.expiresInSeconds).toBeGreaterThan(250);
  });

  test('Rejects duplicate hold creation when user already has active hold (409 ACTIVE_HOLD_EXISTS)', async () => {
    const token = makeToken(51);
    const futureCutoff = new Date(Date.now() + 3600000).toISOString();

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/booking\.shuttle_trips/i.test(sql)) {
          return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled', booking_cutoff_at: futureCutoff }] };
        }
        if (/booking\.bookings/i.test(sql)) {
          return { rows: [] };
        }
        if (/SELECT id, expires_at FROM booking\.holds/i.test(sql)) {
          return { rows: [{ id: 702, expires_at: new Date(Date.now() + 200000).toISOString() }] };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .post('/trips/1/holds')
      .set('Authorization', `Bearer ${token}`)
      .send({ partySize: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACTIVE_HOLD_EXISTS');
  });

  test('Confirms active hold into confirmed booking (200)', async () => {
    const token = makeToken(52);
    const futureExpiry = new Date(Date.now() + 240000).toISOString();

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/booking\.shuttle_trips.*FOR UPDATE/i.test(sql)) {
          return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled' }] };
        }
        if (/SELECT.*FROM booking\.holds.*WHERE.*id = \$1.*FOR UPDATE/i.test(sql)) {
          return {
            rows: [{
              id: 703,
              trip_id: 1,
              user_id: 52,
              party_size: 1,
              status: 'held',
              expires_at: futureExpiry,
              booking_id: null,
            }],
          };
        }
        if (/SELECT seat_id FROM booking\.seat_holds/i.test(sql)) {
          return { rows: [{ seat_id: 105 }] };
        }
        if (/INSERT INTO booking\.bookings/i.test(sql)) {
          return {
            rows: [{
              id: 801,
              trip_id: 1,
              user_id: 52,
              party_size: 1,
              status: 'confirmed',
              created_at: new Date().toISOString(),
            }],
          };
        }
        if (/INSERT INTO booking\.seat_assignments/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        if (/UPDATE booking\.holds SET status = 'confirmed'/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        if (/UPDATE booking\.seat_holds SET status = 'confirmed'/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        if (/INSERT INTO booking\.booking_audit/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .post('/trips/1/holds/703/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.booking.id).toBe(801);
    expect(res.body.booking.status).toBe('confirmed');
    expect(res.body.booking.assignedSeatIds).toEqual([105]);
  });

  test('Rejects confirmation if hold has expired (409 HOLD_EXPIRED)', async () => {
    const token = makeToken(53);
    const pastExpiry = new Date(Date.now() - 10000).toISOString(); // Expired 10s ago

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/booking\.shuttle_trips.*FOR UPDATE/i.test(sql)) {
          return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled' }] };
        }
        if (/SELECT.*FROM booking\.holds.*WHERE.*id = \$1.*FOR UPDATE/i.test(sql)) {
          return {
            rows: [{
              id: 704,
              trip_id: 1,
              user_id: 53,
              party_size: 1,
              status: 'held',
              expires_at: pastExpiry,
              booking_id: null,
            }],
          };
        }
        if (/UPDATE booking\.(holds|seat_holds).*status = 'expired'/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .post('/trips/1/holds/704/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('HOLD_EXPIRED');
  });

  test('Releases hold early with DELETE /trips/:id/holds/:holdId (200)', async () => {
    const token = makeToken(54);

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/SELECT.*FROM booking\.holds.*FOR UPDATE/i.test(sql)) {
          return { rows: [{ id: 705, user_id: 54, status: 'held' }] };
        }
        if (/UPDATE booking\.(holds|seat_holds).*SET status = 'released'/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .delete('/trips/1/holds/705')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Hold successfully released');
  });
});

