import { PoolClient } from 'pg';

export interface SeatModel {
  id: number;
  vehicle_id: number;
  seat_label: string;
  row_no: number;
  col_no: number;
  is_window: boolean;
  is_aisle: boolean;
  is_accessible: boolean;
}

export interface VehicleLayoutConfig {
  rows?: number;
  cols?: number;
  aisleAfterCol?: number;
  aisles?: number[];
}

export interface AllocationRequest {
  tripId: number;
  vehicleId: number;
  partySize: number;
  explicitSeatIds?: number[];
  requireAccessible?: boolean;
}

export interface AllocationResult {
  seatIds: number[];
  seats: SeatModel[];
  allocationType: 'adjacent' | 'fallback' | 'explicit';
}

export class SeatAllocationError extends Error {
  code: string;
  status: number;
  details: Record<string, any>;

  constructor(code: string, message: string, status: number = 400, details: Record<string, any> = {}) {
    super(message);
    this.name = 'SeatAllocationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Checks whether an aisle sits between colA and colB (colB = colA + 1).
 */
export function isAisleBetween(colA: number, colB: number, layout: VehicleLayoutConfig): boolean {
  if (colB !== colA + 1) return true;

  if (layout.aisleAfterCol !== undefined && colA === layout.aisleAfterCol) {
    return true;
  }

  if (Array.isArray(layout.aisles) && layout.aisles.includes(colA)) {
    return true;
  }

  return false;
}

/**
 * Clean up stale holds before reading availability.
 */
export async function expireStaleHolds(client: PoolClient, tripId?: number): Promise<number> {
  const params: any[] = [];
  let queryHolds = `
    UPDATE booking.holds
    SET status = 'expired', updated_at = now()
    WHERE status = 'held' AND expires_at <= now()
  `;

  let querySeats = `
    UPDATE booking.seat_holds
    SET status = 'expired', updated_at = now()
    WHERE status = 'held' AND expires_at <= now()
  `;

  if (tripId !== undefined) {
    queryHolds += ' AND trip_id = $1';
    querySeats += ' AND trip_id = $1';
    params.push(tripId);
  }

  await client.query(querySeats, params);
  const res = await client.query(queryHolds, params);
  return res.rowCount || 0;
}

/**
 * Query all vehicle seats along with their availability on a given trip.
 */
export async function getTripSeatsWithAvailability(
  client: PoolClient,
  tripId: number,
  vehicleId: number
): Promise<{ allSeats: SeatModel[]; availableSeats: SeatModel[]; layout: VehicleLayoutConfig }> {
  // Expire stale holds first for real-time accuracy
  await expireStaleHolds(client, tripId);

  // Fetch vehicle layout
  const vehicleRes = await client.query(
    'SELECT seat_layout_json FROM booking.vehicles WHERE id = $1',
    [vehicleId]
  );
  const layout: VehicleLayoutConfig = vehicleRes.rows[0]?.seat_layout_json || {};

  // Fetch seats with real availability (excluding active assignments and active holds)
  const seatsRes = await client.query(
    `SELECT 
       s.id,
       s.vehicle_id,
       s.seat_label,
       s.row_no,
       s.col_no,
       s.is_window,
       s.is_aisle,
       s.is_accessible,
       CASE 
         WHEN sa.id IS NOT NULL THEN false
         WHEN sh.id IS NOT NULL THEN false
         ELSE true
       END AS is_available
     FROM booking.seats s
     LEFT JOIN booking.seat_assignments sa 
       ON sa.seat_id = s.id AND sa.trip_id = $1 AND sa.status = 'active'
     LEFT JOIN booking.seat_holds sh 
       ON sh.seat_id = s.id AND sh.trip_id = $1 AND sh.status = 'held' AND sh.expires_at > now()
     WHERE s.vehicle_id = $2
     ORDER BY s.row_no ASC, s.col_no ASC`,
    [tripId, vehicleId]
  );

  const allSeats: SeatModel[] = seatsRes.rows.map((r) => ({
    id: parseInt(r.id, 10),
    vehicle_id: parseInt(r.vehicle_id, 10),
    seat_label: r.seat_label,
    row_no: parseInt(r.row_no, 10),
    col_no: parseInt(r.col_no, 10),
    is_window: Boolean(r.is_window),
    is_aisle: Boolean(r.is_aisle),
    is_accessible: Boolean(r.is_accessible),
  }));

  const availableSeatIds = new Set(
    seatsRes.rows.filter((r) => r.is_available).map((r) => parseInt(r.id, 10))
  );

  const availableSeats = allSeats.filter((s) => availableSeatIds.has(s.id));

  return { allSeats, availableSeats, layout };
}

/**
 * Core Intelligent Adjacent-Block Allocation Algorithm (M2-04)
 * Deterministic allocation policy:
 * 1. Prefer consecutive block of adjacent seats in the same physical row.
 * 2. Never cross an aisle or physical gap.
 * 3. Tie-breaking: lowest row number, then lowest starting position.
 * 4. Fallback: deterministic row/position ordering if total free seats >= party size.
 * 5. Insufficient capacity: throw INSUFFICIENT_CAPACITY if total available < party size.
 */
export function findOptimalSeatAllocation(
  allSeats: SeatModel[],
  availableSeats: SeatModel[],
  layout: VehicleLayoutConfig,
  partySize: number,
  explicitSeatIds?: number[],
  requireAccessible: boolean = false
): AllocationResult {
  if (partySize < 1 || partySize > 6) {
    throw new SeatAllocationError(
      'VALIDATION_ERROR',
      `Party size must be between 1 and 6. Received ${partySize}`,
      400,
      { partySize }
    );
  }

  const availableMap = new Map<number, SeatModel>(availableSeats.map((s) => [s.id, s]));
  const allMap = new Map<number, SeatModel>(allSeats.map((s) => [s.id, s]));

  // Case A: Explicit Seat Selection
  if (explicitSeatIds && explicitSeatIds.length > 0) {
    if (new Set(explicitSeatIds).size !== explicitSeatIds.length) {
      throw new SeatAllocationError(
        'DUPLICATE_SEAT_IDS',
        'Duplicate seat selections are not allowed',
        400,
        { explicitSeatIds }
      );
    }

    if (explicitSeatIds.length !== partySize) {
      throw new SeatAllocationError(
        'SEAT_COUNT_MISMATCH',
        `Selected seats count (${explicitSeatIds.length}) does not match party size (${partySize})`,
        400,
        { selected: explicitSeatIds.length, partySize }
      );
    }

    for (const seatId of explicitSeatIds) {
      if (!allMap.has(seatId)) {
        throw new SeatAllocationError(
          'INVALID_SEAT_VEHICLE',
          `Seat ID ${seatId} does not belong to this vehicle`,
          400,
          { seatId }
        );
      }

      if (!availableMap.has(seatId)) {
        throw new SeatAllocationError(
          'SEAT_UNAVAILABLE',
          `Seat ${allMap.get(seatId)?.seat_label || seatId} is no longer available`,
          409,
          { seatId }
        );
      }
    }

    const chosenSeats = explicitSeatIds.map((id) => allMap.get(id)!);
    return {
      seatIds: explicitSeatIds,
      seats: chosenSeats,
      allocationType: 'explicit',
    };
  }

  // Case B: Automatic Allocation
  if (availableSeats.length < partySize) {
    throw new SeatAllocationError(
      'INSUFFICIENT_CAPACITY',
      `Not enough seats available on this shuttle trip. Requested: ${partySize}, Available: ${availableSeats.length}`,
      409,
      { requested: partySize, available: availableSeats.length }
    );
  }

  // Group all vehicle seats by row
  const rowsMap = new Map<number, SeatModel[]>();
  for (const seat of allSeats) {
    if (!rowsMap.has(seat.row_no)) {
      rowsMap.set(seat.row_no, []);
    }
    rowsMap.get(seat.row_no)!.push(seat);
  }

  const sortedRows = Array.from(rowsMap.keys()).sort((a, b) => a - b);

  // 1. Search for adjacent consecutive block within the same row and same side of aisle
  for (const rowNo of sortedRows) {
    const rowSeats = rowsMap.get(rowNo)!.sort((a, b) => a.col_no - b.col_no);

    // Break row into contiguous sections separated by aisles or column gaps
    const sections: SeatModel[][] = [];
    let currentSection: SeatModel[] = [];

    for (let i = 0; i < rowSeats.length; i++) {
      const seat = rowSeats[i];
      if (currentSection.length === 0) {
        currentSection.push(seat);
      } else {
        const prevSeat = currentSection[currentSection.length - 1];
        const gap = seat.col_no - prevSeat.col_no;
        const aisleBetween = isAisleBetween(prevSeat.col_no, seat.col_no, layout);

        if (gap === 1 && !aisleBetween) {
          currentSection.push(seat);
        } else {
          sections.push(currentSection);
          currentSection = [seat];
        }
      }
    }
    if (currentSection.length > 0) {
      sections.push(currentSection);
    }

    // In each aisle section, slide a window of length partySize
    for (const section of sections) {
      if (section.length < partySize) continue;

      for (let startIdx = 0; startIdx <= section.length - partySize; startIdx++) {
        const candidateBlock = section.slice(startIdx, startIdx + partySize);

        // Check if all seats in this block are currently available
        const allFree = candidateBlock.every((s) => availableMap.has(s.id));
        if (allFree) {
          // If accessible seat preference specified, prioritize appropriately
          if (requireAccessible && !candidateBlock.some((s) => s.is_accessible)) {
            continue; // look for block with accessible seat if required
          }

          return {
            seatIds: candidateBlock.map((s) => s.id),
            seats: candidateBlock,
            allocationType: 'adjacent',
          };
        }
      }
    }
  }

  // 2. Fallback: If no adjacent block is found, allocate individual seats deterministically
  // Sort available seats: prefer non-accessible for ordinary riders if available, row ASC, col ASC
  const fallbackCandidates = [...availableSeats].sort((a, b) => {
    if (a.row_no !== b.row_no) return a.row_no - b.row_no;
    return a.col_no - b.col_no;
  });

  const selectedFallback = fallbackCandidates.slice(0, partySize);

  return {
    seatIds: selectedFallback.map((s) => s.id),
    seats: selectedFallback,
    allocationType: 'fallback',
  };
}

/**
 * Shared allocation service function called by bookings, holds, and waitlist promotion.
 */
export async function allocateSeats(
  client: PoolClient,
  request: AllocationRequest
): Promise<AllocationResult> {
  const { allSeats, availableSeats, layout } = await getTripSeatsWithAvailability(
    client,
    request.tripId,
    request.vehicleId
  );

  return findOptimalSeatAllocation(
    allSeats,
    availableSeats,
    layout,
    request.partySize,
    request.explicitSeatIds,
    request.requireAccessible
  );
}

