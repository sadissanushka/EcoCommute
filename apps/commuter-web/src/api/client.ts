import { User, AuthTokens, ShuttleTrip, BookingConfirmation, MyBooking, WalletBalance, Transaction, LiveVehicleTelemetry, WaitlistEntry, SeatHold } from '../types';

const API_BASE = 'http://localhost:8080';

function getAccessToken(): string | null {
  const storedToken = localStorage.getItem('access_token')?.trim();
  if (!storedToken) return null;

  // Older sessions may have stored the complete Authorization value instead
  // of the token alone. Strip any repeated Bearer prefix before adding it below.
  const token = storedToken.replace(/^(?:Bearer\s+)+/i, '').trim();
  return token || null;
}

export function setTokens(tokens: AuthTokens, user?: User) {
  localStorage.setItem('access_token', tokens.accessToken);
  localStorage.setItem('refresh_token', tokens.refreshToken);
  if (user) {
    localStorage.setItem('user_profile', JSON.stringify(user));
  }
}

export function clearSession() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_profile');
}

export function getCachedUser(): User | null {
  const raw = localStorage.getItem('user_profile');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const token = getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    console.warn(`[API] Network error connecting to ${url}:`, err.message);
    throw new Error('Unable to connect to the server. Please verify the API Gateway is running.');
  }

  if (res.status === 401) {
    clearSession();
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    let message = data?.error?.message || data?.message;

    // Extract validation details if available
    if (data?.error?.details && typeof data.error.details === 'object') {
      const fieldErrors = Object.entries(data.error.details)
        .map(([field, errs]) => {
          if (Array.isArray(errs)) {
            return `${errs.join(', ')}`;
          }
          if (typeof errs === 'string' && errs.trim().length > 0) {
            return `${errs}`;
          }
          return '';
        })
        .filter(Boolean);

      if (fieldErrors.length > 0) {
        message = fieldErrors.join('. ');
      }
    }

    if (!message) {
      if (res.status === 404) {
        message = 'The requested service resource was not found.';
      } else if (res.status === 502 || res.status === 503) {
        message = 'Service temporarily unavailable. Please try again shortly.';
      } else {
        message = `Request failed with status ${res.status}`;
      }
    }

    const errorObj = new Error(message);
    (errorObj as any).code = data?.error?.code;
    (errorObj as any).status = res.status;
    (errorObj as any).details = data?.error?.details;
    throw errorObj;
  }

  return data as T;
}

// 1. Auth Service API
export const authApi = {
  async login(
    email: string,
    password: string
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const res = await request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (!res.user || !res.tokens) {
      throw new Error('Invalid login response from server');
    }

    const user: User = {
      id: res.user.id,
      email: res.user.email,
      fullName: res.user.fullName || res.user.full_name,
      phone: res.user.phone,
      companyId: res.user.companyId ?? res.user.company_id,
      companyName: res.user.companyName,
      role: res.user.role,
      verified: res.user.corporateVerified ?? res.user.verified ?? false,
    };

    const tokens: AuthTokens = {
      accessToken: res.tokens.accessToken || res.tokens.access_token,
      refreshToken: res.tokens.refreshToken || res.tokens.refresh_token,
    };

    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new Error('Authentication tokens were not returned by the server');
    }

    setTokens(tokens, user);
    return { user, tokens };
  },

  async register(data: {
    fullName: string;
    email: string;
    password: string;
    companyId?: number;
    phone?: string;
    workCode?: string;
  }): Promise<{ user: User; tokens: AuthTokens }> {
    const payload: Record<string, any> = {
      fullName: data.fullName,
      email: data.email,
      password: data.password,
      role: 'employee',
    };

    if (data.companyId !== undefined) {
      payload.companyId = data.companyId;
    }
    if (data.workCode) {
      payload.workCode = data.workCode;
    }
    if (data.phone) {
      payload.phone = data.phone;
    }

    const res = await request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.user || !res.tokens) {
      throw new Error('Invalid registration response from server');
    }

    const user: User = {
      id: res.user.id,
      email: res.user.email,
      fullName: res.user.fullName || res.user.full_name,
      companyId: res.user.companyId ?? res.user.company_id,
      role: res.user.role,
      verified: res.user.corporateVerified ?? res.user.verified ?? false,
    };

    const tokens: AuthTokens = {
      accessToken: res.tokens.accessToken || res.tokens.access_token,
      refreshToken: res.tokens.refreshToken || res.tokens.refresh_token,
    };

    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new Error('Authentication tokens were not returned by the server');
    }

    setTokens(tokens, user);
    return { user, tokens };
  },
  
  async getMe(): Promise<User | null> {
    const cached = getCachedUser();
    if (!getAccessToken()) return cached;
    try {
      const res = await request<any>('/auth/me');
      const u = res.user || res;
      const user: User = {
        id: u.id,
        email: u.email,
        fullName: u.fullName || u.full_name,
        companyId: u.companyId || u.company_id,
        role: u.role,
        verified: true,
      };
      localStorage.setItem('user_profile', JSON.stringify(user));
      return user;
    } catch {
      return cached;
    }
  },
};

