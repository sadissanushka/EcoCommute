import request from 'supertest';
import express from 'express';
import { bookingRouter } from '../src/routes/booking.routes';
import { pool } from '../src/db/pool';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use('/', bookingRouter);

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-for-dev-change-in-prod-2026!';

function makeToken(userId: number, email: string, role: 'employee' | 'driver' | 'admin' | 'policymaker' = 'employee') {
  return jwt.sign(
    {
      sub: userId.toString(),
      userId,
      email,
      role,
      companyId: 1,
      corporateVerified: true,
      verified: true,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Module 2 — Multi-User Employee Isolation & Concurrency Verification', () => {
  afterAll(async () => {
    await pool.end();
  });

  const users = [
    { id: 101, name: 'Chamila', email: 'chamila@syscolabs.com' },
    { id: 102, name: 'Dinuka', email: 'dinuka@syscolabs.com' },
    { id: 103, name: 'Ruwan', email: 'ruwan@syscolabs.com' },
    { id: 104, name: 'Mohan', email: 'mohan@syscolabs.com' },
    { id: 105, name: 'Lakshitha', email: 'lakshitha@syscolabs.com' },
  ];

  // =========================================================================
  // TEST 1: Employee Isolation across 5 distinct users
  // =========================================================================
  describe('Test 1 — Employee Isolation: 5 Distinct Users', () => {
    test('Each employee sees strictly their own bookings and never another employee’s bookings', async () => {
      // Mock pool.query for GET /bookings/me
      const mockBookingsDb: Record<number, any[]> = {
        101: [{ id: 1001, trip_id: 1, party_size: 1, status: 'confirmed', seats: [{ id: 1, label: '1A' }] }],
        102: [{ id: 1002, trip_id: 1, party_size: 1, status: 'confirmed', seats: [{ id: 2, label: '1B' }] }],
        103: [{ id: 1003, trip_id: 1, party_size: 1, status: 'confirmed', seats: [{ id: 3, label: '1C' }] }],
        104: [{ id: 1004, trip_id: 1, party_size: 1, status: 'confirmed', seats: [{ id: 4, label: '2A' }] }],
        105: [{ id: 1005, trip_id: 1, party_size: 1, status: 'confirmed', seats: [{ id: 5, label: '2B' }] }],
      };

      jest.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('FROM booking.bookings b') && params) {
          const reqUserId = params[0];
          return { rows: mockBookingsDb[reqUserId] || [] } as any;
        }
        return { rows: [] } as any;
      });

      // Verify each employee independently
      for (const u of users) {
        const token = makeToken(u.id, u.email);
        const res = await request(app)
          .get('/bookings/me')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.bookings).toHaveLength(1);
        expect(res.body.bookings[0].id).toBe(mockBookingsDb[u.id][0].id);

        // Ensure none of the other 4 users' bookings appear
        for (const other of users) {
          if (other.id !== u.id) {
            const hasOther = res.body.bookings.some((b: any) => b.id === mockBookingsDb[other.id][0].id);
            expect(hasOther).toBe(false);
          }
        }
      }

      (pool.query as jest.Mock).mockRestore();
    });
  });

  // =========================================================================
  // TEST 2: Same Password, Different Accounts
  // =========================================================================
  describe('Test 2 — Same Password, Different Accounts', () => {
    test('Tokens with identical passwords but different user IDs have completely independent identities', async () => {
      const userA = { id: 201, email: 'userA@syscolabs.com' };
      const userB = { id: 202, email: 'userB@syscolabs.com' };

      const tokenA = makeToken(userA.id, userA.email);
      const tokenB = makeToken(userB.id, userB.email);

      // Verify tokens decode to distinct user IDs
      const decodedA: any = jwt.verify(tokenA, JWT_SECRET);
      const decodedB: any = jwt.verify(tokenB, JWT_SECRET);

      expect(decodedA.userId).toBe(201);
      expect(decodedB.userId).toBe(202);
      expect(decodedA.userId).not.toBe(decodedB.userId);

      jest.spyOn(pool, 'query').mockImplementation(async (sql: any, params?: any[]) => {
        if (typeof sql === 'string' && sql.includes('FROM booking.bookings b') && params) {
          const targetId = params[0];
          return {
            rows: targetId === 201
              ? [{ id: 901, trip_id: 1, party_size: 1, status: 'confirmed', seats: [] }]
              : [{ id: 902, trip_id: 1, party_size: 1, status: 'confirmed', seats: [] }],
          } as any;
        }
        return { rows: [] } as any;
      });

      const resA = await request(app).get('/bookings/me').set('Authorization', `Bearer ${tokenA}`);
      const resB = await request(app).get('/bookings/me').set('Authorization', `Bearer ${tokenB}`);

      expect(resA.body.bookings[0].id).toBe(901);
      expect(resB.body.bookings[0].id).toBe(902);

      (pool.query as jest.Mock).mockRestore();
    });
  });

  // =========================================================================
  // TEST 3: Cross-User Authorization
  // =========================================================================
  describe('Test 3 — Cross-User Authorization', () => {
    test('An employee cannot cancel another employee’s booking (HTTP 403 Forbidden)', async () => {
      const chamilaToken = makeToken(101, 'chamila@syscolabs.com');
      const dinukaBookingId = 555;

      const mockClient = {
        query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
          if (sql.includes('SELECT id, user_id, trip_id, status FROM booking.bookings')) {
            // Belongs to Dinuka (102), but Chamila (101) is requesting
            return {
              rows: [{ id: dinukaBookingId, user_id: 102, trip_id: 1, status: 'confirmed' }],
            };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };

      jest.spyOn(pool, 'connect').mockImplementationOnce(async () => mockClient as any);

      const res = await request(app)
        .delete(`/bookings/${dinukaBookingId}`)
        .set('Authorization', `Bearer ${chamilaToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toContain('cannot cancel another user booking');
    });

    test('An employee cannot hide another employee’s cancelled booking (HTTP 403 Forbidden)', async () => {
      const chamilaToken = makeToken(101, 'chamila@syscolabs.com');
      const dinukaBookingId = 556;

      const mockClient = {
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
          if (sql.includes('SELECT id, user_id, status FROM booking.bookings')) {
            return {
              rows: [{ id: dinukaBookingId, user_id: 102, status: 'cancelled' }],
            };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };

      jest.spyOn(pool, 'connect').mockImplementationOnce(async () => mockClient as any);

      const res = await request(app)
        .post(`/bookings/${dinukaBookingId}/hide`)
        .set('Authorization', `Bearer ${chamilaToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // =========================================================================
  // TEST 4: Same-Seat Concurrency
  // =========================================================================
  describe('Test 4 — Same-Seat Concurrency', () => {
    test('Simultaneous seat hold requests on the same seat: winner gets 201, competing request gets 409 Conflict', async () => {
      const token1 = makeToken(101, 'chamila@syscolabs.com');
      const token2 = makeToken(102, 'dinuka@syscolabs.com');

      // Request 1: successful hold
      const mockClientWinner = {
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
          if (sql.includes('FROM booking.holds') && sql.includes('active_hold_check')) {
            return { rows: [] };
          }
          if (sql.includes('FROM booking.shuttle_trips')) {
            return {
              rows: [{
                id: 1,
                vehicle_id: 1,
                status: 'scheduled',
                booking_cutoff_at: new Date(Date.now() + 86400000).toISOString(),
              }],
            };
          }
          if (sql.includes('SELECT seat_layout_json FROM booking.vehicles')) {
            return { rows: [{ seat_layout_json: { cols: 4, rows: 4, aisleAfterCol: 2 } }] };
          }
          if (sql.includes('FROM booking.seats s')) {
            return {
              rows: [{
                id: 10,
                vehicle_id: 1,
                seat_label: '1A',
                row_no: 1,
                col_no: 1,
                is_window: true,
                is_aisle: false,
                is_accessible: false,
                is_available: true,
              }],
            };
          }
          if (sql.includes('INSERT INTO booking.holds')) {
            return { rows: [{ id: 501, trip_id: 1, user_id: 101, party_size: 1, status: 'held', expires_at: new Date() }] };
          }
          if (sql.includes('INSERT INTO booking.seat_holds')) {
            return { rows: [{ id: 701 }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };

      // Request 2: seat is now unavailable (SEAT_UNAVAILABLE -> 409)
      const mockClientLoser = {
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
          if (sql.includes('FROM booking.holds') && sql.includes('active_hold_check')) {
            return { rows: [] };
          }
          if (sql.includes('FROM booking.shuttle_trips')) {
            return {
              rows: [{
                id: 1,
                vehicle_id: 1,
                status: 'scheduled',
                booking_cutoff_at: new Date(Date.now() + 86400000).toISOString(),
              }],
            };
          }
          if (sql.includes('SELECT seat_layout_json FROM booking.vehicles')) {
            return { rows: [{ seat_layout_json: { cols: 4, rows: 4, aisleAfterCol: 2 } }] };
          }
          if (sql.includes('FROM booking.seats s')) {
            // Seat 10 is held by user 101, so is_available = false
            return {
              rows: [{
                id: 10,
                vehicle_id: 1,
                seat_label: '1A',
                row_no: 1,
                col_no: 1,
                is_window: true,
                is_aisle: false,
                is_accessible: false,
                is_available: false,
              }],
            };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };

      jest.spyOn(pool, 'connect')
        .mockImplementationOnce(async () => mockClientWinner as any)
        .mockImplementationOnce(async () => mockClientLoser as any);

      const res1 = await request(app)
        .post('/trips/1/holds')
        .set('Authorization', `Bearer ${token1}`)
        .send({ partySize: 1, seatIds: [10] });

      const res2 = await request(app)
        .post('/trips/1/holds')
        .set('Authorization', `Bearer ${token2}`)
        .send({ partySize: 1, seatIds: [10] });

      expect(res1.status).toBe(201);
      expect(res1.body.hold).toBeDefined();

      expect(res2.status).toBe(409);
      expect(res2.body.error.code).toBe('SEAT_UNAVAILABLE');
    });
  });

  // =========================================================================
  // TEST 5: Different-Seat Concurrency
  // =========================================================================
  describe('Test 5 — Different-Seat Concurrency', () => {
    test('Two independent employees can concurrently hold different seats on the same trip', async () => {
      const tokenMohan = makeToken(104, 'mohan@syscolabs.com');
      const tokenLakshitha = makeToken(105, 'lakshitha@syscolabs.com');

      const createMockClient = (userId: number, seatId: number, seatLabel: string, colNo: number) => ({
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
          if (sql.includes('FROM booking.holds') && sql.includes('active_hold_check')) return { rows: [] };
          if (sql.includes('FROM booking.shuttle_trips')) {
            return {
              rows: [{
                id: 1,
                vehicle_id: 1,
                status: 'scheduled',
                booking_cutoff_at: new Date(Date.now() + 86400000).toISOString(),
              }],
            };
          }
          if (sql.includes('SELECT seat_layout_json FROM booking.vehicles')) {
            return { rows: [{ seat_layout_json: { cols: 4, rows: 4, aisleAfterCol: 2 } }] };
          }
          if (sql.includes('FROM booking.seats s')) {
            return {
              rows: [{
                id: seatId,
                vehicle_id: 1,
                seat_label: seatLabel,
                row_no: 1,
                col_no: colNo,
                is_window: true,
                is_aisle: false,
                is_accessible: false,
                is_available: true,
              }],
            };
          }
          if (sql.includes('INSERT INTO booking.holds')) {
            return { rows: [{ id: 600 + userId, trip_id: 1, user_id: userId, party_size: 1, status: 'held', expires_at: new Date() }] };
          }
          if (sql.includes('INSERT INTO booking.seat_holds')) {
            return { rows: [{ id: 800 + userId }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      });

      const clientMohan = createMockClient(104, 11, '1A', 1);
      const clientLakshitha = createMockClient(105, 12, '1B', 2);

      jest.spyOn(pool, 'connect')
        .mockImplementationOnce(async () => clientMohan as any)
        .mockImplementationOnce(async () => clientLakshitha as any);

      const [resMohan, resLakshitha] = await Promise.all([
        request(app).post('/trips/1/holds').set('Authorization', `Bearer ${tokenMohan}`).send({ partySize: 1, seatIds: [11] }),
        request(app).post('/trips/1/holds').set('Authorization', `Bearer ${tokenLakshitha}`).send({ partySize: 1, seatIds: [12] }),
      ]);

      expect(resMohan.status).toBe(201);
      expect(resLakshitha.status).toBe(201);
      expect(resMohan.body.hold.id).not.toBe(resLakshitha.body.hold.id);
    });
  });

  // =========================================================================
  // TEST 6: FIFO Waitlist & Promotion Ownership
  // =========================================================================
  describe('Test 6 — FIFO Waitlist & Promotion Ownership', () => {
    test('Automatic promotion upon cancellation sets the correct promoted owner and isolated booking', async () => {
      const winnerToken = makeToken(101, 'chamila@syscolabs.com');
      const waitingUser = { id: 104, email: 'mohan@syscolabs.com' };

      const mockClient = {
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
          // 1. Lock booking to cancel
          if (sql.includes('SELECT id, user_id, trip_id, status FROM booking.bookings WHERE id = $1')) {
            return { rows: [{ id: 50, user_id: 101, trip_id: 1, status: 'confirmed' }] };
          }
          // 2. Lock trip row
          if (sql.includes('SELECT id, vehicle_id, status FROM booking.shuttle_trips WHERE id = $1')) {
            return { rows: [{ id: 1, vehicle_id: 1, status: 'scheduled' }] };
          }
          // 3. Release seat assignments
          if (sql.includes('UPDATE booking.seat_assignments SET status = \'released\'')) {
            return { rows: [{ seat_id: 30 }] };
          }
          // 4. Update booking to cancelled
          if (sql.includes('UPDATE booking.bookings SET status = \'cancelled\'')) {
            return { rows: [{ id: 50 }] };
          }
          if (sql.includes('INSERT INTO booking.booking_audit')) {
            return { rows: [{ id: 1 }] };
          }
          if (sql.includes('INSERT INTO booking.domain_events')) {
            return { rows: [{ id: 1 }] };
          }
          // 5. Select active waitlist in FIFO order -> returns Mohan (user 104)
          if (sql.includes('FROM booking.waitlist_entries') && sql.includes('ORDER BY created_at ASC')) {
            return {
              rows: [{ id: 10, trip_id: 1, user_id: waitingUser.id, party_size: 1, status: 'waiting' }],
            };
          }
          // 6. Allocate seats for Mohan
          if (sql.includes('SELECT seat_layout_json FROM booking.vehicles')) {
            return { rows: [{ seat_layout_json: { cols: 4, rows: 4, aisleAfterCol: 2 } }] };
          }
          if (sql.includes('FROM booking.seats s')) {
            return {
              rows: [{
                id: 30,
                vehicle_id: 1,
                seat_label: '3A',
                row_no: 3,
                col_no: 1,
                is_window: true,
                is_aisle: false,
                is_accessible: false,
                is_available: true,
              }],
            };
          }
          // 7. Create booking for Mohan
          if (sql.includes('INSERT INTO booking.bookings (trip_id, user_id, party_size, status)')) {
            return {
              rows: [{ id: 99, trip_id: 1, user_id: waitingUser.id, party_size: 1, status: 'confirmed', created_at: new Date() }],
            };
          }
          // 8. Update waitlist to promoted
          if (sql.includes('UPDATE booking.waitlist_entries')) {
            return { rows: [{ id: 10 }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };

      jest.spyOn(pool, 'connect').mockImplementationOnce(async () => mockClient as any);

      const res = await request(app)
        .delete('/bookings/50')
        .set('Authorization', `Bearer ${winnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.promotedCount).toBe(1);
      expect(res.body.promotions[0].userId).toBe(waitingUser.id);
      expect(res.body.promotions[0].bookingId).toBe(99);
    });
  });

  // =========================================================================
  // TEST 7: Repeated Cancellation & Retries
  // =========================================================================
  describe('Test 7 — Repeated Cancellation Idempotency', () => {
    test('Repeated cancellation request on already cancelled booking is rejected with 400 ALREADY_CANCELLED', async () => {
      const token = makeToken(101, 'chamila@syscolabs.com');
      const mockClient = {
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
          if (sql.includes('SELECT id, user_id, trip_id, status FROM booking.bookings WHERE id = $1')) {
            return { rows: [{ id: 50, user_id: 101, trip_id: 1, status: 'cancelled' }] };
          }
          return { rows: [] };
        }),
        release: jest.fn(),
      };

      jest.spyOn(pool, 'connect').mockImplementationOnce(async () => mockClient as any);

      const res = await request(app)
        .delete('/bookings/50')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('ALREADY_CANCELLED');
    });
  });
});

