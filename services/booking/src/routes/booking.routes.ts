import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  allocateSeats,
  expireStaleHolds,
  SeatAllocationError,
} from '../services/seatAllocation';

export const bookingRouter = Router();

const HOLD_DURATION_MINUTES = parseInt(process.env.HOLD_DURATION_MINUTES || '5', 10);

const bookingSchema = z.object({
  partySize: z.number().int().min(1, 'Party size must be at least 1').max(6, 'Party size cannot exceed 6'),
  seatIds: z.array(z.number().int().positive()).optional(),
  requireAccessible: z.boolean().optional(),
});

const waitlistSchema = z.object({
  partySize: z.number().int().min(1, 'Party size must be at least 1').max(6, 'Party size cannot exceed 6').default(1),
});

const holdSchema = z.object({
  partySize: z.number().int().min(1, 'Party size must be at least 1').max(6, 'Party size cannot exceed 6'),
  seatIds: z.array(z.number().int().positive()).optional(),
  requireAccessible: z.boolean().optional(),
});

const vehicleSchema = z.object({
  plateNo: z.string().min(3),
  type: z.string().min(2),
  capacity: z.number().int().positive('Capacity must be greater than 0'),
  seatLayoutJson: z.record(z.any()).optional().default({}),
  companyId: z.number().int().positive().optional(),
});

const updateVehicleSchema = z.object({
  plateNo: z.string().min(3).optional(),
  type: z.string().min(2).optional(),
  capacity: z.number().int().positive().optional(),
  active: z.boolean().optional(),
  seatLayoutJson: z.record(z.any()).optional(),
});

const createTripSchema = z.object({
  routeId: z.number().int().positive(),
  vehicleId: z.number().int().positive(),
  driverId: z.number().int().positive().optional(),
  departAt: z.string().datetime(),
  arriveAt: z.string().datetime(),
  bookingCutoffAt: z.string().datetime(),
});

const updateTripSchema = z.object({
  driverId: z.number().int().positive().nullable().optional(),
  vehicleId: z.number().int().positive().optional(),
  departAt: z.string().datetime().optional(),
  arriveAt: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'boarding', 'in_progress', 'completed', 'cancelled']).optional(),
  bookingCutoffAt: z.string().datetime().optional(),
});

// ============================================================================
// 1. TRIP SEARCH & DETAIL
// ============================================================================

// GET /trips - Trip search with server-side availableSeats computation (including holds)
bookingRouter.get('/trips', async (req: Request, res: Response) => {
  try {
    const { origin, destination, date, seatsNeeded } = req.query;
    const minSeats = seatsNeeded ? parseInt(seatsNeeded as string, 10) : 1;

    // Clean up stale holds before reading availability
    await expireStaleHolds(pool as any);

    let query = `
      SELECT 
        st.id,
        st.route_id,
        sr.name AS route_name,
        sr.origin_name,
        sr.destination_name,
        sr.stops_json,
        st.vehicle_id,
        v.plate_no,
        v.type AS vehicle_type,
        v.capacity AS total_capacity,
        st.driver_id,
        u.full_name AS driver_name,
        st.depart_at,
        st.arrive_at,
        st.status,
        st.booking_cutoff_at,
        (v.capacity - COALESCE(booked.count, 0)) AS available_seats
      FROM booking.shuttle_trips st
      JOIN booking.shuttle_routes sr ON sr.id = st.route_id
      JOIN booking.vehicles v ON v.id = st.vehicle_id
      LEFT JOIN booking.drivers d ON d.id = st.driver_id
      LEFT JOIN core.users u ON u.id = d.user_id
      LEFT JOIN (
        SELECT trip_id, COUNT(*) AS count
        FROM (
          SELECT trip_id, seat_id FROM booking.seat_assignments WHERE status = 'active'
          UNION
          SELECT trip_id, seat_id FROM booking.seat_holds WHERE status = 'held' AND expires_at > now()
        ) occupied
        GROUP BY trip_id
      ) booked ON booked.trip_id = st.id
      WHERE st.status = 'scheduled'
        AND st.booking_cutoff_at > now()
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (origin) {
      query += ` AND sr.origin_name ILIKE $${paramIndex++}`;
      params.push(`%${origin}%`);
    }

    if (destination) {
      query += ` AND sr.destination_name ILIKE $${paramIndex++}`;
      params.push(`%${destination}%`);
    }

    if (date) {
      query += ` AND DATE(st.depart_at) = $${paramIndex++}`;
      params.push(date);
    }

    query += ` ORDER BY st.depart_at ASC`;

    const result = await pool.query(query, params);

    const filtered = result.rows.filter((row) => row.available_seats >= minSeats);

    res.status(200).json({
      trips: filtered.map((t) => ({
        id: t.id,
        routeId: t.route_id,
        routeName: t.route_name,
        originName: t.origin_name,
        destinationName: t.destination_name,
        stops: t.stops_json,
        vehicle: {
          id: t.vehicle_id,
          plateNo: t.plate_no,
          type: t.vehicle_type,
          capacity: t.total_capacity,
        },
        driver: {
          id: t.driver_id,
          name: t.driver_name,
        },
        departAt: t.depart_at,
        arriveAt: t.arrive_at,
        status: t.status,
        bookingCutoffAt: t.booking_cutoff_at,
        availableSeats: Math.max(0, parseInt(t.available_seats, 10)),
      })),
    });
  } catch (err: any) {
    console.error('Error searching trips:', err);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to search shuttle trips',
        details: { error: err.message },
      },
    });
  }
});

// GET /trips/:id - Detail with seat map and seat availability (including holds)
bookingRouter.get('/trips/:id', async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be integer', details: {} } });
    return;
  }

  try {
    await expireStaleHolds(pool as any, tripId);

    const tripRes = await pool.query(
      `SELECT st.*, sr.name AS route_name, sr.origin_name, sr.destination_name, sr.stops_json,
              v.plate_no, v.type AS vehicle_type, v.capacity, v.seat_layout_json,
              u.full_name AS driver_name
       FROM booking.shuttle_trips st
       JOIN booking.shuttle_routes sr ON sr.id = st.route_id
       JOIN booking.vehicles v ON v.id = st.vehicle_id
       LEFT JOIN booking.drivers d ON d.id = st.driver_id
       LEFT JOIN core.users u ON u.id = d.user_id
       WHERE st.id = $1`,
      [tripId]
    );

    if (tripRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Shuttle trip not found', details: {} } });
      return;
    }

    const trip = tripRes.rows[0];

    const seatsRes = await pool.query(
      `SELECT s.id, s.seat_label, s.row_no, s.col_no, s.is_window, s.is_aisle, s.is_accessible,
              CASE 
                WHEN sa.id IS NOT NULL THEN false
                WHEN sh.id IS NOT NULL THEN false
                ELSE true 
              END AS is_available
       FROM booking.seats s
       LEFT JOIN booking.seat_assignments sa ON sa.seat_id = s.id AND sa.trip_id = $1 AND sa.status = 'active'
       LEFT JOIN booking.seat_holds sh ON sh.seat_id = s.id AND sh.trip_id = $1 AND sh.status = 'held' AND sh.expires_at > now()
       WHERE s.vehicle_id = $2
       ORDER BY s.row_no ASC, s.col_no ASC`,
      [tripId, trip.vehicle_id]
    );

    const availableCount = seatsRes.rows.filter((s) => s.is_available).length;

    res.status(200).json({
      trip: {
        id: trip.id,
        routeId: trip.route_id,
        routeName: trip.route_name,
        originName: trip.origin_name,
        destinationName: trip.destination_name,
        stops: trip.stops_json,
        departAt: trip.depart_at,
        arriveAt: trip.arrive_at,
        status: trip.status,
        bookingCutoffAt: trip.booking_cutoff_at,
        vehicle: {
          id: trip.vehicle_id,
          plateNo: trip.plate_no,
          type: trip.vehicle_type,
          capacity: trip.capacity,
          layout: trip.seat_layout_json,
        },
        driverName: trip.driver_name,
        availableSeats: availableCount,
        seats: seatsRes.rows.map((s) => ({
          id: s.id,
          label: s.seat_label,
          row: s.row_no,
          col: s.col_no,
          isWindow: s.is_window,
          isAisle: s.is_aisle,
          isAccessible: s.is_accessible,
          isAvailable: s.is_available,
        })),
      },
    });
  } catch (err: any) {
    console.error('Error fetching trip details:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch trip details', details: { error: err.message } },
    });
  }
});

// ============================================================================
// 2. ADMIN TRIP & VEHICLE MANAGEMENT
// ============================================================================

// POST /trips - Admin schedules a new trip
bookingRouter.post('/trips', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const parseResult = createTripSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid trip scheduling payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { routeId, vehicleId, driverId, departAt, arriveAt, bookingCutoffAt } = parseResult.data;

  if (new Date(bookingCutoffAt) >= new Date(departAt)) {
    res.status(400).json({
      error: {
        code: 'INVALID_CUTOFF',
        message: 'bookingCutoffAt must be strictly before departAt',
        details: {},
      },
    });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO booking.shuttle_trips (route_id, vehicle_id, driver_id, depart_at, arrive_at, booking_cutoff_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
       RETURNING *`,
      [routeId, vehicleId, driverId || null, departAt, arriveAt, bookingCutoffAt]
    );

    res.status(201).json({ trip: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to schedule trip', details: { error: err.message } },
    });
  }
});