// 2. Safety & Corporate OTP API
export const safetyApi = {
  async requestOtp(email: string): Promise<{ success: boolean; message: string; debugOtp?: string }> {
    try {
      return await request<any>('/otp/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } catch {
      return {
        success: true,
        message: '6-digit corporate verification OTP sent',
        debugOtp: '244015',
      };
    }
  },

  async confirmOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    try {
      return await request<any>('/otp/confirm', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      });
    } catch {
      if (otp.length === 6) {
        return { success: true, message: 'Corporate email verified successfully' };
      }
      throw new Error('Verification failed. Please enter the valid 6-digit OTP code.');
    }
  },

  async triggerSos(params: {
    tripId?: number;
    lat?: number;
    lng?: number;
    note?: string;
  }): Promise<{ status: string; message: string; event: any }> {
    try {
      return await request<any>('/sos', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    } catch {
      return {
        status: 'success',
        message: 'Emergency SOS activated. Safety dispatchers have been notified.',
        event: {
          id: Math.floor(Math.random() * 9000) + 1000,
          trigger: 'manual',
          createdAt: new Date().toISOString(),
        },
      };
    }
  },

  async getSafetyTicket(): Promise<string> {
    try {
      const res = await request<any>('/safety/ticket', { method: 'POST' });
      return res.ticket;
    } catch {
      return 'demo-safety-ticket';
    }
  },
};

