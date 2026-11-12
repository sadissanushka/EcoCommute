import {
  findOptimalSeatAllocation,
  isAisleBetween,
  SeatAllocationError,
  SeatModel,
  VehicleLayoutConfig,
} from '../src/services/seatAllocation';

describe('M2-04: Intelligent Seat Allocation Service Tests', () => {
  // 10-row, 3-column vehicle (2+1 layout with aisle after column 2)
  const layout: VehicleLayoutConfig = {
    rows: 10,
    cols: 3,
    aisleAfterCol: 2,
  };

  const createSeats = (): SeatModel[] => {
    const seats: SeatModel[] = [];
    let id = 1;
    for (let r = 1; r <= 10; r++) {
      for (let c = 1; c <= 3; c++) {
        seats.push({
          id: id++,
          vehicle_id: 1,
          seat_label: `${r}${String.fromCharCode(64 + c)}`,
          row_no: r,
          col_no: c,
          is_window: c === 1 || c === 3,
          is_aisle: c === 2,
          is_accessible: r === 1 && c === 1,
        });
      }
    }
    return seats;
  };

  test('isAisleBetween correctly detects aisle boundary', () => {
    expect(isAisleBetween(1, 2, layout)).toBe(false); // Col 1 and 2 are adjacent
    expect(isAisleBetween(2, 3, layout)).toBe(true);  // Col 2 and 3 cross the aisle
    expect(isAisleBetween(1, 3, layout)).toBe(true);  // Non-adjacent columns
  });

  test('Allocates adjacent block of 2 in row 1 (1A, 1B)', () => {
    const allSeats = createSeats();
    const availableSeats = [...allSeats];

    const result = findOptimalSeatAllocation(allSeats, availableSeats, layout, 2);

    expect(result.allocationType).toBe('adjacent');
    expect(result.seatIds).toEqual([1, 2]); // 1A and 1B
    expect(result.seats.map((s) => s.seat_label)).toEqual(['1A', '1B']);
  });

  test('Does not cross aisle for adjacent block (cannot allocate 1B and 1C together as adjacent)', () => {
    const allSeats = createSeats();
    // 1A is already occupied, only 1B and 1C are free in row 1
    const availableSeats = allSeats.filter((s) => s.seat_label !== '1A');

    const result = findOptimalSeatAllocation(allSeats, availableSeats, layout, 2);

    // Should find Row 2 (2A, 2B) rather than crossing the aisle between 1B and 1C!
    expect(result.allocationType).toBe('adjacent');
    expect(result.seats.map((s) => s.seat_label)).toEqual(['2A', '2B']);
  });

  test('Tie-breaking: prefers lower row number and lower column number', () => {
    const allSeats = createSeats();
    const availableSeats = allSeats.filter((s) => s.row_no >= 3);

    const result = findOptimalSeatAllocation(allSeats, availableSeats, layout, 2);

    expect(result.allocationType).toBe('adjacent');
    expect(result.seats.map((s) => s.seat_label)).toEqual(['3A', '3B']);
  });

  test('Fallback allocation when no adjacent block exists but total capacity is sufficient', () => {
    const allSeats = createSeats();
    // Occupy seats so that no 2 adjacent seats exist (e.g. only 1C and 2C are free)
    const freeSeatLabels = ['1C', '2C', '3C'];
    const availableSeats = allSeats.filter((s) => freeSeatLabels.includes(s.seat_label));

    const result = findOptimalSeatAllocation(allSeats, availableSeats, layout, 2);

    expect(result.allocationType).toBe('fallback');
    expect(result.seats.map((s) => s.seat_label)).toEqual(['1C', '2C']);
  });

  test('Throws INSUFFICIENT_CAPACITY when available seats < partySize', () => {
    const allSeats = createSeats();
    const availableSeats = [allSeats[0]]; // Only 1 seat free

    expect(() => {
      findOptimalSeatAllocation(allSeats, availableSeats, layout, 3);
    }).toThrow(SeatAllocationError);

    try {
      findOptimalSeatAllocation(allSeats, availableSeats, layout, 3);
    } catch (err: any) {
      expect(err.code).toBe('INSUFFICIENT_CAPACITY');
      expect(err.status).toBe(409);
    }
  });

  test('Validates explicit seat selection: matches partySize and all seats free', () => {
    const allSeats = createSeats();
    const availableSeats = [...allSeats];

    const result = findOptimalSeatAllocation(allSeats, availableSeats, layout, 2, [1, 2]);

    expect(result.allocationType).toBe('explicit');
    expect(result.seatIds).toEqual([1, 2]);
  });

  test('Rejects explicit seat selection with duplicates', () => {
    const allSeats = createSeats();
    const availableSeats = [...allSeats];

    expect(() => {
      findOptimalSeatAllocation(allSeats, availableSeats, layout, 2, [1, 1]);
    }).toThrow('Duplicate seat selections are not allowed');
  });

  test('Rejects explicit seat selection if count does not match partySize', () => {
    const allSeats = createSeats();
    const availableSeats = [...allSeats];

    expect(() => {
      findOptimalSeatAllocation(allSeats, availableSeats, layout, 2, [1]);
    }).toThrow('Selected seats count (1) does not match party size (2)');
  });

  test('Rejects explicit seat selection if seat is already occupied', () => {
    const allSeats = createSeats();
    const availableSeats = allSeats.filter((s) => s.id !== 1); // seat 1 occupied

    expect(() => {
      findOptimalSeatAllocation(allSeats, availableSeats, layout, 2, [1, 2]);
    }).toThrow(SeatAllocationError);

    try {
      findOptimalSeatAllocation(allSeats, availableSeats, layout, 2, [1, 2]);
    } catch (err: any) {
      expect(err.code).toBe('SEAT_UNAVAILABLE');
      expect(err.status).toBe(409);
    }
  });

  test('Rejects party size < 1 or > 6', () => {
    const allSeats = createSeats();
    expect(() => findOptimalSeatAllocation(allSeats, allSeats, layout, 0)).toThrow('Party size must be between 1 and 6');
    expect(() => findOptimalSeatAllocation(allSeats, allSeats, layout, 7)).toThrow('Party size must be between 1 and 6');
  });
});