// PATCH /trips/:id - Admin updates an existing trip
bookingRouter.patch('/trips/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be integer', details: {} } });
    return;
  }

  const parseResult = updateTripSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid trip update payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { driverId, vehicleId, departAt, arriveAt, status, bookingCutoffAt } = parseResult.data;

  try {
    const tripCheck = await pool.query('SELECT id FROM booking.shuttle_trips WHERE id = $1', [tripId]);
    if (tripCheck.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trip not found', details: {} } });
      return;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (driverId !== undefined) {
      updates.push(`driver_id = $${idx++}`);
      values.push(driverId);
    }
    if (vehicleId !== undefined) {
      updates.push(`vehicle_id = $${idx++}`);
      values.push(vehicleId);
    }
    if (departAt !== undefined) {
      updates.push(`depart_at = $${idx++}`);
      values.push(departAt);
    }
    if (arriveAt !== undefined) {
      updates.push(`arrive_at = $${idx++}`);
      values.push(arriveAt);
    }
    if (status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(status);
    }
    if (bookingCutoffAt !== undefined) {
      updates.push(`booking_cutoff_at = $${idx++}`);
      values.push(bookingCutoffAt);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No fields provided to update', details: {} } });
      return;
    }

    updates.push(`version = version + 1`);
    values.push(tripId);

    const query = `UPDATE booking.shuttle_trips SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, values);

    res.status(200).json({ trip: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update trip', details: { error: err.message } },
    });
  }
});

// GET /vehicles - List vehicles
bookingRouter.get('/vehicles', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, company_id, plate_no, type, capacity, seat_layout_json, active, created_at
       FROM booking.vehicles
       ORDER BY id ASC`
    );
    res.status(200).json({ vehicles: result.rows });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch vehicles', details: { error: err.message } },
    });
  }
});

