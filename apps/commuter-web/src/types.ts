export interface User {
  id: number;
  email: string;
  fullName: string;
  phone?: string;
  companyId: number;
  companyName?: string;
  role: 'employee' | 'driver' | 'admin' | 'policymaker';
  verified?: boolean;
}

export function getFriendlyFirstName(fullName?: string): string {
  if (!fullName) return 'Commuter';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length > 1 && /^([A-Z]\.?)$/i.test(parts[0])) {
    return parts[1];
  }
  const match = parts[0].match(/^[A-Z]\.([A-Za-z]+)$/i);
  if (match) {
    return match[1];
  }
  return parts[0];
}

export function getAvatarInitials(fullName?: string): string {
  if (!fullName) return 'EC';
  const clean = fullName.replace(/^[A-Z]\.\s*/i, '').replace(/^[A-Z]\./i, '');
  const parts = clean.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
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

export interface MyBooking {
  id: number;
  tripId: number;
  userId?: number;
  partySize: number;
  status: string;
  createdAt: string;
  departAt: string;
  arriveAt: string;
  routeName: string;
  originName: string;
  destinationName: string;
  plateNo: string;
  vehicleType: string;
  seats: {
    id: number;
    label: string;
  }[];
}

export interface BookingConfirmation {
  id: number;
  tripId: number;
  userId: number;
  partySize: number;
  status: 'confirmed' | 'cancelled' | 'boarded';
  assignedSeatIds: number[];
  allocationType?: 'adjacent' | 'fallback' | 'explicit';
  createdAt: string;
}

export interface WaitlistEntry {
  id: number;
  tripId: number;
  userId?: number;
  partySize: number;
  status: 'waiting' | 'promoted' | 'cancelled';
  position: number;
  createdAt: string;
  bookingId?: number | null;
  departAt?: string;
  arriveAt?: string;
  routeName?: string;
  originName?: string;
  destinationName?: string;
  plateNo?: string;
  vehicleType?: string;
}

export interface SeatHold {
  id: number;
  tripId: number;
  userId: number;
  partySize: number;
  status: 'held' | 'confirmed' | 'expired' | 'released';
  expiresAt: string;
  expiresInSeconds: number;
  seatIds: number[];
  seats?: {
    id: number;
    label: string;
    row?: number;
    col?: number;
  }[];
  allocationType?: 'adjacent' | 'fallback' | 'explicit';
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
