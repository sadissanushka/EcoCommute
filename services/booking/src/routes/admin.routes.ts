import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../db/pool';
import { requireAuth, requireRole } from '../middleware/auth';

export const adminRouter = Router();

// Enforce admin authentication across all admin endpoints
adminRouter.use(requireAuth);
adminRouter.use(requireRole('admin'));

// Validation Schemas
const adminDispatchSchema = z.object({
  status: z.enum(['scheduled', 'boarding', 'in_progress', 'completed', 'cancelled']).optional(),
  driverId: z.number().int().positive().nullable().optional(),
  vehicleId: z.number().int().positive().optional(),
  departAt: z.string().datetime().optional(),
  arriveAt: z.string().datetime().optional(),
  bookingCutoffAt: z.string().datetime().optional(),
  reason: z.string().optional(),
});

const adminCreateTripSchema = z.object({
  routeId: z.number().int().positive(),
  vehicleId: z.number().int().positive(),
  driverId: z.number().int().positive().optional(),
  departAt: z.string().datetime(),
  arriveAt: z.string().datetime(),
  bookingCutoffAt: z.string().datetime(),
});

// Allowed status lifecycle transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  scheduled: ['boarding', 'cancelled'],
  boarding: ['in_progress', 'cancelled', 'scheduled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

// ============================================================================
// 1. GET /admin/trips - List all trips across all statuses with occupancy metrics
// ============================================================================
adminRouter.get('/trips', async (req: Request, res: Response) => {
  try {
    const { status, date, search, routeId } = req.query;
    const companyId = req.user?.companyId;

    let query = `
      SELECT 
        st.id,
        st.route_id,
        sr.name AS route_name,
        sr.origin_name,
        sr.destination_name,
        sr.stops_json,
        sr.company_id AS route_company_id,
        st.vehicle_id,
        v.plate_no,
        v.type AS vehicle_type,
        v.capacity AS total_capacity,
        v.active AS vehicle_active,
        st.driver_id,
        u.full_name AS driver_name,
        u.email AS driver_email,
        d.licence_no AS driver_licence,
        st.depart_at,
        st.arrive_at,
        st.status,
        st.booking_cutoff_at,
        st.version,
        st.created_at,
        COALESCE(booked.count, 0) AS booked_seats,
        (v.capacity - COALESCE(booked.count, 0)) AS available_seats,
        COALESCE(passengers.count, 0) AS passenger_count,
        COALESCE(waitlist.count, 0) AS waitlist_count
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
      LEFT JOIN (
        SELECT trip_id, COUNT(DISTINCT user_id) AS count
        FROM booking.bookings
        WHERE status IN ('confirmed', 'held', 'boarded')
        GROUP BY trip_id
      ) passengers ON passengers.trip_id = st.id
      LEFT JOIN (
        SELECT trip_id, COUNT(*) AS count
        FROM booking.waitlist_entries
        WHERE status = 'waiting'
        GROUP BY trip_id
      ) waitlist ON waitlist.trip_id = st.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let idx = 1;

    // Company scoping
    if (companyId) {
      query += ` AND (sr.company_id = $${idx} OR sr.company_id IS NULL)`;
      params.push(companyId);
      idx++;
    }

    // Status filter
    if (status && status !== 'all') {
      query += ` AND st.status = $${idx}`;
      params.push(status);
      idx++;
    }

    // Date filter
    if (date) {
      query += ` AND DATE(st.depart_at) = $${idx}`;
      params.push(date);
      idx++;
    }

    // Route ID filter
    if (routeId) {
      query += ` AND st.route_id = $${idx}`;
      params.push(parseInt(routeId as string, 10));
      idx++;
    }

    // Text search (route name, origin, destination, vehicle plate, driver name)
    if (search) {
      query += ` AND (
        sr.name ILIKE $${idx} OR 
        sr.origin_name ILIKE $${idx} OR 
        sr.destination_name ILIKE $${idx} OR 
        v.plate_no ILIKE $${idx} OR 
        u.full_name ILIKE $${idx}
      )`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY st.depart_at ASC`;

    const result = await pool.query(query, params);

    const trips = result.rows.map((t) => {
      const capacity = parseInt(t.total_capacity, 10);
      const bookedSeats = parseInt(t.booked_seats, 10);
      const availableSeats = Math.max(0, capacity - bookedSeats);
      const occupancyRate = capacity > 0 ? Math.round((bookedSeats / capacity) * 100) : 0;

      return {
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
          capacity,
          active: t.vehicle_active,
        },
        driver: t.driver_id
          ? {
            id: t.driver_id,
            name: t.driver_name,
            email: t.driver_email,
            licenceNo: t.driver_licence,
          }
          : null,
        departAt: t.depart_at,
        arriveAt: t.arrive_at,
        bookingCutoffAt: t.booking_cutoff_at,
        status: t.status,
        version: t.version,
        capacity,
        bookedSeats,
        availableSeats,
        occupancyRate,
        passengerCount: parseInt(t.passenger_count, 10),
        waitlistCount: parseInt(t.waitlist_count, 10),
        createdAt: t.created_at,
      };
    });

    res.status(200).json({ trips });
  } catch (err: any) {
    console.error('Error in GET /admin/trips:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch admin trips', details: { error: err.message } },
    });
  }
});