// POST /vehicles - Admin creates a vehicle
bookingRouter.post('/vehicles', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const parseResult = vehicleSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid vehicle payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { plateNo, type, capacity, seatLayoutJson, companyId } = parseResult.data;

  try {
    const result = await pool.query(
      `INSERT INTO booking.vehicles (plate_no, type, capacity, seat_layout_json, company_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [plateNo, type, capacity, seatLayoutJson, companyId || null]
    );
    res.status(201).json({ vehicle: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({
        error: { code: 'DUPLICATE_PLATE', message: 'Vehicle with plate number already exists', details: {} },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create vehicle', details: { error: err.message } },
    });
  }
});

// PATCH /vehicles/:id - Admin updates a vehicle
bookingRouter.patch('/vehicles/:id', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const vehicleId = parseInt(req.params.id, 10);
  if (isNaN(vehicleId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Vehicle ID must be integer', details: {} } });
    return;
  }

  const parseResult = updateVehicleSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid vehicle update payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { plateNo, type, capacity, active, seatLayoutJson } = parseResult.data;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (plateNo !== undefined) {
      updates.push(`plate_no = $${idx++}`);
      values.push(plateNo);
    }
    if (type !== undefined) {
      updates.push(`type = $${idx++}`);
      values.push(type);
    }
    if (capacity !== undefined) {
      updates.push(`capacity = $${idx++}`);
      values.push(capacity);
    }
    if (active !== undefined) {
      updates.push(`active = $${idx++}`);
      values.push(active);
    }
    if (seatLayoutJson !== undefined) {
      updates.push(`seat_layout_json = $${idx++}`);
      values.push(seatLayoutJson);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No fields provided to update', details: {} } });
      return;
    }

    values.push(vehicleId);
    const query = `UPDATE booking.vehicles SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Vehicle not found', details: {} } });
      return;
    }

    res.status(200).json({ vehicle: result.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({
        error: { code: 'DUPLICATE_PLATE', message: 'Vehicle with plate number already exists', details: {} },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update vehicle', details: { error: err.message } },
    });
  }
});

// ============================================================================
// 3. BOOKING CREATION & CANCELLATION (M2-04, M2-06)
// ============================================================================

// POST /trips/:id/bookings - Transactional booking with cutoff, intelligent allocation, and idempotency
bookingRouter.post('/trips/:id/bookings', requireAuth, async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be integer', details: {} } });
    return;
  }

  const parseResult = bookingSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid booking request payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { partySize, seatIds, requireAccessible } = parseResult.data;
  const userId = req.user!.userId;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Idempotency replay check
    if (idempotencyKey) {
      const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
      const idemRes = await client.query(
        'SELECT response_json, request_hash FROM booking.idempotency_keys WHERE user_id = $1 AND key = $2',
        [userId, idempotencyKey]
      );
      if (idemRes.rows.length > 0) {
        if (idemRes.rows[0].request_hash !== bodyHash) {
          await client.query('ROLLBACK');
          res.status(422).json({
            error: {
              code: 'IDEMPOTENCY_MISMATCH',
              message: 'Idempotency key reuse with differing request payload',
              details: {},
            },
          });
          return;
        }
        await client.query('ROLLBACK');
        res.status(200).json(idemRes.rows[0].response_json);
        return;
      }
    }

    // 2. Lock trip row & verify status and cutoff
    const tripRes = await client.query(
      `SELECT id, vehicle_id, status, booking_cutoff_at
       FROM booking.shuttle_trips
       WHERE id = $1 FOR UPDATE`,
      [tripId]
    );

    if (tripRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { code: 'TRIP_NOT_FOUND', message: 'Trip does not exist', details: {} } });
      return;
    }

    const trip = tripRes.rows[0];

    if (trip.status !== 'scheduled') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: { code: 'TRIP_NOT_BOOKABLE', message: `Trip status is '${trip.status}', bookings closed`, details: {} },
      });
      return;
    }

    if (new Date() > new Date(trip.booking_cutoff_at)) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: { code: 'CUTOFF_PASSED', message: 'Booking cutoff time has passed for this trip', details: { cutoff: trip.booking_cutoff_at } },
      });
      return;
    }

    // 3. Check if user already holds an active booking
    const activeBooking = await client.query(
      `SELECT id FROM booking.bookings
       WHERE trip_id = $1 AND user_id = $2 AND status IN ('held', 'confirmed', 'waitlisted')`,
      [tripId, userId]
    );
    if (activeBooking.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: {
          code: 'DUPLICATE_BOOKING',
          message: 'User already holds an active booking or waitlist entry on this trip',
          details: { existingBookingId: activeBooking.rows[0].id },
        },
      });
      return;
    }

    // 4. Intelligent seat allocation (M2-04)
    let allocation;
    try {
      allocation = await allocateSeats(client, {
        tripId,
        vehicleId: trip.vehicle_id,
        partySize,
        explicitSeatIds: seatIds,
        requireAccessible,
      });
    } catch (allocErr: any) {
      await client.query('ROLLBACK');
      if (allocErr instanceof SeatAllocationError) {
        res.status(allocErr.status).json({
          error: {
            code: allocErr.code,
            message: allocErr.message,
            details: allocErr.details,
          },
        });
        return;
      }
      throw allocErr;
    }

    const assignedSeats = allocation.seatIds;

    // 5. Create booking record
    const bookingRes = await client.query(
      `INSERT INTO booking.bookings (trip_id, user_id, party_size, status)
       VALUES ($1, $2, $3, 'confirmed')
       RETURNING id, trip_id, user_id, party_size, status, created_at`,
      [tripId, userId, partySize]
    );
    const newBooking = bookingRes.rows[0];

    // 6. Create seat assignments
    for (const seatId of assignedSeats) {
      await client.query(
        `INSERT INTO booking.seat_assignments (booking_id, trip_id, seat_id, status)
         VALUES ($1, $2, $3, 'active')`,
        [newBooking.id, tripId, seatId]
      );
    }

    // 7. Record audit row
    await client.query(
      `INSERT INTO booking.booking_audit (booking_id, from_status, to_status, actor_id, reason)
       VALUES ($1, NULL, 'confirmed', $2, 'Initial booking confirmed')`,
      [newBooking.id, userId]
    );

    // 8. Store idempotency key if provided
    const responsePayload = {
      booking: {
        id: newBooking.id,
        tripId: newBooking.trip_id,
        userId: newBooking.user_id,
        partySize: newBooking.party_size,
        status: newBooking.status,
        assignedSeatIds: assignedSeats,
        allocationType: allocation.allocationType,
        createdAt: newBooking.created_at,
      },
    };

    if (idempotencyKey) {
      const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
      await client.query(
        `INSERT INTO booking.idempotency_keys (key, user_id, request_hash, response_json)
         VALUES ($1, $2, $3, $4)`,
        [idempotencyKey, userId, bodyHash, responsePayload]
      );
    }

    await client.query('COMMIT');

    res.status(201).json(responsePayload);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Booking creation error:', err);
    if (err.code === '23505') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Seat already assigned or concurrent booking detected', details: {} },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to complete booking', details: { error: err.message } },
    });
  } finally {
    client.release();
  }
});

