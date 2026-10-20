import { pool } from '../db/pool';
import { roomManager } from '../websocket/rooms';
import { mailerService } from './mailer';
import { SosStatus, SosTrigger } from '../types';

export interface SosEvent {
  id: number;
  tripId?: number | null;
  userId: number;
  trigger: SosTrigger;
  lat?: number;
  lng?: number;
  status: SosStatus;
  createdAt: Date;
  resolvedAt?: Date | null;
  resolvedBy?: number | null;
  note?: string | null;
}

// In-memory fallback for offline test environments
export const inMemorySosEvents: SosEvent[] = [];

export class SosService {
  public async triggerSos(params: {
    tripId?: number | null;
    userId: number;
    trigger: SosTrigger;
    lat?: number;
    lng?: number;
    companyId?: number;
    note?: string;
  }): Promise<SosEvent> {
    const { tripId, userId, trigger, lat, lng, companyId, note } = params;

    // Check for existing open event to maintain idempotency
    const existing = inMemorySosEvents.find(
      (e) => e.tripId === tripId && e.userId === userId && e.status === 'open'
    );
    if (existing) {
      return existing;
    }

    let event: SosEvent = {
      id: Date.now(),
      tripId,
      userId,
      trigger,
      lat,
      lng,
      status: 'open',
      createdAt: new Date(),
      note: note || (trigger === 'manual' ? 'Manual SOS triggered by passenger/driver' : 'Automatic SOS triggered by severe deviation'),
    };

    try {
      const pointSql = lat && lng ? `ST_SetSRID(ST_MakePoint($4, $3), 4326)` : `NULL`;
      const insertRes = await pool.query(
        `INSERT INTO safety.sos_events (trip_id, user_id, trigger, geom, note)
         VALUES ($1, $2, $3, ${pointSql}, $5)
         RETURNING id, trip_id, user_id, trigger, status, created_at, note`,
        [tripId, userId, trigger, lng, note]
      );
      if (insertRes.rows.length > 0) {
        const row = insertRes.rows[0];
        event = {
          id: row.id,
          tripId: row.trip_id,
          userId: row.user_id,
          trigger: row.trigger,
          lat,
          lng,
          status: row.status,
          createdAt: row.created_at,
          note: row.note,
        };
      }
    } catch {
      // offline fallback
      inMemorySosEvents.push(event);
    }

    // 1. Fan out via WebSocket to trip room
    if (tripId) {
      roomManager.broadcastToRoom(`trip:${tripId}`, {
        v: 1,
        type: 'sos',
        eventId: event.id,
        tripId,
        userId,
        trigger,
        lat,
        lng,
        status: 'open',
        timestamp: event.createdAt.toISOString(),
      });
    }

    // 2. Fan out to company safety admins
    if (companyId) {
      roomManager.broadcastToRoom(`company-admins:${companyId}`, {
        v: 1,
        type: 'sos_admin_alert',
        eventId: event.id,
        tripId,
        userId,
        trigger,
        lat,
        lng,
        status: 'open',
        timestamp: event.createdAt.toISOString(),
      });
    }

    // 3. Dispatch alert to emergency contacts
    try {
      const prefRes = await pool.query(
        `SELECT emergency_contact_email, emergency_contact_name 
         FROM safety.safety_preferences WHERE user_id = $1`,
        [userId]
      );
      if (prefRes.rows.length > 0 && prefRes.rows[0].emergency_contact_email) {
        await mailerService.sendMail({
          to: prefRes.rows[0].emergency_contact_email,
          subject: 'EMERGENCY: SOS Alert Triggered on EcoCommute',
          text: `An emergency SOS alert was activated for your contact on trip #${tripId}. Current coordinates: lat=${lat}, lng=${lng}. Safety coordinators have been notified.`,
        });
      }
    } catch {
      // ignore
    }

    return event;
  }

  public async acknowledgeSos(eventId: number, adminUserId: number): Promise<SosEvent | null> {
    try {
      const res = await pool.query(
        `UPDATE safety.sos_events 
         SET status = 'acknowledged' 
         WHERE id = $1 
         RETURNING id, trip_id, user_id, trigger, status, created_at, note`,
        [eventId]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          tripId: row.trip_id,
          userId: row.user_id,
          trigger: row.trigger,
          status: row.status,
          createdAt: row.created_at,
          note: row.note,
        };
      }
    } catch {
      const mem = inMemorySosEvents.find((e) => e.id === eventId);
      if (mem) {
        mem.status = 'acknowledged';
        return mem;
      }
    }
    return null;
  }

  public async resolveSos(eventId: number, adminUserId: number, note: string): Promise<SosEvent | null> {
    try {
      const res = await pool.query(
        `UPDATE safety.sos_events 
         SET status = 'resolved', resolved_at = now(), resolved_by = $2, note = $3 
         WHERE id = $1 
         RETURNING id, trip_id, user_id, trigger, status, created_at, resolved_at, resolved_by, note`,
        [eventId, adminUserId, note]
      );
      if (res.rows.length > 0) {
        const row = res.rows[0];
        return {
          id: row.id,
          tripId: row.trip_id,
          userId: row.user_id,
          trigger: row.trigger,
          status: row.status,
          createdAt: row.created_at,
          resolvedAt: row.resolved_at,
          resolvedBy: row.resolved_by,
          note: row.note,
        };
      }
    } catch {
      const mem = inMemorySosEvents.find((e) => e.id === eventId);
      if (mem) {
        mem.status = 'resolved';
        mem.resolvedAt = new Date();
        mem.resolvedBy = adminUserId;
        mem.note = note;
        return mem;
      }
    }
    return null;
  }

  public async getActiveEvents(companyId?: number): Promise<SosEvent[]> {
    try {
      const res = await pool.query(
        `SELECT id, trip_id, user_id, trigger, status, created_at, note 
         FROM safety.sos_events 
         WHERE status IN ('open', 'acknowledged') 
         ORDER BY created_at DESC`
      );
      return res.rows.map((row) => ({
        id: row.id,
        tripId: row.trip_id,
        userId: row.user_id,
        trigger: row.trigger,
        status: row.status,
        createdAt: row.created_at,
        note: row.note,
      }));
    } catch {
      return inMemorySosEvents.filter((e) => e.status === 'open' || e.status === 'acknowledged');
    }
  }
}

export const sosService = new SosService();
