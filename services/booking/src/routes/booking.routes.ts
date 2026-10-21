import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';

export const bookingRouter = Router();

const bookingSchema = z.object({
  partySize: z.number().int().min(1, 'Party size must be at least 1').max(6, 'Party size cannot exceed 6'),
  seatIds: z.array(z.number().int().positive()).optional(),
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
// 1. TRIP SEARCH & DETAIL (Step 1.3)
// ============================================================================

// GET /trips - Trip search with server-side availableSeats computation
bookingRouter.get('/trips', async (req: Request, res: Response) => {
  try {
    const { origin, destination, date, seatsNeeded } = req.query;
    const minSeats = seatsNeeded ? parseInt(seatsNeeded as string, 10) : 1;

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
        FROM booking.seat_assignments
        WHERE status = 'active'
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

// GET /trips/:id - Detail with seat map and seat availability
bookingRouter.get('/trips/:id', async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be integer', details: {} } });
    return;
  }

  try {
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
              CASE WHEN sa.id IS NOT NULL THEN false ELSE true END AS is_available
       FROM booking.seats s
       LEFT JOIN booking.seat_assignments sa ON sa.seat_id = s.id AND sa.trip_id = $1 AND sa.status = 'active'
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
// 2. ADMIN TRIP & VEHICLE MANAGEMENT (Step 1.3)
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
// 3. BOOKING CREATION & CANCELLATION (Step 1.4)
// ============================================================================

// POST /trips/:id/bookings - Transactional booking with cutoff, capacity, and idempotency
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

  const { partySize, seatIds } = parseResult.data;
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

    // 4. Find available seats (First-Available for Month 1)
    let assignedSeats: number[] = [];
    if (seatIds && seatIds.length > 0) {
      if (seatIds.length !== partySize) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: {
            code: 'SEAT_COUNT_MISMATCH',
            message: `Selected seats count (${seatIds.length}) does not match party size (${partySize})`,
            details: {},
          },
        });
        return;
      }

      // Check if chosen seats are free
      const freeSeatsRes = await client.query(
        `SELECT s.id FROM booking.seats s
         WHERE s.id = ANY($1) AND s.vehicle_id = $2
           AND NOT EXISTS (
             SELECT 1 FROM booking.seat_assignments sa
             WHERE sa.seat_id = s.id AND sa.trip_id = $3 AND sa.status = 'active'
           )`,
        [seatIds, trip.vehicle_id, tripId]
      );

      if (freeSeatsRes.rows.length !== seatIds.length) {
        await client.query('ROLLBACK');
        res.status(409).json({
          error: { code: 'SEAT_UNAVAILABLE', message: 'One or more requested seats are already taken', details: {} },
        });
        return;
      }
      assignedSeats = seatIds;
    } else {
      // Pick first available free seats
      const availableSeatsRes = await client.query(
        `SELECT s.id FROM booking.seats s
         WHERE s.vehicle_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM booking.seat_assignments sa
             WHERE sa.seat_id = s.id AND sa.trip_id = $2 AND sa.status = 'active'
           )
         ORDER BY s.row_no ASC, s.col_no ASC
         LIMIT $3 FOR UPDATE`,
        [trip.vehicle_id, tripId, partySize]
      );

      if (availableSeatsRes.rows.length < partySize) {
        await client.query('ROLLBACK');
        res.status(409).json({
          error: {
            code: 'INSUFFICIENT_CAPACITY',
            message: 'Not enough seats available on this shuttle trip',
            details: { requested: partySize, available: availableSeatsRes.rows.length },
          },
        });
        return;
      }
      assignedSeats = availableSeatsRes.rows.map((r) => r.id);
    }

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
    const result = await pool.query(
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
       GROUP BY b.id, st.depart_at, st.arrive_at, sr.name, sr.origin_name, sr.destination_name, v.plate_no, v.type
       ORDER BY b.created_at DESC`,
      [userId]
    );

    res.status(200).json({ bookings: result.rows });
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

// DELETE /bookings/:id - Cancel booking and release seats
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

    // Release seats
    await client.query(
      "UPDATE booking.seat_assignments SET status = 'released' WHERE booking_id = $1",
      [bookingId]
    );

    // Update booking status
    await client.query(
      "UPDATE booking.bookings SET status = 'cancelled', updated_at = now() WHERE id = $1",
      [bookingId]
    );

    // Write audit
    await client.query(
      `INSERT INTO booking.booking_audit (booking_id, from_status, to_status, actor_id, reason)
       VALUES ($1, $2, 'cancelled', $3, 'User cancelled booking')`,
      [bookingId, booking.status, userId]
    );

    await client.query('COMMIT');

    res.status(200).json({ success: true, message: 'Booking successfully cancelled' });
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
