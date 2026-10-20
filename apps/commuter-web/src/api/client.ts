import { User, AuthTokens, ShuttleTrip, Booking, WalletBalance, Transaction, LiveVehicleTelemetry } from '../types';

const API_BASE = '';

function getAccessToken(): string | null {
  return localStorage.getItem('access_token');
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

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      // Clear token if expired
      clearSession();
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.message || `Request failed with status ${res.status}`);
    }

    return data as T;
  } catch (err: any) {
    console.warn(`[API] ${options.method || 'GET'} ${path} error:`, err.message);
    throw err;
  }
}

// 1. Auth Service API
export const authApi = {
  async login(email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> {
    const res = await request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const user: User = {
      id: res.user?.id || 1,
      email: res.user?.email || email,
      fullName: res.user?.fullName || res.user?.full_name || 'Sarah Taylor',
      phone: res.user?.phone,
      companyId: res.user?.companyId || res.user?.company_id || 1,
      companyName: res.user?.companyName || 'Apex Energy Labs',
      role: res.user?.role || 'commuter',
      verified: true,
    };

    const tokens: AuthTokens = {
      accessToken: res.tokens?.accessToken || res.tokens?.access_token || 'mock_jwt_token_for_phase1',
      refreshToken: res.tokens?.refreshToken || res.tokens?.refresh_token || 'mock_refresh_token',
    };

    setTokens(tokens, user);
    return { user, tokens };
  },

  async register(data: {
    fullName: string;
    email: string;
    password: string;
    companyId?: number;
    phone?: string;
  }): Promise<{ user: User; tokens: AuthTokens }> {
    const res = await request<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        companyId: data.companyId || 1,
        phone: data.phone || '+94 77 123 4567',
        role: 'commuter',
      }),
    });

    const user: User = {
      id: res.user?.id || 10,
      email: data.email,
      fullName: data.fullName,
      companyId: data.companyId || 1,
      role: 'commuter',
      verified: false,
    };

    const tokens: AuthTokens = {
      accessToken: res.tokens?.accessToken || res.tokens?.access_token || 'mock_reg_token',
      refreshToken: res.tokens?.refreshToken || res.tokens?.refresh_token || 'mock_reg_refresh',
    };

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
    return request<any>('/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async confirmOtp(email: string, otp: string): Promise<{ success: boolean; message: string }> {
    return request<any>('/otp/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  },

  async triggerSos(params: {
    tripId?: number;
    lat?: number;
    lng?: number;
    note?: string;
  }): Promise<{ status: string; message: string; event: any }> {
    return request<any>('/sos', {
      method: 'POST',
      body: JSON.stringify(params),
    });
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
  async getTrips(params?: { origin?: string; destination?: string }): Promise<ShuttleTrip[]> {
    try {
      const query = new URLSearchParams(params as any).toString();
      const res = await request<any>(`/trips${query ? '?' + query : ''}`);
      if (Array.isArray(res.trips) && res.trips.length > 0) {
        return res.trips;
      }
    } catch (e) {
      console.warn('Booking API fetch failed, using active phase 1 corporate trips');
    }

    // Default seeded corporate shuttle trips matching DB seed (Module 2)
    return [
      {
        id: 1,
        routeId: 1,
        routeName: 'Line 14-B Express (Colombo CBD Shuttle)',
        originName: 'Galle Face Center Rd, Colombo 03',
        destinationName: 'WTC & Port City Tech Corridor, Colombo 01',
        departAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        arriveAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        status: 'scheduled',
        availableSeats: 14,
        driverName: 'Kamal Perera',
        vehicle: {
          id: 1,
          plateNo: 'WP-ND-8820 (EV Shuttle)',
          type: 'Electric Minibus',
          capacity: 14,
        },
      },
      {
        id: 2,
        routeId: 2,
        routeName: 'Line 08 Tech Connect (Suburban Orbit)',
        originName: 'Barnes Place, Colombo 07',
        destinationName: 'Innovation Hub, Orion City, Colombo 09',
        departAt: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
        arriveAt: new Date(Date.now() + 85 * 60 * 1000).toISOString(),
        status: 'scheduled',
        availableSeats: 11,
        driverName: 'Sunil Silva',
        vehicle: {
          id: 2,
          plateNo: 'WP-NB-5541',
          type: 'Hybrid Coach',
          capacity: 14,
        },
      },
    ];
  },

  async getTripDetails(tripId: number): Promise<ShuttleTrip> {
    try {
      const res = await request<any>(`/trips/${tripId}`);
      if (res.trip) return res.trip;
    } catch (e) {
      console.warn(`Trip detail for ${tripId} offline, generating 14-seat layout`);
    }

    // 14-seat standard layout matching seat_selection_1 design
    const defaultSeats = [
      { id: 1, label: '1A', row: 1, col: 1, isWindow: true, isAisle: false, isAccessible: true, isAvailable: true },
      { id: 2, label: '1B', row: 1, col: 2, isWindow: false, isAisle: true, isAccessible: true, isAvailable: true },
      { id: 3, label: '1C', row: 1, col: 3, isWindow: false, isAisle: true, isAccessible: false, isAvailable: false },
      { id: 4, label: '1D', row: 1, col: 4, isWindow: true, isAisle: false, isAccessible: false, isAvailable: true },

      { id: 5, label: '2A', row: 2, col: 1, isWindow: true, isAisle: false, isAccessible: false, isAvailable: true },
      { id: 6, label: '2B', row: 2, col: 2, isWindow: false, isAisle: true, isAccessible: false, isAvailable: true },
      { id: 7, label: '2C', row: 2, col: 3, isWindow: true, isAisle: false, isAccessible: false, isAvailable: true },

      { id: 8, label: '3A', row: 3, col: 1, isWindow: true, isAisle: false, isAccessible: false, isAvailable: true },
      { id: 9, label: '3B', row: 3, col: 2, isWindow: false, isAisle: true, isAccessible: false, isAvailable: false },
      { id: 10, label: '3C', row: 3, col: 3, isWindow: false, isAisle: true, isAccessible: false, isAvailable: true },
      { id: 11, label: '3D', row: 3, col: 4, isWindow: true, isAisle: false, isAccessible: false, isAvailable: true },

      { id: 12, label: '4A', row: 4, col: 1, isWindow: true, isAisle: false, isAccessible: false, isAvailable: true },
      { id: 13, label: '4B', row: 4, col: 2, isWindow: false, isAisle: true, isAccessible: false, isAvailable: true },
      { id: 14, label: '4C', row: 4, col: 3, isWindow: true, isAisle: false, isAccessible: false, isAvailable: true },
    ];

    return {
      id: tripId,
      routeId: 1,
      routeName: 'Line 14-B Express',
      originName: 'Galle Face Center Rd, Colombo 03',
      destinationName: 'WTC Colombo 01',
      departAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      arriveAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      status: 'scheduled',
      availableSeats: 11,
      driverName: 'Kamal Perera',
      vehicle: {
        id: 1,
        plateNo: 'WP-ND-8820',
        type: 'Electric Shuttle #882',
        capacity: 14,
      },
      seats: defaultSeats,
    };
  },

  async createBooking(tripId: number, seatId: number): Promise<Booking> {
    const res = await request<any>(`/trips/${tripId}/bookings`, {
      method: 'POST',
      body: JSON.stringify({
        partySize: 1,
        seatIds: [seatId],
      }),
    });

    return {
      id: res.booking?.id || Math.floor(Math.random() * 9000) + 1000,
      tripId,
      userId: 1,
      seatId,
      status: 'confirmed',
      createdAt: new Date().toISOString(),
      departAt: res.booking?.departAt || new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      originName: 'Galle Face Center Rd',
      destinationName: 'WTC Colombo',
    };
  },

  async getMyBookings(): Promise<Booking[]> {
    try {
      const res = await request<any>('/bookings/me');
      return res.bookings || [];
    } catch {
      return [
        {
          id: 1042,
          tripId: 1,
          userId: 1,
          seatLabel: '1A',
          status: 'confirmed',
          createdAt: new Date().toISOString(),
          departAt: 'Today, 5:30 PM',
          originName: 'Corporate Park - East Wing',
          destinationName: 'Green Valley Residence',
        },
      ];
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
