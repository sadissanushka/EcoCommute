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

describe('M2-06: Automatic Waitlist Promotion Tests', () => {
  afterAll(async () => {
    await pool.end();
  });

  test('Cancellation automatically promotes oldest eligible waitlist entry', async () => {
    const token = makeToken(10); // User 10 cancels booking 200

    let promotedWaitlistId = 0;
    let newBookingUserId = 0;

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
        // 1. Lock booking
        if (/SELECT.*FROM booking\.bookings.*WHERE.*id = \$1.*FOR UPDATE/i.test(sql)) {
          return { rows: [{ id: 200, user_id: 10, trip_id: 1, status: 'confirmed', party_size: 2 }] };
        }
        // 2. Lock trip
        if (/SELECT.*FROM booking\.shuttle_trips.*FOR UPDATE/i.test(sql)) {
          return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled' }] };
        }
        // 3. Release seats
        if (/UPDATE booking\.seat_assignments SET status = 'released'/i.test(sql)) {
          return { rows: [], rowCount: 2 };
        }
        // 4. Cancel booking
        if (/UPDATE booking\.bookings SET status = 'cancelled'/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        // 5. Audit
        if (/INSERT INTO booking\.booking_audit/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        // 6. Expire stale holds
        if (/UPDATE booking\.(holds|seat_holds)/i.test(sql)) {
          return { rows: [], rowCount: 0 };
        }
        // 7. Read waiting entries
        if (/SELECT.*FROM booking\.waitlist_entries/is.test(sql)) {
          return {
            rows: [
              // Entry 1: User 30, partySize: 2 (eligible)
              { id: 401, user_id: 30, party_size: 2, created_at: '2026-11-12T01:00:00Z' },
            ],
          };
        }
        // 8. Vehicle layout for allocation
        if (/booking\.vehicles/i.test(sql)) {
          return { rows: [{ seat_layout_json: { rows: 10, cols: 3, aisleAfterCol: 2 } }] };
        }
        // 9. Seats availability query (2 seats now free: 1A, 1B)
        if (/booking\.seats/i.test(sql)) {
          return {
            rows: [
              { id: 101, vehicle_id: 1, seat_label: '1A', row_no: 1, col_no: 1, is_window: true, is_aisle: false, is_accessible: false, is_available: true },
              { id: 102, vehicle_id: 1, seat_label: '1B', row_no: 1, col_no: 2, is_window: false, is_aisle: true, is_accessible: false, is_available: true },
            ],
          };
        }
        // 10. Insert promo booking
        if (/INSERT INTO booking\.bookings/i.test(sql)) {
          newBookingUserId = params?.[1];
          return {
            rows: [{ id: 501, trip_id: 1, user_id: 30, party_size: 2, status: 'confirmed', created_at: new Date().toISOString() }],
          };
        }
        // 11. Assign seats for promo booking
        if (/INSERT INTO booking\.seat_assignments/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        // 12. Update waitlist to promoted
        if (/UPDATE booking\.waitlist_entries/i.test(sql)) {
          promotedWaitlistId = params?.[1];
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .delete('/bookings/200')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.promotedCount).toBe(1);
    expect(res.body.promotions[0].waitlistId).toBe(401);
    expect(res.body.promotions[0].userId).toBe(30);
    expect(promotedWaitlistId).toBe(401);
    expect(newBookingUserId).toBe(30);
  });

  test('Oversized older party remains waiting while next smaller eligible party is promoted', async () => {
    const token = makeToken(10); // User 10 cancels booking (releasing 1 seat)

    let promotedWaitlistId = 0;

    const mockClient = {
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (/SELECT.*FROM booking\.bookings.*WHERE.*id = \$1.*FOR UPDATE/i.test(sql)) {
          return { rows: [{ id: 201, user_id: 10, trip_id: 1, status: 'confirmed', party_size: 1 }] };
        }
        if (/SELECT.*FROM booking\.shuttle_trips.*FOR UPDATE/i.test(sql)) {
          return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled' }] };
        }
        if (/UPDATE booking\.seat_assignments SET status = 'released'/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        if (/UPDATE booking\.bookings SET status = 'cancelled'/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        if (/INSERT INTO booking\.booking_audit/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        if (/UPDATE booking\.(holds|seat_holds)/i.test(sql)) {
          return { rows: [], rowCount: 0 };
        }
        // Two waiters: Older waiter A needs 4 seats (cannot fit). Newer waiter B needs 1 seat (fits!).
        if (/SELECT.*FROM booking\.waitlist_entries/is.test(sql)) {
          return {
            rows: [
              { id: 601, user_id: 40, party_size: 4, created_at: '2026-11-12T00:10:00Z' }, // A: needs 4
              { id: 602, user_id: 41, party_size: 1, created_at: '2026-11-12T00:20:00Z' }, // B: needs 1
            ],
          };
        }
        if (/booking\.vehicles/i.test(sql)) {
          return { rows: [{ seat_layout_json: { rows: 10, cols: 3, aisleAfterCol: 2 } }] };
        }
        // Only 1 seat available
        if (/booking\.seats/i.test(sql)) {
          return {
            rows: [
              { id: 105, vehicle_id: 1, seat_label: '2B', row_no: 2, col_no: 2, is_window: false, is_aisle: true, is_accessible: false, is_available: true },
            ],
          };
        }
        if (/INSERT INTO booking\.bookings/i.test(sql)) {
          return {
            rows: [{ id: 502, trip_id: 1, user_id: 41, party_size: 1, status: 'confirmed', created_at: new Date().toISOString() }],
          };
        }
        if (/INSERT INTO booking\.seat_assignments/i.test(sql)) {
          return { rows: [], rowCount: 1 };
        }
        if (/UPDATE booking\.waitlist_entries/i.test(sql)) {
          promotedWaitlistId = params?.[1];
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };

    (jest.spyOn(pool, 'connect') as any).mockImplementationOnce(async () => mockClient);

    const res = await request(app)
      .delete('/bookings/201')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.promotedCount).toBe(1);
    // User 41 (Waitlist 602) was promoted! Older waiter 601 remains waiting.
    expect(res.body.promotions[0].waitlistId).toBe(602);
    expect(res.body.promotions[0].userId).toBe(41);
    expect(promotedWaitlistId).toBe(602);
  });
});