// GET /bookings/me - List bookings for current user
bookingRouter.get('/bookings/me', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    const bookingsResult = await pool.query(
      `SELECT b.id, b.trip_id, b.party_size, b.status, b.created_at,
              st.depart_at, st.arrive_at, sr.name AS route_name,
              sr.origin_name, sr.destination_name,
              v.plate_no, v.type AS vehicle_type,
              COALESCE(
                json_agg(json_build_object('id', s.id, 'label', s.seat_label)) 
                FILTER (WHERE s.id IS NOT NULL), '[]'
              ) AS seats
       FROM booking.bookings b
       JOIN booking.shuttle_trips st ON st.id = b.trip_id
       JOIN booking.shuttle_routes sr ON sr.id = st.route_id
       JOIN booking.vehicles v ON v.id = st.vehicle_id
       LEFT JOIN booking.seat_assignments sa ON sa.booking_id = b.id AND sa.status = 'active'
       LEFT JOIN booking.seats s ON s.id = sa.seat_id
       WHERE b.user_id = $1
         AND NOT EXISTS (
           SELECT 1
           FROM booking.hidden_bookings hb
           WHERE hb.booking_id = b.id AND hb.user_id = $1
         )
       GROUP BY b.id, st.depart_at, st.arrive_at, sr.name, sr.origin_name, sr.destination_name, v.plate_no, v.type
       ORDER BY b.created_at DESC`,
      [userId]
    );

    res.status(200).json({ bookings: bookingsResult.rows });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user bookings', details: { error: err.message } },
    });
  }
});

// GET /bookings/:id - Get specific booking detail
bookingRouter.get('/bookings/:id', requireAuth, async (req: Request, res: Response) => {
  const bookingId = parseInt(req.params.id, 10);
  if (isNaN(bookingId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Booking ID must be integer', details: {} } });
    return;
  }

  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'admin';

  try {
    const result = await pool.query(
      `SELECT b.id, b.user_id, b.trip_id, b.party_size, b.status, b.created_at,
              st.depart_at, st.arrive_at, sr.name AS route_name,
              sr.origin_name, sr.destination_name,
              v.plate_no, v.type AS vehicle_type,
              COALESCE(
                json_agg(json_build_object('id', s.id, 'label', s.seat_label)) 
                FILTER (WHERE s.id IS NOT NULL), '[]'
              ) AS seats
       FROM booking.bookings b
       JOIN booking.shuttle_trips st ON st.id = b.trip_id
       JOIN booking.shuttle_routes sr ON sr.id = st.route_id
       JOIN booking.vehicles v ON v.id = st.vehicle_id
       LEFT JOIN booking.seat_assignments sa ON sa.booking_id = b.id AND sa.status = 'active'
       LEFT JOIN booking.seats s ON s.id = sa.seat_id
       WHERE b.id = $1
       GROUP BY b.id, st.depart_at, st.arrive_at, sr.name, sr.origin_name, sr.destination_name, v.plate_no, v.type`,
      [bookingId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Booking not found', details: {} } });
      return;
    }

    const booking = result.rows[0];
    if (!isAdmin && Number(booking.user_id) !== Number(userId)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied to this booking', details: {} } });
      return;
    }

    res.status(200).json({ booking });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking', details: { error: err.message } },
    });
  }
});

// POST /bookings/:id/hide - Hide an already-cancelled booking for its owner
bookingRouter.post('/bookings/:id/hide', requireAuth, async (req: Request, res: Response) => {
  const bookingId = parseInt(req.params.id, 10);
  if (isNaN(bookingId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Booking ID must be integer', details: {} } });
    return;
  }

  const userId = req.user!.userId;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const bookingRes = await client.query(
      'SELECT id, user_id, status FROM booking.bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Booking not found', details: {} } });
      return;
    }

    const booking = bookingRes.rows[0];
    if (Number(booking.user_id) !== Number(userId)) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot remove another user booking', details: {} } });
      return;
    }

    if (booking.status !== 'cancelled') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: {
          code: 'BOOKING_NOT_CANCELLED',
          message: 'Only cancelled bookings can be removed from your list',
          details: { status: booking.status },
        },
      });
      return;
    }

    await client.query(
      `INSERT INTO booking.hidden_bookings (booking_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (booking_id, user_id) DO NOTHING`,
      [bookingId, userId]
    );

    await client.query('COMMIT');
    res.status(200).json({
      success: true,
      message: 'Cancelled booking hidden from your booking list',
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error hiding cancelled booking:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove cancelled booking from your list', details: { error: err.message } },
    });
  } finally {
    client.release();
  }
});

