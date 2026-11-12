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

describe('M2-05: FIFO Waitlist Management Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('Joining waitlist requires authentication (401)', async () => {
    const res = await request(app).post('/trips/1/waitlist').send({ partySize: 1 });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('Rejects invalid party size (< 1 or > 6) with 400 VALIDATION_ERROR', async () => {
    const token = makeToken(20);
    const res = await request(app)
      .post('/trips/1/waitlist')
      .set('Authorization', `Bearer ${token}`)
      .send({ partySize: 8 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('User successfully joins waitlist and receives FIFO position (201)', async () => {
    const token = makeToken(21);
    const futureCutoff = new Date(Date.now() + 3600000).toISOString();

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/booking\.shuttle_trips/i.test(sql)) {
          return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled', booking_cutoff_at: futureCutoff }] };
        }
        if (/booking\.bookings/i.test(sql)) {
          return { rows: [] }; // No active booking
        }
        if (/SELECT.*FROM booking\.waitlist_entries.*WHERE.*status = 'waiting'/i.test(sql)) {
          return { rows: [] }; // No existing waitlist entry
        }
        if (/INSERT INTO booking\.waitlist_entries/i.test(sql)) {
          return {
            rows: [{
              id: 301,
              trip_id: 1,
              user_id: 21,
              party_size: 2,
              status: 'waiting',
              created_at: new Date().toISOString(),
            }],
          };
        }
        if (/SELECT COUNT\(\*\) AS position/i.test(sql)) {
          return { rows: [{ position: '3' }] }; // e.g. 3rd in queue
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .post('/trips/1/waitlist')
      .set('Authorization', `Bearer ${token}`)
      .send({ partySize: 2 });

    expect(res.status).toBe(201);
    expect(res.body.waitlist.id).toBe(301);
    expect(res.body.waitlist.partySize).toBe(2);
    expect(res.body.waitlist.status).toBe('waiting');
    expect(res.body.waitlist.position).toBe(3);
  });

  test('Rejects duplicate waitlist join if user already waiting on trip (409 DUPLICATE_WAITLIST)', async () => {
    const token = makeToken(22);
    const futureCutoff = new Date(Date.now() + 3600000).toISOString();

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/booking\.shuttle_trips/i.test(sql)) {
          return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled', booking_cutoff_at: futureCutoff }] };
        }
        if (/booking\.bookings/i.test(sql)) {
          return { rows: [] };
        }
        if (/SELECT.*FROM booking\.waitlist_entries.*WHERE.*status = 'waiting'/i.test(sql)) {
          return { rows: [{ id: 302 }] }; // Already waiting!
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .post('/trips/1/waitlist')
      .set('Authorization', `Bearer ${token}`)
      .send({ partySize: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_WAITLIST');
  });

  test('Rejects waitlist join if user already holds confirmed booking on trip (409 ALREADY_BOOKED)', async () => {
    const token = makeToken(23);
    const futureCutoff = new Date(Date.now() + 3600000).toISOString();

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/booking\.shuttle_trips/i.test(sql)) {
          return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled', booking_cutoff_at: futureCutoff }] };
        }
        if (/booking\.bookings/i.test(sql)) {
          return { rows: [{ id: 501 }] }; // Already has confirmed booking!
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .post('/trips/1/waitlist')
      .set('Authorization', `Bearer ${token}`)
      .send({ partySize: 1 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_BOOKED');
  });

  test('Retrieves own active waitlist entry and position with GET /trips/:id/waitlist/me (200)', async () => {
    const token = makeToken(24);
    const querySpy = jest.spyOn(pool, 'query') as any;
    querySpy.mockResolvedValueOnce({
      rows: [{
        id: 305,
        trip_id: 1,
        user_id: 24,
        party_size: 1,
        status: 'waiting',
        created_at: new Date().toISOString(),
        position: '2',
        booking_id: null,
      }],
    });

    const res = await request(app)
      .get('/trips/1/waitlist/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.waitlist.id).toBe(305);
    expect(res.body.waitlist.position).toBe(2);
  });

  test('Leaves/withdraws from waitlist with DELETE /trips/:id/waitlist/me (200)', async () => {
    const token = makeToken(25);

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (/SELECT.*FROM booking\.waitlist_entries.*FOR UPDATE/i.test(sql)) {
          return { rows: [{ id: 309, status: 'waiting' }] };
        }
        if (/UPDATE booking\.waitlist_entries.*SET status = 'cancelled'/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .delete('/trips/1/waitlist/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Successfully left');
  });

  test('Lists all user active waitlist entries with GET /waitlist/me (200)', async () => {
    const token = makeToken(26);
    const querySpy = jest.spyOn(pool, 'query') as any;
    querySpy.mockResolvedValueOnce({
      rows: [{
        id: 310,
        trip_id: 1,
        party_size: 2,
        status: 'waiting',
        created_at: new Date().toISOString(),
        booking_id: null,
        depart_at: new Date().toISOString(),
        arrive_at: new Date().toISOString(),
        route_name: 'Colombo - Malabe Express',
        origin_name: 'Colombo Fort',
        destination_name: 'Malabe IT Park',
        plate_no: 'WP-NC-1234',
        vehicle_type: 'Coaster',
        position: '1',
      }],
    });

    const res = await request(app)
      .get('/waitlist/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.waitlist.length).toBe(1);
    expect(res.body.waitlist[0].routeName).toBe('Colombo - Malabe Express');
    expect(res.body.waitlist[0].position).toBe(1);
  });
});