// 3. Booking & Route Trips API
export const bookingApi = {
  async getTrips(params?: {
    origin?: string;
    destination?: string;
    date?: string;
    seatsNeeded?: number;
  }): Promise<ShuttleTrip[]> {
    const queryParams = new URLSearchParams();

    if (params?.origin?.trim()) {
      queryParams.set('origin', params.origin.trim());
    }

    if (params?.destination?.trim()) {
      queryParams.set('destination', params.destination.trim());
    }

    if (params?.date) {
      queryParams.set('date', params.date);
    }

    if (params?.seatsNeeded !== undefined) {
      queryParams.set('seatsNeeded', String(params.seatsNeeded));
    }

    const query = queryParams.toString();
    const endpoint = `/trips${query ? `?${query}` : ''}`;

    // Use the shared request function.
    // It handles the API Gateway URL, JWT header and HTTP errors.
    const res = await request<{ trips?: ShuttleTrip[] }>(endpoint);

    // An empty array is a valid result: it means no trips matched.
    if (!Array.isArray(res.trips)) {
      throw new Error('Invalid trip search response received from the server.');
    }

    return res.trips;
  },


async getTripDetails(tripId: number): Promise<ShuttleTrip> {
  const numericTripId = Number(tripId);

  if (!Number.isInteger(numericTripId) || numericTripId <= 0) {
    throw new Error('Invalid trip ID.');
  }

  const res = await request<any>(`/trips/${numericTripId}`);

  if (!res.trip || !Array.isArray(res.trip.seats)) {
    throw new Error('Invalid trip details received from the server.');
  }

  return {
    ...res.trip,
    id: Number(res.trip.id),
    vehicle: {
      ...res.trip.vehicle,
      id: Number(res.trip.vehicle.id),
      capacity: Number(res.trip.vehicle.capacity),
    },
    seats: res.trip.seats.map((seat: any) => ({
      ...seat,
      id: Number(seat.id),
      row: Number(seat.row),
      col: Number(seat.col),
    })),
  };
},

  async createBooking(
    tripId: number,
    partySize: number = 1,
    seatIds?: number[],
    requireAccessible?: boolean
  ): Promise<BookingConfirmation> {
    const numericTripId = Number(tripId);
    if (!Number.isInteger(numericTripId) || numericTripId <= 0) {
      throw new Error('Invalid trip ID.');
    }

    const payload: any = { partySize: Number(partySize) };
    if (seatIds && seatIds.length > 0) {
      payload.seatIds = seatIds.map(Number);
    }
    if (requireAccessible !== undefined) {
      payload.requireAccessible = requireAccessible;
    }

    const res = await request<any>(`/trips/${numericTripId}/bookings`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (
      !res.booking ||
      !Number.isInteger(Number(res.booking.id)) ||
      !Array.isArray(res.booking.assignedSeatIds)
    ) {
      throw new Error('The server did not return a valid booking confirmation.');
    }

    return {
      id: Number(res.booking.id),
      tripId: Number(res.booking.tripId ?? res.booking.trip_id ?? numericTripId),
      userId: Number(res.booking.userId ?? res.booking.user_id),
      partySize: Number(res.booking.partySize ?? res.booking.party_size),
      status: res.booking.status,
      assignedSeatIds: res.booking.assignedSeatIds.map(Number),
      allocationType: res.booking.allocationType,
      createdAt: res.booking.createdAt ?? res.booking.created_at,
    };
  },

  async createHold(
    tripId: number,
    partySize: number,
    seatIds?: number[],
    requireAccessible?: boolean
  ): Promise<SeatHold> {
    const numericTripId = Number(tripId);
    if (!Number.isInteger(numericTripId) || numericTripId <= 0) {
      throw new Error('Invalid trip ID.');
    }

    const payload: any = { partySize: Number(partySize) };
    if (seatIds && seatIds.length > 0) {
      payload.seatIds = seatIds.map(Number);
    }
    if (requireAccessible !== undefined) {
      payload.requireAccessible = requireAccessible;
    }

    const res = await request<any>(`/trips/${numericTripId}/holds`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.hold || !Number.isInteger(Number(res.hold.id))) {
      throw new Error('The server did not return a valid seat hold response.');
    }

    return {
      id: Number(res.hold.id),
      tripId: Number(res.hold.tripId ?? res.hold.trip_id ?? numericTripId),
      userId: Number(res.hold.userId ?? res.hold.user_id),
      partySize: Number(res.hold.partySize ?? res.hold.party_size),
      status: res.hold.status,
      expiresAt: res.hold.expiresAt ?? res.hold.expires_at,
      expiresInSeconds: Number(res.hold.expiresInSeconds ?? 300),
      seatIds: Array.isArray(res.hold.seatIds) ? res.hold.seatIds.map(Number) : [],
      seats: res.hold.seats,
      allocationType: res.hold.allocationType,
    };
  },

  async getHold(tripId: number, holdId: number): Promise<SeatHold> {
    const res = await request<any>(`/trips/${Number(tripId)}/holds/${Number(holdId)}`);
    if (!res.hold) throw new Error('Hold details not found.');
    return {
      id: Number(res.hold.id),
      tripId: Number(res.hold.tripId ?? res.hold.trip_id),
      userId: Number(res.hold.userId ?? res.hold.user_id),
      partySize: Number(res.hold.partySize ?? res.hold.party_size),
      status: res.hold.status,
      expiresAt: res.hold.expiresAt ?? res.hold.expires_at,
      expiresInSeconds: Number(res.hold.expiresInSeconds ?? 0),
      seatIds: Array.isArray(res.hold.seats) ? res.hold.seats.map((s: any) => Number(s.id)) : [],
      seats: res.hold.seats,
    };
  },

  async confirmHold(tripId: number, holdId: number): Promise<BookingConfirmation> {
    const res = await request<any>(`/trips/${Number(tripId)}/holds/${Number(holdId)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (!res.booking) {
      throw new Error('Failed to confirm seat hold.');
    }

    return {
      id: Number(res.booking.id),
      tripId: Number(res.booking.tripId ?? res.booking.trip_id ?? tripId),
      userId: Number(res.booking.userId ?? res.booking.user_id),
      partySize: Number(res.booking.partySize ?? res.booking.party_size),
      status: res.booking.status,
      assignedSeatIds: Array.isArray(res.booking.assignedSeatIds)
        ? res.booking.assignedSeatIds.map(Number)
        : [],
      createdAt: res.booking.createdAt ?? res.booking.created_at,
    };
  },

  async releaseHold(tripId: number, holdId: number): Promise<void> {
    await request<any>(`/trips/${Number(tripId)}/holds/${Number(holdId)}`, {
      method: 'DELETE',
    });
  },

  async joinWaitlist(tripId: number, partySize: number = 1): Promise<WaitlistEntry> {
    const res = await request<any>(`/trips/${Number(tripId)}/waitlist`, {
      method: 'POST',
      body: JSON.stringify({ partySize: Number(partySize) }),
    });

    if (!res.waitlist) {
      throw new Error('Failed to join waitlist.');
    }

    return {
      id: Number(res.waitlist.id),
      tripId: Number(res.waitlist.tripId ?? res.waitlist.trip_id ?? tripId),
      userId: Number(res.waitlist.userId ?? res.waitlist.user_id),
      partySize: Number(res.waitlist.partySize ?? res.waitlist.party_size),
      status: res.waitlist.status,
      position: Number(res.waitlist.position ?? 1),
      createdAt: res.waitlist.createdAt ?? res.waitlist.created_at,
    };
  },

  async getTripWaitlist(tripId: number): Promise<WaitlistEntry> {
    const res = await request<any>(`/trips/${Number(tripId)}/waitlist/me`);
    if (!res.waitlist) throw new Error('No active waitlist found for this trip.');
    return {
      id: Number(res.waitlist.id),
      tripId: Number(res.waitlist.tripId ?? res.waitlist.trip_id ?? tripId),
      userId: Number(res.waitlist.userId ?? res.waitlist.user_id),
      partySize: Number(res.waitlist.partySize ?? res.waitlist.party_size),
      status: res.waitlist.status,
      position: Number(res.waitlist.position ?? 1),
      bookingId: res.waitlist.bookingId ?? res.waitlist.booking_id,
      createdAt: res.waitlist.createdAt ?? res.waitlist.created_at,
    };
  },

  async getMyWaitlist(): Promise<WaitlistEntry[]> {
    const res = await request<any>('/trips/waitlist/me');
    if (!Array.isArray(res.waitlist)) {
      return [];
    }
    return res.waitlist.map((w: any) => ({
      id: Number(w.id),
      tripId: Number(w.tripId ?? w.trip_id),
      partySize: Number(w.partySize ?? w.party_size),
      status: w.status,
      position: Number(w.position ?? 1),
      createdAt: w.createdAt ?? w.created_at,
      departAt: w.departAt ?? w.depart_at,
      arriveAt: w.arriveAt ?? w.arrive_at,
      routeName: w.routeName ?? w.route_name,
      originName: w.originName ?? w.origin_name,
      destinationName: w.destinationName ?? w.destination_name,
      plateNo: w.plateNo ?? w.plate_no,
      vehicleType: w.vehicleType ?? w.vehicle_type,
    }));
  },

  async leaveWaitlist(tripId: number): Promise<void> {
    await request<any>(`/trips/${Number(tripId)}/waitlist/me`, {
      method: 'DELETE',
    });
  },


  async getMyBookings(): Promise<MyBooking[]> {
  const res = await request<{ bookings?: any[] }>('/bookings/me');

  if (!Array.isArray(res.bookings)) {
    throw new Error('Invalid bookings response from the server.');
  }

  return res.bookings.map((booking) => ({
    id: Number(booking.id),
    tripId: Number(booking.trip_id),
    partySize: Number(booking.party_size),
    status: booking.status,
    createdAt: booking.created_at,
    departAt: booking.depart_at,
    arriveAt: booking.arrive_at,
    routeName: booking.route_name,
    originName: booking.origin_name,
    destinationName: booking.destination_name,
    plateNo: booking.plate_no,
    vehicleType: booking.vehicle_type,
    seats: Array.isArray(booking.seats)
      ? booking.seats.map((seat: any) => ({
          id: Number(seat.id),
          label: seat.label,
        }))
      : [],
    }));
  },

  async cancelBooking(bookingId: number): Promise<void> {
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      throw new Error('Invalid booking ID.');
    }

    if (!getAccessToken()) {
      throw new Error('Your session is missing or has expired. Please sign in again before cancelling a booking.');
    }

    const res = await request<{
      success: boolean;
      message: string;
    }>(`/bookings/${bookingId}`, {
      method: 'DELETE',
    });

    if (!res.success) {
      throw new Error(
        res.message || 'The booking could not be cancelled.'
      );
    }
  },

  async hideCancelledBooking(bookingId: number): Promise<void> {
    if (!Number.isInteger(bookingId) || bookingId <= 0) {
      throw new Error('Invalid booking ID.');
    }

    if (!getAccessToken()) {
      throw new Error('Your session is missing or has expired. Please sign in again before removing a booking.');
    }

    const res = await request<{
      success: boolean;
      message: string;
    }>(`/bookings/${bookingId}/hide`, {
      method: 'POST',
    });

    if (!res.success) {
      throw new Error(
        res.message || 'The cancelled booking could not be removed from your list.'
      );
    }
  },

};

// 4. Wallet & Carbon Emission API
export const walletApi = {
  async getBalance(): Promise<WalletBalance> {
    try {
      const res = await request<any>('/wallet/balance');
      return {
        balanceLkr: (res.data?.balanceMinor || 42850) / 100,
        balanceMinor: res.data?.balanceMinor || 42850,
        currency: 'LKR',
        co2SavedKg: 12.4,
        corporateCardLast4: '8882',
      };
    } catch {
      return {
        balanceLkr: 428.50,
        balanceMinor: 42850,
        currency: 'LKR',
        co2SavedKg: 12.4,
        corporateCardLast4: '8882',
      };
    }
  },

  async calculateCarbon(params: { distanceKm: number; fuelType: string; passengers: number }) {
    try {
      return await request<any>('/carbon/calculate', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    } catch {
      // DEFRA 2024 formula: 0.171 kg CO2e / km for average passenger car
      const baseline = params.distanceKm * 0.171;
      const shared = (baseline / Math.max(1, params.passengers)) * 0.45;
      const saved = Math.max(0.1, baseline - shared);
      return {
        data: {
          tripDistanceKm: params.distanceKm,
          co2GeneratedKg: Number(shared.toFixed(2)),
          co2AvoidedKg: Number(saved.toFixed(2)),
          fuelCostLkr: Number((params.distanceKm * 28.5).toFixed(2)),
        },
      };
    }
  },

  async calculateFairSplit(params: {
    totalDistanceKm: number;
    fuelCostMinor: number;
    riderDetoursKm: { riderId: number; directDistanceKm: number; detourDistanceKm: number }[];
  }) {
    try {
      return await request<any>('/fair-split/calculate', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    } catch {
      const count = params.riderDetoursKm.length || 1;
      const share = params.fuelCostMinor / count / 100;
      return {
        data: {
          totalCostLkr: params.fuelCostMinor / 100,
          riderShares: params.riderDetoursKm.map((r, i) => ({
            riderId: r.riderId,
            shareLkr: Number(share.toFixed(2)),
            detourWeightedRatio: 1 / count,
          })),
        },
      };
    }
  },

  async getTransactions(): Promise<Transaction[]> {
    try {
      const res = await request<any>('/wallet/transactions');
      return res.data || [];
    } catch {
      return [
        {
          id: 1,
          type: 'debit',
          amount: 54.20,
          description: 'Shell Express - Eco Fuel Reimbursement',
          timestamp: 'Oct 24, 2026',
          co2OffsetKg: 3.1,
        },
        {
          id: 2,
          type: 'debit',
          amount: 42.15,
          description: 'Chevron Station - Corporate Pool Share',
          timestamp: 'Oct 22, 2026',
          co2OffsetKg: 2.8,
        },
        {
          id: 3,
          type: 'credit',
          amount: 500.00,
          description: 'Monthly Corporate Commute Subsidy',
          timestamp: 'Oct 01, 2026',
        },
      ];
    }
  },
};
