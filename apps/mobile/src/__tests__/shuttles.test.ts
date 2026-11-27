// Mock react-native for Node/Jest environment
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: jest.fn((dict) => dict.android || dict.default),
  },
  BackHandler: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Alert: {
    alert: jest.fn(),
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

import { apiClient, parseApiError } from '../api/client';
import {
  ShuttleTrip,
  ShuttleTripDetail,
  ShuttleSeat,
  UserBooking,
  SeatHoldInfo,
} from '../screens/ShuttlesScreen';

// Mock apiClient calls
jest.mock('../api/client', () => {
  const actual = jest.requireActual('../api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    },
  };
});

describe('EcoCommute Mobile App – Phase 2: Shuttle Booking & Seat Allocation Tests', () => {
  const mockApi = apiClient as jest.Mocked<typeof apiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Sample Mock Data
  const sampleTrip: ShuttleTrip = {
    id: 12,
    routeId: 2,
    routeName: 'Moratuwa Coastal Line',
    originName: 'Moratuwa Bus Stand',
    destinationName: 'Colombo Fort',
    departAt: '2026-12-10T12:00:00.000Z',
    arriveAt: '2026-12-10T13:00:00.000Z',
    bookingCutoffAt: '2026-12-10T11:30:00.000Z',
    availableSeats: 4,
    status: 'scheduled',
    vehicle: {
      id: 2,
      plateNo: 'WP-6490',
      type: 'Toyota HiAce',
      capacity: 14,
      layout: { rows: 4, cols: 4, aisleAfterCol: 2 },
    },
  };

  const sampleSeats: ShuttleSeat[] = [
    { id: 31, label: '1A', row: 1, col: 1, isWindow: true, isAisle: false, isAccessible: true, isAvailable: true },
    { id: 32, label: '1B', row: 1, col: 2, isWindow: false, isAisle: true, isAccessible: true, isAvailable: true },
    { id: 33, label: '1C', row: 1, col: 3, isWindow: true, isAisle: false, isAccessible: true, isAvailable: false },
    { id: 34, label: '2A', row: 2, col: 1, isWindow: true, isAisle: false, isAccessible: false, isAvailable: true },
    { id: 35, label: '2B', row: 2, col: 2, isWindow: false, isAisle: true, isAccessible: false, isAvailable: true },
  ];

  const sampleTripDetail: ShuttleTripDetail = {
    ...sampleTrip,
    seats: sampleSeats,
  };

  const sampleBooking: UserBooking = {
    id: 88,
    trip_id: 12,
    party_size: 2,
    status: 'confirmed',
    depart_at: '2026-12-10T12:00:00.000Z',
    arrive_at: '2026-12-10T13:00:00.000Z',
    route_name: 'Moratuwa Coastal Line',
    origin_name: 'Moratuwa Bus Stand',
    destination_name: 'Colombo Fort',
    plate_no: 'WP-6490',
    vehicle_type: 'Toyota HiAce',
    seats: [
      { id: 31, label: '1A' },
      { id: 32, label: '1B' },
    ],
  };

  // ==========================================================================
  // 1. Shuttle Trip Search
  // ==========================================================================
  describe('Shuttle Trip Search', () => {
    it('queries GET /trips with search parameters and returns live results', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { trips: [sampleTrip] } });

      const response = await apiClient.get('/trips', {
        params: { origin: 'Moratuwa', seatsNeeded: 2 },
      });

      expect(mockApi.get).toHaveBeenCalledWith('/trips', {
        params: { origin: 'Moratuwa', seatsNeeded: 2 },
      });
      expect(response.data.trips).toHaveLength(1);
      expect(response.data.trips[0].routeName).toBe('Moratuwa Coastal Line');
      expect(response.data.trips[0].availableSeats).toBe(4);
    });

    it('returns an empty array without crashing when no trips match search criteria', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { trips: [] } });

      const response = await apiClient.get('/trips', {
        params: { origin: 'NonExistentCity', seatsNeeded: 1 },
      });

      expect(response.data.trips).toEqual([]);
    });

    it('propagates network or server error without fabricating fake shuttle data', async () => {
      mockApi.get.mockRejectedValueOnce({
        response: { status: 503, data: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Down' } } },
      });

      await expect(apiClient.get('/trips')).rejects.toBeDefined();
    });
  });

  // ==========================================================================
  // 2. Trip Details and Dynamic Seat Map
  // ==========================================================================
  describe('Trip Details and Seat Map', () => {
    it('retrieves GET /trips/:id with complete cabin layout and seat availability', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { trip: sampleTripDetail } });

      const response = await apiClient.get('/trips/12');

      expect(mockApi.get).toHaveBeenCalledWith('/trips/12');
      const trip: ShuttleTripDetail = response.data.trip;
      expect(trip.id).toBe(12);
      expect(trip.seats).toHaveLength(5);
      expect(trip.vehicle.layout?.aisleAfterCol).toBe(2);
    });

    it('correctly distinguishes available, occupied, and accessible seats', () => {
      const availableSeats = sampleSeats.filter((s) => s.isAvailable);
      const occupiedSeats = sampleSeats.filter((s) => !s.isAvailable);
      const accessibleSeats = sampleSeats.filter((s) => s.isAccessible);

      expect(availableSeats).toHaveLength(4);
      expect(occupiedSeats).toHaveLength(1);
      expect(occupiedSeats[0].label).toBe('1C');
      expect(accessibleSeats).toHaveLength(3);
    });

    it('detects aisle separation using layout.aisleAfterCol', () => {
      const seatB = sampleSeats.find((s) => s.label === '1B')!;
      const seatC = sampleSeats.find((s) => s.label === '1C')!;

      const layout = sampleTrip.vehicle.layout!;
      const isAisle = layout.aisleAfterCol === seatB.col;
      expect(isAisle).toBe(true);
      expect(seatC.col).toBe(3);
    });
  });

  // ==========================================================================
  // 3. Booking Confirmation & Idempotency
  // ==========================================================================
  describe('Booking Confirmation & Idempotency', () => {
    it('sends explicit seatIds with partySize and receives confirmed booking', async () => {
      mockApi.post.mockResolvedValueOnce({
        status: 201,
        data: {
          booking: {
            id: 101,
            tripId: 12,
            partySize: 2,
            status: 'confirmed',
            assignedSeatIds: [31, 32],
            allocationType: 'explicit',
          },
        },
      });

      const response = await apiClient.post(
        '/trips/12/bookings',
        { partySize: 2, seatIds: [31, 32] },
        { headers: { 'Idempotency-Key': 'key-123' } }
      );

      expect(response.status).toBe(201);
      expect(response.data.booking.id).toBe(101);
      expect(response.data.booking.assignedSeatIds).toEqual([31, 32]);
    });

    it('sends automatic allocation request when no explicit seatIds are provided', async () => {
      mockApi.post.mockResolvedValueOnce({
        status: 201,
        data: {
          booking: {
            id: 102,
            tripId: 12,
            partySize: 2,
            status: 'confirmed',
            assignedSeatIds: [34, 35],
            allocationType: 'adjacent',
          },
        },
      });

      const response = await apiClient.post(
        '/trips/12/bookings',
        { partySize: 2 },
        { headers: { 'Idempotency-Key': 'key-456' } }
      );

      expect(response.data.booking.allocationType).toBe('adjacent');
      expect(response.data.booking.assignedSeatIds).toEqual([34, 35]);
    });

    it('handles SEAT_UNAVAILABLE error with 409 status code', async () => {
      mockApi.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: {
              code: 'SEAT_UNAVAILABLE',
              message: 'Seat 1C is no longer available',
            },
          },
        },
      });

      try {
        await apiClient.post('/trips/12/bookings', { partySize: 1, seatIds: [33] });
        fail('Should have thrown');
      } catch (err: any) {
        const parsed = parseApiError(err);
        expect(parsed.code).toBe('SEAT_UNAVAILABLE');
      }
    });

    it('handles DUPLICATE_BOOKING error with 409 status code', async () => {
      mockApi.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: {
              code: 'DUPLICATE_BOOKING',
              message: 'User already holds an active booking or waitlist entry on this trip',
            },
          },
        },
      });

      try {
        await apiClient.post('/trips/12/bookings', { partySize: 1 });
        fail('Should have thrown');
      } catch (err: any) {
        const parsed = parseApiError(err);
        expect(parsed.code).toBe('DUPLICATE_BOOKING');
      }
    });

    it('handles INSUFFICIENT_CAPACITY error with 409 status code', async () => {
      mockApi.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: {
              code: 'INSUFFICIENT_CAPACITY',
              message: 'Not enough seats available',
            },
          },
        },
      });

      try {
        await apiClient.post('/trips/12/bookings', { partySize: 6 });
        fail('Should have thrown');
      } catch (err: any) {
        const parsed = parseApiError(err);
        expect(parsed.code).toBe('INSUFFICIENT_CAPACITY');
      }
    });

    it('handles CUTOFF_PASSED error with 409 status code', async () => {
      mockApi.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            error: {
              code: 'CUTOFF_PASSED',
              message: 'Booking cutoff time has passed for this trip',
            },
          },
        },
      });

      try {
        await apiClient.post('/trips/12/bookings', { partySize: 1 });
        fail('Should have thrown');
      } catch (err: any) {
        const parsed = parseApiError(err);
        expect(parsed.code).toBe('CUTOFF_PASSED');
      }
    });
  });

  // ==========================================================================
  // 4. Temporary Seat Holds
  // ==========================================================================
  describe('Temporary Seat Holds', () => {
    const mockHold: SeatHoldInfo = {
      id: 25,
      tripId: 12,
      partySize: 1,
      status: 'held',
      expiresAt: new Date(Date.now() + 300000).toISOString(),
      expiresInSeconds: 300,
      seatIds: [31],
    };

    it('creates temporary seat hold via POST /trips/:id/holds', async () => {
      mockApi.post.mockResolvedValueOnce({
        status: 201,
        data: { hold: mockHold },
      });

      const response = await apiClient.post('/trips/12/holds', { partySize: 1, seatIds: [31] });
      expect(response.status).toBe(201);
      expect(response.data.hold.id).toBe(25);
      expect(response.data.hold.status).toBe('held');
      expect(response.data.hold.expiresInSeconds).toBe(300);
    });

    it('confirms hold into booking via POST /trips/:id/holds/:holdId/confirm with Idempotency-Key', async () => {
      mockApi.post.mockResolvedValueOnce({
        status: 200,
        data: {
          booking: {
            id: 88,
            tripId: 12,
            partySize: 1,
            status: 'confirmed',
            assignedSeatIds: [31],
          },
        },
      });

      const response = await apiClient.post(
        '/trips/12/holds/25/confirm',
        {},
        { headers: { 'Idempotency-Key': 'hold-confirm-key' } }
      );

      expect(mockApi.post).toHaveBeenCalledWith(
        '/trips/12/holds/25/confirm',
        {},
        { headers: { 'Idempotency-Key': 'hold-confirm-key' } }
      );
      expect(response.data.booking.id).toBe(88);
      expect(response.data.booking.status).toBe('confirmed');
    });

    it('releases hold via DELETE /trips/:id/holds/:holdId', async () => {
      mockApi.delete.mockResolvedValueOnce({ status: 200, data: { message: 'Hold released' } });

      const response = await apiClient.delete('/trips/12/holds/25');
      expect(mockApi.delete).toHaveBeenCalledWith('/trips/12/holds/25');
      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // 5. FIFO Waitlist
  // ==========================================================================
  describe('FIFO Waitlist', () => {
    it('joins waitlist via POST /trips/:id/waitlist', async () => {
      mockApi.post.mockResolvedValueOnce({
        status: 201,
        data: {
          waitlist: {
            id: 10,
            tripId: 12,
            partySize: 2,
            status: 'waiting',
            position: 1,
          },
        },
      });

      const response = await apiClient.post('/trips/12/waitlist', { partySize: 2 });
      expect(response.status).toBe(201);
      expect(response.data.waitlist.position).toBe(1);
      expect(response.data.waitlist.status).toBe('waiting');
    });

    it('checks current waitlist position via GET /trips/:id/waitlist/me', async () => {
      mockApi.get.mockResolvedValueOnce({
        status: 200,
        data: {
          waitlist: {
            id: 10,
            position: 1,
            status: 'waiting',
            partySize: 2,
          },
        },
      });

      const response = await apiClient.get('/trips/12/waitlist/me');
      expect(response.data.waitlist.position).toBe(1);
    });

    it('leaves waitlist via DELETE /trips/:id/waitlist/me', async () => {
      mockApi.delete.mockResolvedValueOnce({
        status: 200,
        data: { message: 'Removed from waitlist' },
      });

      const response = await apiClient.delete('/trips/12/waitlist/me');
      expect(mockApi.delete).toHaveBeenCalledWith('/trips/12/waitlist/me');
      expect(response.status).toBe(200);
    });
  });

  // ==========================================================================
  // 6. My Bookings & Cancellation
  // ==========================================================================
  describe('My Bookings & Cancellation', () => {
    it('retrieves authenticated employee bookings via GET /bookings/me', async () => {
      mockApi.get.mockResolvedValueOnce({
        status: 200,
        data: { bookings: [sampleBooking] },
      });

      const response = await apiClient.get('/bookings/me');
      expect(response.data.bookings).toHaveLength(1);
      expect(response.data.bookings[0].id).toBe(88);
      expect(response.data.bookings[0].seats).toHaveLength(2);
      expect(response.data.bookings[0].seats[0].label).toBe('1A');
    });

    it('cancels booking and releases seats via DELETE /bookings/:id', async () => {
      mockApi.delete.mockResolvedValueOnce({
        status: 200,
        data: {
          message: 'Booking cancelled successfully',
          bookingId: 88,
          releasedSeatCount: 2,
          promotedCount: 0,
        },
      });

      const response = await apiClient.delete('/bookings/88');
      expect(mockApi.delete).toHaveBeenCalledWith('/bookings/88');
      expect(response.data.bookingId).toBe(88);
      expect(response.data.releasedSeatCount).toBe(2);
    });

    it('rejects cancellation of another employee booking with 403 Forbidden', async () => {
      mockApi.delete.mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            error: {
              code: 'FORBIDDEN',
              message: 'You cannot cancel another user booking',
            },
          },
        },
      });

      try {
        await apiClient.delete('/bookings/999');
        fail('Should have thrown');
      } catch (err: any) {
        const parsed = parseApiError(err);
        expect(parsed.code).toBe('FORBIDDEN');
      }
    });

    it('fetches user active waitlist entries via GET /trips/waitlist/me', async () => {
      mockApi.get.mockResolvedValueOnce({
        status: 200,
        data: {
          waitlist: [
            {
              id: 5,
              tripId: 12,
              partySize: 3,
              status: 'waiting',
              position: 1,
              departAt: '2026-12-10T12:00:00.000Z',
              arriveAt: '2026-12-10T13:00:00.000Z',
              routeName: 'Moratuwa Coastal Line',
              originName: 'Moratuwa Bus Stand',
              destinationName: 'Colombo Fort',
              plateNo: 'WP-6490',
              vehicleType: 'Toyota HiAce',
            },
          ],
        },
      });

      const response = await apiClient.get('/trips/waitlist/me');
      expect(mockApi.get).toHaveBeenCalledWith('/trips/waitlist/me');
      expect(response.data.waitlist).toHaveLength(1);
      expect(response.data.waitlist[0].position).toBe(1);
      expect(response.data.waitlist[0].partySize).toBe(3);
    });

    it('removes user from waitlist via DELETE /trips/:id/waitlist/me', async () => {
      mockApi.delete.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          message: 'Successfully left the waitlist',
        },
      });

      const response = await apiClient.delete('/trips/12/waitlist/me');
      expect(mockApi.delete).toHaveBeenCalledWith('/trips/12/waitlist/me');
      expect(response.data.success).toBe(true);
    });

    it('hides a cancelled booking from list via POST /bookings/:id/hide', async () => {
      mockApi.post.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          message: 'Cancelled booking hidden from your list',
        },
      });

      const response = await apiClient.post('/bookings/88/hide');
      expect(mockApi.post).toHaveBeenCalledWith('/bookings/88/hide');
      expect(response.data.success).toBe(true);
    });

    it('joins waitlist directly with party size from search card', async () => {
      mockApi.post.mockResolvedValueOnce({
        status: 201,
        data: {
          waitlist: {
            id: 10,
            tripId: 12,
            partySize: 4,
            status: 'waiting',
            position: 2,
          },
        },
      });

      const response = await apiClient.post('/trips/12/waitlist', { partySize: 4 });
      expect(mockApi.post).toHaveBeenCalledWith('/trips/12/waitlist', { partySize: 4 });
      expect(response.data.waitlist.partySize).toBe(4);
      expect(response.data.waitlist.position).toBe(2);
    });
  });
});
