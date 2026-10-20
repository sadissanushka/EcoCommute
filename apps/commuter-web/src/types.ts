export interface User {
  id: number;
  email: string;
  fullName: string;
  phone?: string;
  companyId: number;
  companyName?: string;
  role: 'commuter' | 'driver' | 'admin';
  verified?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ShuttleStop {
  stopName: string;
  seq: number;
  scheduledTime?: string;
  lat: number;
  lng: number;
}

export interface ShuttleTrip {
  id: number;
  routeId: number;
  routeName: string;
  originName: string;
  destinationName: string;
  stops?: ShuttleStop[];
  departAt: string;
  arriveAt: string;
  status: 'scheduled' | 'boarding' | 'in_progress' | 'completed' | 'cancelled';
  bookingCutoffAt?: string;
  driverName?: string;
  availableSeats: number;
  vehicle: {
    id: number;
    plateNo: string;
    type: string;
    capacity: number;
    layout?: any;
  };
  seats?: Seat[];
}

export interface Seat {
  id: number;
  label: string;
  row: number;
  col: number;
  isWindow: boolean;
  isAisle: boolean;
  isAccessible: boolean;
  isAvailable: boolean;
}

export interface Booking {
  id: number;
  tripId: number;
  userId: number;
  seatId?: number;
  seatLabel?: string;
  status: 'confirmed' | 'cancelled' | 'boarded';
  createdAt: string;
  departAt: string;
  originName: string;
  destinationName: string;
}

export interface WalletBalance {
  balanceLkr: number;
  balanceMinor: number;
  currency: string;
  co2SavedKg: number;
  corporateCardLast4: string;
}

export interface FuelClaim {
  id: string;
  station: string;
  date: string;
  amountLkr: number;
  status: 'verifying' | 'approved' | 'rejected';
}

export interface Transaction {
  id: number;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  timestamp: string;
  co2OffsetKg?: number;
}

export interface LiveVehicleTelemetry {
  tripId: number;
  plateNo: string;
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number;
  routeDistanceMeters: number;
  isDeviated: boolean;
  activeShuttlesCount: number;
  chargingCount: number;
}
