import { z } from 'zod';

export type UserRole = 'employee' | 'driver' | 'admin' | 'policymaker';
export type TripKind = 'carpool' | 'shuttle';
export type AnomalyLevel = 'warning' | 'admin_alert' | 'auto_sos' | 'stall' | 'trip_end';
export type SosTrigger = 'manual' | 'auto_anomaly';
export type SosStatus = 'open' | 'acknowledged' | 'resolved';

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  companyId: number;
}

export interface WsTicket {
  ticket: string;
  userId: number;
  email: string;
  role: UserRole;
  companyId: number;
  expiresAt: number; // Unix timestamp ms
}

// Client -> Server Message Schemas
export const JoinMessageSchema = z.object({
  v: z.literal(1),
  type: z.literal('join'),
  tripId: z.number().int().positive(),
});

export const LocationMessageSchema = z.object({
  v: z.literal(1),
  type: z.literal('location'),
  tripId: z.number().int().positive(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracy: z.number().min(0).optional(),
  recordedAt: z.string().datetime().optional(),
});

export const PingMessageSchema = z.object({
  v: z.literal(1),
  type: z.literal('ping'),
});

export const SosMessageSchema = z.object({
  v: z.literal(1),
  type: z.literal('sos'),
  tripId: z.number().int().positive(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  note: z.string().max(500).optional(),
});

export type ClientMessage =
  | z.infer<typeof JoinMessageSchema>
  | z.infer<typeof LocationMessageSchema>
  | z.infer<typeof PingMessageSchema>
  | z.infer<typeof SosMessageSchema>;

export interface ParticipantState {
  userId: number;
  role: string;
  lastLocation?: {
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    recordedAt: string;
  };
}

export interface RouteBoundary {
  tripId: number;
  points: [number, number][]; // [ [lng, lat], ... ]
  mildThresholdM: number;
  severeThresholdM: number;
}

export interface AnomalyEvaluation {
  level: 'normal' | 'warning' | 'admin_alert' | 'auto_sos';
  distanceM: number;
  consecutiveMild: number;
  consecutiveSevere: number;
  escalated: boolean;
}