// ============================================================================
// 2. GET /admin/trips/:id - Detail view with real-time seat assignments
// ============================================================================
adminRouter.get('/trips/:id', async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be an integer', details: {} } });
    return;
  }

  try {
    const tripRes = await pool.query(
      `SELECT st.*, sr.name AS route_name, sr.origin_name, sr.destination_name, sr.stops_json,
              sr.company_id AS route_company_id,
              v.plate_no, v.type AS vehicle_type, v.capacity, v.seat_layout_json, v.active AS vehicle_active,
              u.full_name AS driver_name, u.email AS driver_email, d.licence_no AS driver_licence
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

    // Company scoping check
    if (req.user?.companyId && trip.route_company_id && trip.route_company_id !== req.user.companyId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Trip belongs to a different organization', details: {} } });
      return;
    }

    // Fetch all seats with assignment and passenger mapping
    const seatsRes = await pool.query(
      `SELECT s.id, s.seat_label, s.row_no, s.col_no, s.is_window, s.is_aisle, s.is_accessible,
              sa.id AS assignment_id,
              sa.booking_id,
              b.user_id,
              u.full_name AS passenger_name,
              u.email AS passenger_email,
              b.status AS booking_status
       FROM booking.seats s
       LEFT JOIN booking.seat_assignments sa ON sa.seat_id = s.id AND sa.trip_id = $1 AND sa.status = 'active'
       LEFT JOIN booking.bookings b ON b.id = sa.booking_id
       LEFT JOIN core.users u ON u.id = b.user_id
       WHERE s.vehicle_id = $2
       ORDER BY s.row_no ASC, s.col_no ASC`,
      [tripId, trip.vehicle_id]
    );

    const bookedCount = seatsRes.rows.filter((s) => s.assignment_id !== null).length;
    const capacity = parseInt(trip.capacity, 10);
    const availableCount = Math.max(0, capacity - bookedCount);
    const occupancyRate = capacity > 0 ? Math.round((bookedCount / capacity) * 100) : 0;

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
        bookingCutoffAt: trip.booking_cutoff_at,
        status: trip.status,
        version: trip.version,
        vehicle: {
          id: trip.vehicle_id,
          plateNo: trip.plate_no,
          type: trip.vehicle_type,
          capacity,
          layout: trip.seat_layout_json,
          active: trip.vehicle_active,
        },
        driver: trip.driver_id
          ? {
            id: trip.driver_id,
            name: trip.driver_name,
            email: trip.driver_email,
            licenceNo: trip.driver_licence,
          }
          : null,
        metrics: {
          capacity,
          bookedSeats: bookedCount,
          availableSeats: availableCount,
          occupancyRate,
        },
        seats: seatsRes.rows.map((s) => ({
          id: s.id,
          label: s.seat_label,
          row: s.row_no,
          col: s.col_no,
          isWindow: s.is_window,
          isAisle: s.is_aisle,
          isAccessible: s.is_accessible,
          isAvailable: s.assignment_id === null,
          assignment: s.assignment_id
            ? {
              bookingId: s.booking_id,
              userId: s.user_id,
              passengerName: s.passenger_name,
              passengerEmail: s.passenger_email,
              bookingStatus: s.booking_status,
            }
            : null,
        })),
      },
    });
  } catch (err: any) {
    console.error('Error in GET /admin/trips/:id:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch trip details', details: { error: err.message } },
    });
  }
});

// ============================================================================
// 3. GET /admin/trips/:id/manifest - Passenger manifest with seat assignments
// ============================================================================
adminRouter.get('/trips/:id/manifest', async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be an integer', details: {} } });
    return;
  }

  try {
    // Check trip exists
    const tripRes = await pool.query(
      `SELECT st.id, st.status, st.depart_at, st.arrive_at,
              sr.name AS route_name, sr.origin_name, sr.destination_name, sr.company_id AS route_company_id,
              v.plate_no, v.type AS vehicle_type, v.capacity,
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
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trip not found', details: {} } });
      return;
    }

    const trip = tripRes.rows[0];

    // Company scoping check
    if (req.user?.companyId && trip.route_company_id && trip.route_company_id !== req.user.companyId) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Trip belongs to a different organization', details: {} } });
      return;
    }

    // Query manifest with passenger details & seat assignments
    const manifestRes = await pool.query(
      `SELECT 
        b.id AS booking_id,
        b.user_id,
        u.full_name AS passenger_name,
        u.email AS passenger_email,
        u.gender AS passenger_gender,
        b.party_size,
        b.status AS booking_status,
        b.created_at AS booked_at,
        COALESCE(
          json_agg(
            json_build_object(
              'seatId', s.id,
              'label', s.seat_label,
              'row', s.row_no,
              'col', s.col_no,
              'isAccessible', s.is_accessible,
              'isWindow', s.is_window,
              'isAisle', s.is_aisle
            ) ORDER BY s.row_no, s.col_no
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS assigned_seats
      FROM booking.bookings b
      JOIN core.users u ON u.id = b.user_id
      LEFT JOIN booking.seat_assignments sa ON sa.booking_id = b.id AND sa.status = 'active'
      LEFT JOIN booking.seats s ON s.id = sa.seat_id
      WHERE b.trip_id = $1 AND b.status IN ('confirmed', 'held', 'boarded')
      GROUP BY b.id, b.user_id, u.full_name, u.email, u.gender, b.party_size, b.status, b.created_at
      ORDER BY b.created_at ASC`,
      [tripId]
    );

    const manifest = manifestRes.rows.map((row) => ({
      bookingId: row.booking_id,
      userId: row.user_id,
      passengerName: row.passenger_name,
      passengerEmail: row.passenger_email,
      passengerGender: row.passenger_gender,
      partySize: row.party_size,
      bookingStatus: row.booking_status,
      bookedAt: row.booked_at,
      assignedSeats: row.assigned_seats || [],
    }));

    const capacity = parseInt(trip.capacity, 10);
    const totalOccupiedSeats = manifest.reduce((acc, m) => acc + (m.assignedSeats?.length || m.partySize), 0);
    const totalPassengers = manifest.reduce((acc, m) => acc + m.partySize, 0);

    res.status(200).json({
      trip: {
        id: trip.id,
        routeName: trip.route_name,
        originName: trip.origin_name,
        destinationName: trip.destination_name,
        departAt: trip.depart_at,
        arriveAt: trip.arrive_at,
        status: trip.status,
        vehiclePlate: trip.plate_no,
        vehicleType: trip.vehicle_type,
        driverName: trip.driver_name,
      },
      summary: {
        totalBookings: manifest.length,
        totalPassengers,
        occupiedSeats: totalOccupiedSeats,
        capacity,
        availableSeats: Math.max(0, capacity - totalOccupiedSeats),
        occupancyRate: capacity > 0 ? Math.round((totalOccupiedSeats / capacity) * 100) : 0,
      },
      manifest,
    });
  } catch (err: any) {
    console.error('Error in GET /admin/trips/:id/manifest:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch passenger manifest', details: { error: err.message } },
    });
  }
});