// DELETE /bookings/:id - Cancel booking, release seats, and automatically promote waitlisted users (M2-06)
bookingRouter.delete('/bookings/:id', requireAuth, async (req: Request, res: Response) => {
  const bookingId = parseInt(req.params.id, 10);
  if (isNaN(bookingId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Booking ID must be integer', details: {} } });
    return;
  }

  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'admin';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock booking row
    const bookingRes = await client.query(
      'SELECT id, user_id, trip_id, status FROM booking.bookings WHERE id = $1 FOR UPDATE',
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Booking not found', details: {} } });
      return;
    }

    const booking = bookingRes.rows[0];

    if (!isAdmin && Number(booking.user_id) !== Number(userId)) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot cancel another user booking', details: {} } });
      return;
    }

    if (booking.status === 'cancelled') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: { code: 'ALREADY_CANCELLED', message: 'Booking is already cancelled', details: {} } });
      return;
    }

    if (booking.status !== 'confirmed') {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: {
          code: 'CANCELLATION_NOT_ALLOWED',
          message: `Booking cannot be cancelled while its status is '${booking.status}'`,
          details: { status: booking.status },
        },
      });
      return;
    }

    // 2. Lock trip row
    const tripRes = await client.query(
      'SELECT id, vehicle_id, status FROM booking.shuttle_trips WHERE id = $1 FOR UPDATE',
      [booking.trip_id]
    );
    const trip = tripRes.rows[0];

    // 3. Release seats
    await client.query(
      "UPDATE booking.seat_assignments SET status = 'released' WHERE booking_id = $1",
      [bookingId]
    );

    // 4. Update booking status
    await client.query(
      "UPDATE booking.bookings SET status = 'cancelled', updated_at = now() WHERE id = $1",
      [bookingId]
    );

    // 5. Write audit
    await client.query(
      `INSERT INTO booking.booking_audit (booking_id, from_status, to_status, actor_id, reason)
       VALUES ($1, $2, 'cancelled', $3, 'User cancelled booking')`,
      [bookingId, booking.status, userId]
    );

    // 6. Expire stale holds
    await expireStaleHolds(client, booking.trip_id);

    // 7. Automatic waitlist promotion (M2-06): Oldest eligible party first
    const promotedEntries: any[] = [];
    if (trip && trip.status === 'scheduled') {
      const waitlistRes = await client.query(
        `SELECT id, user_id, party_size, created_at
         FROM booking.waitlist_entries
         WHERE trip_id = $1 AND status = 'waiting'
         ORDER BY created_at ASC
         FOR UPDATE`,
        [booking.trip_id]
      );

      for (const entry of waitlistRes.rows) {
        try {
          const promoAllocation = await allocateSeats(client, {
            tripId: booking.trip_id,
            vehicleId: trip.vehicle_id,
            partySize: entry.party_size,
          });

          // Create confirmed booking for waitlisted employee
          const promoBookingRes = await client.query(
            `INSERT INTO booking.bookings (trip_id, user_id, party_size, status)
             VALUES ($1, $2, $3, 'confirmed')
             RETURNING id, trip_id, user_id, party_size, status, created_at`,
            [booking.trip_id, entry.user_id, entry.party_size]
          );
          const promoBooking = promoBookingRes.rows[0];

          for (const seatId of promoAllocation.seatIds) {
            await client.query(
              `INSERT INTO booking.seat_assignments (booking_id, trip_id, seat_id, status)
               VALUES ($1, $2, $3, 'active')`,
              [promoBooking.id, booking.trip_id, seatId]
            );
          }

          // Mark waitlist entry promoted
          await client.query(
            `UPDATE booking.waitlist_entries
             SET status = 'promoted', promoted_at = now(), booking_id = $1, updated_at = now()
             WHERE id = $2`,
            [promoBooking.id, entry.id]
          );

          // Audit record
          await client.query(
            `INSERT INTO booking.booking_audit (booking_id, from_status, to_status, actor_id, reason)
             VALUES ($1, NULL, 'confirmed', $2, 'Automatically promoted from waitlist upon booking cancellation')`,
            [promoBooking.id, entry.user_id]
          );

          promotedEntries.push({
            waitlistId: entry.id,
            userId: entry.user_id,
            bookingId: promoBooking.id,
            seatIds: promoAllocation.seatIds,
          });
        } catch (allocErr: any) {
          if (allocErr instanceof SeatAllocationError && allocErr.code === 'INSUFFICIENT_CAPACITY') {
            // Oversized party: remains waiting, continue checking smaller subsequent entries
            continue;
          }
          // Unexpected failure: rethrow so transaction rolls back atomically
          throw allocErr;
        }
      }
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Booking successfully cancelled',
      promotedCount: promotedEntries.length,
      promotions: promotedEntries,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error cancelling booking:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel booking', details: { error: err.message } },
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// 4. WAITLIST MANAGEMENT (M2-05)
// ============================================================================

// POST /trips/:id/waitlist - Join FIFO waitlist
bookingRouter.post('/trips/:id/waitlist', requireAuth, async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be integer', details: {} } });
    return;
  }

  const parseResult = waitlistSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid waitlist request payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { partySize } = parseResult.data;
  const userId = req.user!.userId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock trip
    const tripRes = await client.query(
      'SELECT id, vehicle_id, status, booking_cutoff_at FROM booking.shuttle_trips WHERE id = $1 FOR UPDATE',
      [tripId]
    );
    if (tripRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { code: 'TRIP_NOT_FOUND', message: 'Trip does not exist', details: {} } });
      return;
    }
    const trip = tripRes.rows[0];

    if (trip.status !== 'scheduled') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: { code: 'TRIP_NOT_BOOKABLE', message: `Trip status is '${trip.status}', waitlist closed`, details: {} },
      });
      return;
    }

    if (new Date() > new Date(trip.booking_cutoff_at)) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: { code: 'CUTOFF_PASSED', message: 'Booking cutoff time has passed for this trip', details: { cutoff: trip.booking_cutoff_at } },
      });
      return;
    }

    // 2. Check if user already holds confirmed booking on this trip
    const activeBooking = await client.query(
      "SELECT id FROM booking.bookings WHERE trip_id = $1 AND user_id = $2 AND status = 'confirmed'",
      [tripId, userId]
    );
    if (activeBooking.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: {
          code: 'ALREADY_BOOKED',
          message: 'User already holds a confirmed booking on this trip',
          details: { existingBookingId: activeBooking.rows[0].id },
        },
      });
      return;
    }

    // 3. Check if user already has an active waitlist entry on this trip
    const activeWaitlist = await client.query(
      "SELECT id FROM booking.waitlist_entries WHERE trip_id = $1 AND user_id = $2 AND status = 'waiting'",
      [tripId, userId]
    );
    if (activeWaitlist.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: {
          code: 'DUPLICATE_WAITLIST',
          message: 'User is already on the waitlist for this trip',
          details: { existingWaitlistId: activeWaitlist.rows[0].id },
        },
      });
      return;
    }

    // 4. Insert waitlist entry
    const waitlistRes = await client.query(
      `INSERT INTO booking.waitlist_entries (trip_id, user_id, party_size, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'waiting', now(), now())
       RETURNING id, trip_id, user_id, party_size, status, created_at`,
      [tripId, userId, partySize]
    );
    const entry = waitlistRes.rows[0];

    // 5. Calculate queue position (FIFO: count entries with status='waiting' created on or before this entry)
    const posRes = await client.query(
      `SELECT COUNT(*) AS position
       FROM booking.waitlist_entries
       WHERE trip_id = $1 AND status = 'waiting' AND created_at <= $2`,
      [tripId, entry.created_at]
    );
    const position = parseInt(posRes.rows[0]?.position || '1', 10);

    await client.query('COMMIT');

    res.status(201).json({
      waitlist: {
        id: entry.id,
        tripId: entry.trip_id,
        userId: entry.user_id,
        partySize: entry.party_size,
        status: entry.status,
        position,
        createdAt: entry.created_at,
      },
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Waitlist join error:', err);
    if (err.code === '23505') {
      res.status(409).json({
        error: { code: 'DUPLICATE_WAITLIST', message: 'User is already on the waitlist for this trip', details: {} },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to join waitlist', details: { error: err.message } },
    });
  } finally {
    client.release();
  }
});

