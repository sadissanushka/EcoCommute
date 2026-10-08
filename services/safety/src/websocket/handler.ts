import { WebSocket } from 'ws';
import { ConnectedSocket, roomManager } from './rooms';
import { gpsBuffer } from './gpsIngestion';
import { pointToRouteDistanceMeters } from '../detector/routeDistance';
import { TripDetectorStateMachine } from '../detector/escalationLadder';
import { pool } from '../db/pool';
import {
  JoinMessageSchema,
  LocationMessageSchema,
  SosMessageSchema,
} from '../types';

// Per-trip active anomaly detectors
export const activeDetectors = new Map<number, TripDetectorStateMachine>();
// Per-trip cached route boundaries
export const cachedRouteBoundaries = new Map<number, [number, number][]>();

export async function loadRouteBoundary(tripId: number): Promise<[number, number][]> {
  if (cachedRouteBoundaries.has(tripId)) {
    return cachedRouteBoundaries.get(tripId)!;
  }

  try {
    const res = await pool.query(
      `SELECT ST_AsGeoJSON(geom)::jsonb AS geojson, mild_threshold_m, severe_threshold_m 
       FROM safety.route_boundaries WHERE trip_id = $1`,
      [tripId]
    );

    if (res.rows.length > 0 && res.rows[0].geojson) {
      const coords = res.rows[0].geojson.coordinates as [number, number][];
      cachedRouteBoundaries.set(tripId, coords);
      return coords;
    }
  } catch {
    // Fallback default corridor (Kaduwela - Colombo)
  }

  const defaultCoords: [number, number][] = [
    [79.9832, 6.9319],
    [79.9547, 6.9042],
    [79.9234, 6.8996],
    [79.8967, 6.9085],
    [79.8428, 6.9344],
  ];
  cachedRouteBoundaries.set(tripId, defaultCoords);
  return defaultCoords;
}

export function handleWebSocketMessage(ws: ConnectedSocket, data: Buffer | string): void {
  let parsed: any;
  try {
    parsed = JSON.parse(data.toString());
  } catch {
    ws.send(JSON.stringify({ v: 1, type: 'error', code: 'INVALID_JSON', message: 'Malformed JSON payload' }));
    return;
  }

  // 1. PING -> PONG
  if (parsed.type === 'ping') {
    ws.send(JSON.stringify({ v: 1, type: 'pong', timestamp: new Date().toISOString() }));
    return;
  }

  // 2. JOIN ROOM
  if (parsed.type === 'join') {
    const valid = JoinMessageSchema.safeParse(parsed);
    if (!valid.success) {
      ws.send(JSON.stringify({ v: 1, type: 'error', code: 'INVALID_PAYLOAD', message: valid.error.message }));
      return;
    }

    const { tripId } = valid.data;

    roomManager.authorizeTripJoin(tripId, ws.user).then((authorized) => {
      if (!authorized) {
        ws.close(4403, 'Forbidden: User not in trip participants');
        return;
      }

      const roomName = `trip:${tripId}`;
      roomManager.joinRoom(roomName, ws);

      // Join admin company room if user is admin
      if (ws.user.role === 'admin') {
        roomManager.joinRoom(`company-admins:${ws.user.companyId}`, ws);
      }

      // Initialize trip detector state machine if not already active
      if (!activeDetectors.has(tripId)) {
        activeDetectors.set(tripId, new TripDetectorStateMachine());
      }

      const participants = roomManager.getTripParticipants(tripId);

      ws.send(JSON.stringify({
        v: 1,
        type: 'joined',
        tripId,
        userId: ws.user.id,
        role: ws.user.role,
        participants,
      }));
    });
    return;
  }

  // 3. LOCATION INGESTION
  if (parsed.type === 'location') {
    const valid = LocationMessageSchema.safeParse(parsed);
    if (!valid.success) {
      ws.send(JSON.stringify({ v: 1, type: 'error', code: 'INVALID_PAYLOAD', message: valid.error.message }));
      return;
    }

    const { tripId, lat, lng, speed, heading, accuracy } = valid.data;
    const roomName = `trip:${tripId}`;

    // Verify socket is subscribed to this trip room
    if (!ws.rooms.has(roomName)) {
      ws.send(JSON.stringify({ v: 1, type: 'error', code: 'NOT_IN_ROOM', message: 'Must join trip room first' }));
      return;
    }

    const recordedAt = valid.data.recordedAt || new Date().toISOString();

    // Enqueue in batch buffer
    gpsBuffer.enqueue({
      tripId,
      userId: ws.user.id,
      lat,
      lng,
      speedMps: speed,
      heading,
      accuracyM: accuracy,
      recordedAt,
    });

    // Update memory state
    roomManager.updateParticipantLocation(tripId, ws.user.id, ws.user.role, {
      lat,
      lng,
      speed,
      heading,
      accuracy,
      recordedAt,
    });

    // Broadcast location to all room participants
    roomManager.broadcastToRoom(roomName, {
      v: 1,
      type: 'location',
      tripId,
      userId: ws.user.id,
      role: ws.user.role,
      lat,
      lng,
      speed,
      heading,
      accuracy,
      recordedAt,
    });

    // Run real-time anomaly evaluation against route boundaries
    loadRouteBoundary(tripId).then((polyline) => {
      const detector = activeDetectors.get(tripId) || new TripDetectorStateMachine();
      activeDetectors.set(tripId, detector);

      const distRes = pointToRouteDistanceMeters({ lat, lng }, polyline);
      const transition = detector.processPoint(distRes.minDistanceMeters, accuracy);

      if (transition.actionRequired === 'BROADCAST_WARNING' || transition.actionRequired === 'ADMIN_ALERT') {
        roomManager.broadcastToRoom(roomName, {
          v: 1,
          type: 'deviation',
          tripId,
          level: transition.currentState.toLowerCase(),
          distanceM: distRes.minDistanceMeters,
          consecutivePoints: transition.consecutiveMild,
          timestamp: new Date().toISOString(),
        });

        // Also push to company admins room
        roomManager.broadcastToRoom(`company-admins:${ws.user.companyId}`, {
          v: 1,
          type: 'admin_alert',
          tripId,
          userId: ws.user.id,
          distanceM: distRes.minDistanceMeters,
          level: transition.currentState.toLowerCase(),
          timestamp: new Date().toISOString(),
        });
      } else if (transition.actionRequired === 'TRIGGER_AUTO_SOS') {
        roomManager.broadcastToRoom(roomName, {
          v: 1,
          type: 'sos',
          tripId,
          userId: ws.user.id,
          trigger: 'auto_anomaly',
          distanceM: distRes.minDistanceMeters,
          lat,
          lng,
          status: 'open',
          timestamp: new Date().toISOString(),
        });
      }
    });

    return;
  }

  // 4. MANUAL SOS
  if (parsed.type === 'sos') {
    const valid = SosMessageSchema.safeParse(parsed);
    if (!valid.success) {
      ws.send(JSON.stringify({ v: 1, type: 'error', code: 'INVALID_PAYLOAD', message: valid.error.message }));
      return;
    }

    const { tripId, lat, lng, note } = valid.data;
    const roomName = `trip:${tripId}`;

    const sosPayload = {
      v: 1,
      type: 'sos',
      tripId,
      userId: ws.user.id,
      trigger: 'manual',
      lat,
      lng,
      note: note || 'Emergency SOS triggered',
      status: 'open',
      timestamp: new Date().toISOString(),
    };

    roomManager.broadcastToRoom(roomName, sosPayload);
    roomManager.broadcastToRoom(`company-admins:${ws.user.companyId}`, sosPayload);
    return;
  }
}