// ============================================================================
// 4. PATCH /admin/trips/:id/dispatch - Dispatch actions (status, vehicle, driver)
// ============================================================================
adminRouter.patch('/trips/:id/dispatch', async (req: Request, res: Response) => {
  const tripId = parseInt(req.params.id, 10);
  if (isNaN(tripId)) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Trip ID must be an integer', details: {} } });
    return;
  }

  const parseResult = adminDispatchSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid dispatch payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { status: targetStatus, driverId, vehicleId, departAt, arriveAt, bookingCutoffAt, reason } = parseResult.data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch existing trip record
    const tripRes = await client.query(
      `SELECT st.*, sr.company_id AS route_company_id, v.capacity AS current_vehicle_capacity
       FROM booking.shuttle_trips st
       JOIN booking.shuttle_routes sr ON sr.id = st.route_id
       JOIN booking.vehicles v ON v.id = st.vehicle_id
       WHERE st.id = $1
       FOR UPDATE`,
      [tripId]
    );

    if (tripRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Trip not found', details: {} } });
      return;
    }

    const currentTrip = tripRes.rows[0];

    // Company scoping check
    if (req.user?.companyId && currentTrip.route_company_id && currentTrip.route_company_id !== req.user.companyId) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Trip belongs to a different organization', details: {} } });
      return;
    }

    // 1. Status Lifecycle Validation
    if (targetStatus && targetStatus !== currentTrip.status) {
      const allowedNext = VALID_TRANSITIONS[currentTrip.status] || [];
      if (!allowedNext.includes(targetStatus)) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `Cannot transition trip status from '${currentTrip.status}' to '${targetStatus}'. Allowed next statuses: [${allowedNext.join(', ')}]`,
            details: {
              currentStatus: currentTrip.status,
              targetStatus,
              allowedNextStatuses: allowedNext,
            },
          },
        });
        return;
      }
    }

    // 2. Driver Validation (if updating driver)
    if (driverId !== undefined && driverId !== null) {
      const driverRes = await client.query(
        'SELECT id, active FROM booking.drivers WHERE id = $1',
        [driverId]
      );
      if (driverRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: { code: 'DRIVER_NOT_FOUND', message: 'Assigned driver does not exist', details: {} } });
        return;
      }
      if (!driverRes.rows[0].active) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: { code: 'DRIVER_INACTIVE', message: 'Assigned driver is inactive', details: {} } });
        return;
      }
    }

    // 3. Vehicle Validation & Capacity check (if updating vehicle)
    if (vehicleId !== undefined && vehicleId !== currentTrip.vehicle_id) {
      const vehicleRes = await client.query(
        'SELECT id, capacity, active FROM booking.vehicles WHERE id = $1',
        [vehicleId]
      );
      if (vehicleRes.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: { code: 'VEHICLE_NOT_FOUND', message: 'Assigned vehicle does not exist', details: {} } });
        return;
      }
      const newVehicle = vehicleRes.rows[0];
      if (!newVehicle.active) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: { code: 'VEHICLE_INACTIVE', message: 'Assigned vehicle is inactive', details: {} } });
        return;
      }

      // Check if new vehicle capacity is sufficient for currently booked seats
      const bookedCountRes = await client.query(
        `SELECT COUNT(*) AS count FROM booking.seat_assignments WHERE trip_id = $1 AND status = 'active'`,
        [tripId]
      );
      const bookedSeatsCount = parseInt(bookedCountRes.rows[0].count, 10);
      if (bookedSeatsCount > newVehicle.capacity) {
        await client.query('ROLLBACK');
        res.status(409).json({
          error: {
            code: 'INSUFFICIENT_VEHICLE_CAPACITY',
            message: `Cannot assign vehicle with capacity ${newVehicle.capacity}. Trip currently has ${bookedSeatsCount} confirmed seat bookings.`,
            details: {
              requiredCapacity: bookedSeatsCount,
              newVehicleCapacity: newVehicle.capacity,
            },
          },
        });
        return;
      }
    }

    // 4. Timing validations
    const effectiveDepart = departAt ? new Date(departAt) : new Date(currentTrip.depart_at);
    const effectiveArrive = arriveAt ? new Date(arriveAt) : new Date(currentTrip.arrive_at);
    const effectiveCutoff = bookingCutoffAt ? new Date(bookingCutoffAt) : new Date(currentTrip.booking_cutoff_at);

    if (effectiveCutoff >= effectiveDepart) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: { code: 'INVALID_CUTOFF', message: 'Booking cutoff must be strictly before departure time', details: {} },
      });
      return;
    }
    if (effectiveDepart >= effectiveArrive) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: { code: 'INVALID_TIMING', message: 'Departure time must be before arrival time', details: {} },
      });
      return;
    }

    // 5. Build dynamic update statement
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (targetStatus !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(targetStatus);
    }
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
    if (bookingCutoffAt !== undefined) {
      updates.push(`booking_cutoff_at = $${idx++}`);
      values.push(bookingCutoffAt);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: { code: 'NO_UPDATES', message: 'No fields provided for dispatch update', details: {} } });
      return;
    }

    updates.push(`version = version + 1`);
    values.push(tripId);

    const updateQuery = `UPDATE booking.shuttle_trips SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`;
    const updateRes = await client.query(updateQuery, values);
    const updatedTrip = updateRes.rows[0];

    // If cancelled, record domain event and update bookings status if active
    if (targetStatus === 'cancelled') {
      await client.query(
        `INSERT INTO booking.domain_events (event_type, payload)
         VALUES ('trip.cancelled', $1::jsonb)`,
        [JSON.stringify({ tripId, actorId: req.user?.userId, reason: reason || 'Cancelled by Fleet Admin' })]
      );
    }

    await client.query('COMMIT');

    res.status(200).json({
      trip: updatedTrip,
      message: `Trip #${tripId} successfully updated to status '${updatedTrip.status}'`,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('Error in PATCH /admin/trips/:id/dispatch:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update trip dispatch', details: { error: err.message } },
    });
  } finally {
    client.release();
  }
});