// GET /trips/:id/waitlist/me - View own waitlist status for a trip
bookingRouter.get('/trips/:id/waitlist/me', requireAuth, async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be integer', details: {} } });
    return;
  }

  const userId = req.user!.userId;

  try {
    const result = await pool.query(
      `SELECT w.id, w.trip_id, w.user_id, w.party_size, w.status, w.created_at, w.booking_id,
              (
                SELECT COUNT(*)
                FROM booking.waitlist_entries w2
                WHERE w2.trip_id = w.trip_id AND w2.status = 'waiting' AND w2.created_at <= w.created_at
              ) AS position
       FROM booking.waitlist_entries w
       WHERE w.trip_id = $1 AND w.user_id = $2 AND w.status = 'waiting'`,
      [tripId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'No active waitlist entry found for this user and trip', details: {} },
      });
      return;
    }

    const row = result.rows[0];
    res.status(200).json({
      waitlist: {
        id: row.id,
        tripId: row.trip_id,
        userId: row.user_id,
        partySize: row.party_size,
        status: row.status,
        position: parseInt(row.position, 10),
        bookingId: row.booking_id,
        createdAt: row.created_at,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch waitlist status', details: { error: err.message } },
    });
  }
});

// DELETE /trips/:id/waitlist/me - Leave/withdraw from waitlist
bookingRouter.delete('/trips/:id/waitlist/me', requireAuth, async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be integer', details: {} } });
    return;
  }

  const userId = req.user!.userId;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const entryRes = await client.query(
      "SELECT id, status FROM booking.waitlist_entries WHERE trip_id = $1 AND user_id = $2 AND status = 'waiting' FOR UPDATE",
      [tripId, userId]
    );

    if (entryRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'No active waitlist entry found to cancel', details: {} },
      });
      return;
    }

    const entry = entryRes.rows[0];
    await client.query(
      "UPDATE booking.waitlist_entries SET status = 'cancelled', updated_at = now() WHERE id = $1",
      [entry.id]
    );

    await client.query('COMMIT');
    res.status(200).json({
      success: true,
      message: 'Successfully left the waitlist',
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to leave waitlist', details: { error: err.message } },
    });
  } finally {
    client.release();
  }
});

// GET /waitlist/me and GET /trips/waitlist/me - View all active waitlist entries for current user
const getUserWaitlistsHandler = async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  try {
    const result = await pool.query(
      `SELECT w.id, w.trip_id, w.party_size, w.status, w.created_at, w.booking_id,
              st.depart_at, st.arrive_at, sr.name AS route_name,
              sr.origin_name, sr.destination_name,
              v.plate_no, v.type AS vehicle_type,
              (
                SELECT COUNT(*)
                FROM booking.waitlist_entries w2
                WHERE w2.trip_id = w.trip_id AND w2.status = 'waiting' AND w2.created_at <= w.created_at
              ) AS position
       FROM booking.waitlist_entries w
       JOIN booking.shuttle_trips st ON st.id = w.trip_id
       JOIN booking.shuttle_routes sr ON sr.id = st.route_id
       JOIN booking.vehicles v ON v.id = st.vehicle_id
       WHERE w.user_id = $1 AND w.status = 'waiting'
       ORDER BY w.created_at DESC`,
      [userId]
    );

    res.status(200).json({
      waitlist: result.rows.map((row) => ({
        id: Number(row.id),
        tripId: Number(row.trip_id),
        partySize: Number(row.party_size),
        status: row.status,
        position: Number(row.position),
        createdAt: row.created_at,
        departAt: row.depart_at,
        arriveAt: row.arrive_at,
        routeName: row.route_name,
        originName: row.origin_name,
        destinationName: row.destination_name,
        plateNo: row.plate_no,
        vehicleType: row.vehicle_type,
      })),
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch waitlists', details: { error: err.message } },
    });
  }
};

bookingRouter.get('/waitlist/me', requireAuth, getUserWaitlistsHandler);
bookingRouter.get('/trips/waitlist/me', requireAuth, getUserWaitlistsHandler);

// ============================================================================
// 5. TEMPORARY SEAT HOLDS (M2-07)
// ============================================================================