// ============================================================================
// 5. GET /admin/drivers - Active drivers lookup for dispatch assignment
// ============================================================================
adminRouter.get('/drivers', async (req: Request, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    let query = `
      SELECT d.id, d.user_id, d.licence_no, d.active, d.company_id,
             u.full_name, u.email, u.gender
      FROM booking.drivers d
      JOIN core.users u ON u.id = d.user_id
      WHERE d.active = true
    `;
    const params: any[] = [];
    if (companyId) {
      query += ` AND (d.company_id = $1 OR d.company_id IS NULL)`;
      params.push(companyId);
    }
    query += ` ORDER BY u.full_name ASC`;

    const result = await pool.query(query, params);
    res.status(200).json({
      drivers: result.rows.map((d) => ({
        id: d.id,
        userId: d.user_id,
        fullName: d.full_name,
        email: d.email,
        licenceNo: d.licence_no,
        gender: d.gender,
        active: d.active,
      })),
    });
  } catch (err: any) {
    console.error('Error in GET /admin/drivers:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch drivers', details: { error: err.message } },
    });
  }
});

// ============================================================================
// 6. GET /admin/routes - Active shuttle routes lookup
// ============================================================================
adminRouter.get('/routes', async (req: Request, res: Response) => {
  try {
    const companyId = req.user?.companyId;
    let query = `
      SELECT id, company_id, name, origin_name, destination_name, distance_m, estimated_duration_s, stops_json, active
      FROM booking.shuttle_routes
      WHERE active = true
    `;
    const params: any[] = [];
    if (companyId) {
      query += ` AND (company_id = $1 OR company_id IS NULL)`;
      params.push(companyId);
    }
    query += ` ORDER BY name ASC`;

    const result = await pool.query(query, params);
    res.status(200).json({
      routes: result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        originName: r.origin_name,
        destinationName: r.destination_name,
        distanceM: r.distance_m,
        estimatedDurationS: r.estimated_duration_s,
        stops: r.stops_json,
        active: r.active,
      })),
    });
  } catch (err: any) {
    console.error('Error in GET /admin/routes:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch shuttle routes', details: { error: err.message } },
    });
  }
});