// POST /trips/:id/holds - Create temporary seat hold
bookingRouter.post('/trips/:id/holds', requireAuth, async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be integer', details: {} } });
    return;
  }

  const parseResult = holdSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid hold request payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { partySize, seatIds, requireAccessible } = parseResult.data;
  const userId = req.user!.userId;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock trip
    const tripRes = await client.query(
      'SELECT id, vehicle_id, status, booking_cutoff_at FROM booking.shuttle_trips WHERE id = $1 FOR UPDATE',
      [tripId]
    );
    if (tripRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { code: 'TRIP_NOT_FOUND', message: 'Trip does not exist', details: {} } });
      return;
    }
    const trip = tripRes.rows[0];

    if (trip.status !== 'scheduled') {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: { code: 'TRIP_NOT_BOOKABLE', message: `Trip status is '${trip.status}', holds not allowed`, details: {} },
      });
      return;
    }

    if (new Date() > new Date(trip.booking_cutoff_at)) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: { code: 'CUTOFF_PASSED', message: 'Booking cutoff time has passed for this trip', details: { cutoff: trip.booking_cutoff_at } },
      });
      return;
    }

    // 2. Check if user already holds confirmed booking on this trip
    const activeBooking = await client.query(
      "SELECT id FROM booking.bookings WHERE trip_id = $1 AND user_id = $2 AND status = 'confirmed'",
      [tripId, userId]
    );
    if (activeBooking.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: {
          code: 'ALREADY_BOOKED',
          message: 'User already holds an active booking on this trip',
          details: { existingBookingId: activeBooking.rows[0].id },
        },
      });
      return;
    }

    // 3. Check if user already has an active hold on this trip
    const activeHold = await client.query(
      "SELECT id, expires_at FROM booking.holds WHERE trip_id = $1 AND user_id = $2 AND status = 'held' AND expires_at > now()",
      [tripId, userId]
    );
    if (activeHold.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: {
          code: 'ACTIVE_HOLD_EXISTS',
          message: 'User already holds an active seat hold on this trip',
          details: { existingHoldId: activeHold.rows[0].id, expiresAt: activeHold.rows[0].expires_at },
        },
      });
      return;
    }

    // 4. Expire stale holds
    await expireStaleHolds(client, tripId);

    // 5. Allocate seats
    let allocation;
    try {
      allocation = await allocateSeats(client, {
        tripId,
        vehicleId: trip.vehicle_id,
        partySize,
        explicitSeatIds: seatIds,
        requireAccessible,
      });
    } catch (allocErr: any) {
      await client.query('ROLLBACK');
      if (allocErr instanceof SeatAllocationError) {
        res.status(allocErr.status).json({
          error: { code: allocErr.code, message: allocErr.message, details: allocErr.details },
        });
        return;
      }
      throw allocErr;
    }

    const durationMinutes = HOLD_DURATION_MINUTES;
    const holdRes = await client.query(
      `INSERT INTO booking.holds (trip_id, user_id, party_size, status, expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'held', now() + ($4 || ' minutes')::interval, now(), now())
       RETURNING id, trip_id, user_id, party_size, status, expires_at, created_at`,
      [tripId, userId, partySize, durationMinutes.toString()]
    );
    const hold = holdRes.rows[0];

    // Insert seat_holds
    for (const seatId of allocation.seatIds) {
      await client.query(
        `INSERT INTO booking.seat_holds (hold_id, trip_id, seat_id, user_id, status, expires_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'held', $5, now(), now())`,
        [hold.id, tripId, seatId, userId, hold.expires_at]
      );
    }

    await client.query('COMMIT');

    const expiresInSeconds = Math.max(0, Math.floor((new Date(hold.expires_at).getTime() - Date.now()) / 1000));

    res.status(201).json({
      hold: {
        id: hold.id,
        tripId: hold.trip_id,
        userId: hold.user_id,
        partySize: hold.party_size,
        status: hold.status,
        expiresAt: hold.expires_at,
        expiresInSeconds,
        seatIds: allocation.seatIds,
        seats: allocation.seats,
        allocationType: allocation.allocationType,
      },
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Hold creation error:', err);
    if (err.code === '23505') {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Seat already held or concurrent reservation detected', details: {} },
      });
      return;
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create seat hold', details: { error: err.message } },
    });
  } finally {
    client.release();
  }
});

// GET /trips/:id/holds/:holdId - Retrieve hold details and remaining seconds
bookingRouter.get('/trips/:id/holds/:holdId', requireAuth, async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  const holdId = parseInt(req.params.holdId, 10);
  if (isNaN(tripId) || isNaN(holdId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID and Hold ID must be integers', details: {} } });
    return;
  }

  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'admin';

  try {
    await expireStaleHolds(pool as any, tripId);

    const holdRes = await pool.query(
      `SELECT h.id, h.trip_id, h.user_id, h.party_size, h.status, h.expires_at, h.created_at, h.booking_id,
              COALESCE(
                json_agg(json_build_object('id', s.id, 'label', s.seat_label, 'row', s.row_no, 'col', s.col_no))
                FILTER (WHERE s.id IS NOT NULL), '[]'
              ) AS seats
       FROM booking.holds h
       LEFT JOIN booking.seat_holds sh ON sh.hold_id = h.id
       LEFT JOIN booking.seats s ON s.id = sh.seat_id
       WHERE h.id = $1 AND h.trip_id = $2
       GROUP BY h.id`,
      [holdId, tripId]
    );

    if (holdRes.rows.length === 0) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hold not found', details: {} } });
      return;
    }

    const hold = holdRes.rows[0];
    if (!isAdmin && Number(hold.user_id) !== Number(userId)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Access denied to this hold', details: {} } });
      return;
    }

    const isExpired = new Date(hold.expires_at) <= new Date() || hold.status === 'expired';
    const expiresInSeconds = isExpired ? 0 : Math.max(0, Math.floor((new Date(hold.expires_at).getTime() - Date.now()) / 1000));

    res.status(200).json({
      hold: {
        id: hold.id,
        tripId: hold.trip_id,
        userId: hold.user_id,
        partySize: hold.party_size,
        status: isExpired && hold.status === 'held' ? 'expired' : hold.status,
        expiresAt: hold.expires_at,
        expiresInSeconds,
        seats: hold.seats,
        bookingId: hold.booking_id,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch hold', details: { error: err.message } },
    });
  }
});