// ============================================================================
// 7. POST /admin/trips - Admin schedules a new trip
// ============================================================================
adminRouter.post('/trips', async (req: Request, res: Response) => {
  const parseResult = adminCreateTripSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid trip creation payload',
        details: parseResult.error.flatten().fieldErrors,
      },
    });
    return;
  }

  const { routeId, vehicleId, driverId, departAt, arriveAt, bookingCutoffAt } = parseResult.data;

  const dDepart = new Date(departAt);
  const dArrive = new Date(arriveAt);
  const dCutoff = new Date(bookingCutoffAt);

  if (dCutoff >= dDepart) {
    res.status(400).json({
      error: { code: 'INVALID_CUTOFF', message: 'bookingCutoffAt must be strictly before departAt', details: {} },
    });
    return;
  }
  if (dDepart >= dArrive) {
    res.status(400).json({
      error: { code: 'INVALID_TIMING', message: 'departAt must be before arriveAt', details: {} },
    });
    return;
  }

  try {
    // Validate route and vehicle
    const routeCheck = await pool.query('SELECT id FROM booking.shuttle_routes WHERE id = $1', [routeId]);
    if (routeCheck.rows.length === 0) {
      res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Shuttle route not found', details: {} } });
      return;
    }

    const vehicleCheck = await pool.query('SELECT id, active FROM booking.vehicles WHERE id = $1', [vehicleId]);
    if (vehicleCheck.rows.length === 0) {
      res.status(404).json({ error: { code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found', details: {} } });
      return;
    }
    if (!vehicleCheck.rows[0].active) {
      res.status(400).json({ error: { code: 'VEHICLE_INACTIVE', message: 'Vehicle is currently inactive', details: {} } });
      return;
    }

    if (driverId) {
      const driverCheck = await pool.query('SELECT id, active FROM booking.drivers WHERE id = $1', [driverId]);
      if (driverCheck.rows.length === 0 || !driverCheck.rows[0].active) {
        res.status(400).json({ error: { code: 'INVALID_DRIVER', message: 'Driver not found or inactive', details: {} } });
        return;
      }
    }

    const insertRes = await pool.query(
      `INSERT INTO booking.shuttle_trips (route_id, vehicle_id, driver_id, depart_at, arrive_at, booking_cutoff_at, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
       RETURNING *`,
      [routeId, vehicleId, driverId || null, departAt, arriveAt, bookingCutoffAt]
    );

    res.status(201).json({ trip: insertRes.rows[0] });
  } catch (err: any) {
    console.error('Error in POST /admin/trips:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to schedule trip', details: { error: err.message } },
    });
  }
});