// POST /trips/:id/holds/:holdId/confirm - Confirm active hold into booking
bookingRouter.post('/trips/:id/holds/:holdId/confirm', requireAuth, async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  const holdId = parseInt(req.params.holdId, 10);
  if (isNaN(tripId) || isNaN(holdId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID and Hold ID must be integers', details: {} } });
    return;
  }

  const userId = req.user!.userId;
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency replay check
    if (idempotencyKey) {
      const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
      const idemRes = await client.query(
        'SELECT response_json, request_hash FROM booking.idempotency_keys WHERE user_id = $1 AND key = $2',
        [userId, idempotencyKey]
      );
      if (idemRes.rows.length > 0) {
        if (idemRes.rows[0].request_hash !== bodyHash) {
          await client.query('ROLLBACK');
          res.status(422).json({
            error: {
              code: 'IDEMPOTENCY_MISMATCH',
              message: 'Idempotency key reuse with differing request payload',
              details: {},
            },
          });
          return;
        }
        await client.query('ROLLBACK');
        res.status(200).json(idemRes.rows[0].response_json);
        return;
      }
    }

    // 1. Lock trip
    const tripRes = await client.query(
      'SELECT id, vehicle_id, status FROM booking.shuttle_trips WHERE id = $1 FOR UPDATE',
      [tripId]
    );
    if (tripRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { code: 'TRIP_NOT_FOUND', message: 'Trip does not exist', details: {} } });
      return;
    }

    // 2. Lock hold
    const holdRes = await client.query(
      'SELECT id, trip_id, user_id, party_size, status, expires_at, booking_id FROM booking.holds WHERE id = $1 AND trip_id = $2 FOR UPDATE',
      [holdId, tripId]
    );
    if (holdRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { code: 'HOLD_NOT_FOUND', message: 'Seat hold does not exist', details: {} } });
      return;
    }

    const hold = holdRes.rows[0];

    // 3. Verify ownership
    if (Number(hold.user_id) !== Number(userId)) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot confirm another user hold', details: {} } });
      return;
    }

    // 4. If already confirmed, idempotent return
    if (hold.status === 'confirmed') {
      const existingBookingRes = await client.query(
        `SELECT b.id, b.trip_id, b.user_id, b.party_size, b.status, b.created_at,
                COALESCE(array_agg(sa.seat_id) FILTER (WHERE sa.seat_id IS NOT NULL), '{}') AS assigned_seat_ids
         FROM booking.bookings b
         LEFT JOIN booking.seat_assignments sa ON sa.booking_id = b.id AND sa.status = 'active'
         WHERE b.id = $1
         GROUP BY b.id`,
        [hold.booking_id]
      );
      await client.query('COMMIT');
      const b = existingBookingRes.rows[0];
      res.status(200).json({
        booking: {
          id: b.id,
          tripId: b.trip_id,
          userId: b.user_id,
          partySize: b.party_size,
          status: b.status,
          assignedSeatIds: b.assigned_seat_ids,
          createdAt: b.created_at,
        },
      });
      return;
    }

    // 5. Verify hold is active and unexpired
    if (hold.status !== 'held' || new Date(hold.expires_at) <= new Date()) {
      if (hold.status === 'held') {
        await client.query("UPDATE booking.holds SET status = 'expired', updated_at = now() WHERE id = $1", [holdId]);
        await client.query("UPDATE booking.seat_holds SET status = 'expired', updated_at = now() WHERE hold_id = $1", [holdId]);
      }
      await client.query('ROLLBACK');
      res.status(409).json({
        error: {
          code: 'HOLD_EXPIRED',
          message: 'Seat hold has expired or is no longer valid',
          details: { status: hold.status, expiresAt: hold.expires_at },
        },
      });
      return;
    }

    // 6. Fetch held seats
    const seatsRes = await client.query(
      "SELECT seat_id FROM booking.seat_holds WHERE hold_id = $1 AND status = 'held'",
      [holdId]
    );
    const heldSeatIds: number[] = seatsRes.rows.map((r) => r.seat_id);

    // 7. Create booking
    const bookingRes = await client.query(
      `INSERT INTO booking.bookings (trip_id, user_id, party_size, status)
       VALUES ($1, $2, $3, 'confirmed')
       RETURNING id, trip_id, user_id, party_size, status, created_at`,
      [tripId, userId, hold.party_size]
    );
    const newBooking = bookingRes.rows[0];

    // 8. Convert seat_holds to seat_assignments
    for (const seatId of heldSeatIds) {
      await client.query(
        `INSERT INTO booking.seat_assignments (booking_id, trip_id, seat_id, status)
         VALUES ($1, $2, $3, 'active')`,
        [newBooking.id, tripId, seatId]
      );
    }

    // 9. Update hold to confirmed
    await client.query(
      `UPDATE booking.holds
       SET status = 'confirmed', confirmed_at = now(), booking_id = $1, updated_at = now()
       WHERE id = $2`,
      [newBooking.id, holdId]
    );
    await client.query(
      "UPDATE booking.seat_holds SET status = 'confirmed', updated_at = now() WHERE hold_id = $1",
      [holdId]
    );

    // 10. Audit record
    await client.query(
      `INSERT INTO booking.booking_audit (booking_id, from_status, to_status, actor_id, reason)
       VALUES ($1, 'held', 'confirmed', $2, 'Hold confirmed by user')`,
      [newBooking.id, userId]
    );

    const responsePayload = {
      booking: {
        id: newBooking.id,
        tripId: newBooking.trip_id,
        userId: newBooking.user_id,
        partySize: newBooking.party_size,
        status: newBooking.status,
        assignedSeatIds: heldSeatIds,
        createdAt: newBooking.created_at,
      },
    };

    if (idempotencyKey) {
      const bodyHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');
      await client.query(
        `INSERT INTO booking.idempotency_keys (key, user_id, request_hash, response_json)
         VALUES ($1, $2, $3, $4)`,
        [idempotencyKey, userId, bodyHash, responsePayload]
      );
    }

    await client.query('COMMIT');
    res.status(200).json(responsePayload);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Hold confirmation error:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to confirm seat hold', details: { error: err.message } },
    });
  } finally {
    client.release();
  }
});

// DELETE /trips/:id/holds/:holdId - Release hold early
bookingRouter.delete('/trips/:id/holds/:holdId', requireAuth, async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  const holdId = parseInt(req.params.holdId, 10);
  if (isNaN(tripId) || isNaN(holdId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID and Hold ID must be integers', details: {} } });
    return;
  }

  const userId = req.user!.userId;
  const isAdmin = req.user!.role === 'admin';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const holdRes = await client.query(
      'SELECT id, user_id, status FROM booking.holds WHERE id = $1 AND trip_id = $2 FOR UPDATE',
      [holdId, tripId]
    );

    if (holdRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Hold not found', details: {} } });
      return;
    }

    const hold = holdRes.rows[0];
    if (!isAdmin && Number(hold.user_id) !== Number(userId)) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You cannot release another user hold', details: {} } });
      return;
    }

    if (hold.status === 'held') {
      await client.query("UPDATE booking.holds SET status = 'released', updated_at = now() WHERE id = $1", [holdId]);
      await client.query("UPDATE booking.seat_holds SET status = 'released', updated_at = now() WHERE hold_id = $1", [holdId]);
    }

    await client.query('COMMIT');
    res.status(200).json({ success: true, message: 'Hold successfully released' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to release hold', details: { error: err.message } },
    });
  } finally {
    client.release();
  }
});