// ============================================================================
// 8. GET /admin/stats - KPI Operations Overview metrics
// ============================================================================
adminRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const companyId = req.user?.companyId;

    // Active vehicles & total fleet capacity
    const fleetRes = await pool.query(
      `SELECT COUNT(*) AS active_vehicles, COALESCE(SUM(capacity), 0) AS total_capacity
       FROM booking.vehicles
       WHERE active = true ${companyId ? 'AND (company_id = $1 OR company_id IS NULL)' : ''}`,
      companyId ? [companyId] : []
    );

    // Trips counts by status today
    const tripsRes = await pool.query(
      `SELECT 
         COUNT(*) FILTER (WHERE st.status = 'scheduled') AS scheduled_count,
         COUNT(*) FILTER (WHERE st.status = 'boarding') AS boarding_count,
         COUNT(*) FILTER (WHERE st.status = 'in_progress') AS in_progress_count,
         COUNT(*) FILTER (WHERE st.status = 'completed') AS completed_count,
         COUNT(*) FILTER (WHERE st.status = 'cancelled') AS cancelled_count,
         COUNT(*) AS total_trips
       FROM booking.shuttle_trips st
       JOIN booking.shuttle_routes sr ON sr.id = st.route_id
       WHERE DATE(st.depart_at) = CURRENT_DATE
         ${companyId ? 'AND (sr.company_id = $1 OR sr.company_id IS NULL)' : ''}`,
      companyId ? [companyId] : []
    );

    // Average occupancy rate across active trips
    const occupancyRes = await pool.query(
      `SELECT 
         COALESCE(SUM(v.capacity), 0) AS total_available_seats,
         COALESCE(COUNT(sa.id), 0) AS total_booked_seats
       FROM booking.shuttle_trips st
       JOIN booking.vehicles v ON v.id = st.vehicle_id
       JOIN booking.shuttle_routes sr ON sr.id = st.route_id
       LEFT JOIN booking.seat_assignments sa ON sa.trip_id = st.id AND sa.status = 'active'
       WHERE st.status IN ('scheduled', 'boarding', 'in_progress')
         ${companyId ? 'AND (sr.company_id = $1 OR sr.company_id IS NULL)' : ''}
       GROUP BY st.id`,
      companyId ? [companyId] : []
    );

    let avgOccupancy = 0;
    if (occupancyRes.rows.length > 0) {
      const sumBooked = occupancyRes.rows.reduce((acc, r) => acc + parseInt(r.total_booked_seats, 10), 0);
      const sumCap = occupancyRes.rows.reduce((acc, r) => acc + parseInt(r.total_available_seats, 10), 0);
      if (sumCap > 0) {
        avgOccupancy = Math.round((sumBooked / sumCap) * 100);
      }
    }

    // Waitlist count
    const waitlistRes = await pool.query(
      `SELECT COUNT(*) AS count
       FROM booking.waitlist_entries we
       JOIN booking.shuttle_trips st ON st.id = we.trip_id
       JOIN booking.shuttle_routes sr ON sr.id = st.route_id
       WHERE we.status = 'waiting'
         ${companyId ? 'AND (sr.company_id = $1 OR sr.company_id IS NULL)' : ''}`,
      companyId ? [companyId] : []
    );

    res.status(200).json({
      stats: {
        activeVehicles: parseInt(fleetRes.rows[0]?.active_vehicles || '0', 10),
        totalFleetCapacity: parseInt(fleetRes.rows[0]?.total_capacity || '0', 10),
        scheduledTripsToday: parseInt(tripsRes.rows[0]?.scheduled_count || '0', 10),
        activeTripsToday: parseInt(tripsRes.rows[0]?.boarding_count || '0', 10) + parseInt(tripsRes.rows[0]?.in_progress_count || '0', 10),
        completedTripsToday: parseInt(tripsRes.rows[0]?.completed_count || '0', 10),
        cancelledTripsToday: parseInt(tripsRes.rows[0]?.cancelled_count || '0', 10),
        totalTripsToday: parseInt(tripsRes.rows[0]?.total_trips || '0', 10),
        averageOccupancyRate: avgOccupancy,
        waitlistQueue: parseInt(waitlistRes.rows[0]?.count || '0', 10),
      },
    });
  } catch (err: any) {
    console.error('Error in GET /admin/stats:', err);
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch operational stats', details: { error: err.message } },
    });
  }
});

