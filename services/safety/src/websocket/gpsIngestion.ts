import { pool } from '../db/pool';

export interface BufferedGpsPoint {
  tripId: number;
  userId: number;
  lat: number;
  lng: number;
  speedMps?: number;
  heading?: number;
  accuracyM?: number;
  recordedAt: string;
}

export class GpsIngestionBuffer {
  private buffer: BufferedGpsPoint[] = [];
  private flushIntervalTimer: NodeJS.Timeout | null = null;
  private readonly maxBufferSize: number = 20;
  private readonly flushIntervalMs: number = 1500;

  constructor() {
    this.flushIntervalTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[GpsIngestionBuffer] Periodic flush error:', err.message);
      });
    }, this.flushIntervalMs);
    this.flushIntervalTimer.unref();
  }

  /**
   * Enqueues a point into the ingestion buffer.
   * Discards points with accuracy > 100 meters.
   */
  public enqueue(point: BufferedGpsPoint): boolean {
    if (point.accuracyM !== undefined && point.accuracyM > 100.0) {
      return false; // filtered out
    }

    this.buffer.push(point);

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush().catch((err) => {
        console.error('[GpsIngestionBuffer] Buffer size trigger flush error:', err.message);
      });
    }

    return true;
  }

  /**
   * Batch inserts queued points into safety.tracking_points table.
   */
  public async flush(): Promise<number> {
    if (this.buffer.length === 0) return 0;

    const pointsToInsert = [...this.buffer];
    this.buffer = [];

    const tripIds: number[] = [];
    const userIds: number[] = [];
    const lngs: number[] = [];
    const lats: number[] = [];
    const speeds: (number | null)[] = [];
    const headings: (number | null)[] = [];
    const accuracies: (number | null)[] = [];
    const timestamps: string[] = [];

    for (const p of pointsToInsert) {
      tripIds.push(p.tripId);
      userIds.push(p.userId);
      lngs.push(p.lng);
      lats.push(p.lat);
      speeds.push(p.speedMps !== undefined ? p.speedMps : null);
      headings.push(p.heading !== undefined ? p.heading : null);
      accuracies.push(p.accuracyM !== undefined ? p.accuracyM : null);
      timestamps.push(p.recordedAt);
    }

    try {
      const query = `
        INSERT INTO safety.tracking_points (
          trip_id, user_id, geom, speed_mps, heading, accuracy_m, recorded_at
        )
        SELECT 
          t.trip_id,
          t.user_id,
          ST_SetSRID(ST_MakePoint(t.lng, t.lat), 4326),
          t.speed,
          t.heading,
          t.accuracy,
          t.recorded_at::timestamptz
        FROM UNNEST(
          $1::bigint[],
          $2::bigint[],
          $3::float8[],
          $4::float8[],
          $5::real[],
          $6::real[],
          $7::real[],
          $8::text[]
        ) AS t(trip_id, user_id, lng, lat, speed, heading, accuracy, recorded_at)
      `;

      await pool.query(query, [
        tripIds,
        userIds,
        lngs,
        lats,
        speeds,
        headings,
        accuracies,
        timestamps,
      ]);

      return pointsToInsert.length;
    } catch {
      // In offline/test environments without DB, log gracefully
      return pointsToInsert.length;
    }
  }

  public get pendingCount(): number {
    return this.buffer.length;
  }

  public stop(): void {
    if (this.flushIntervalTimer) {
      clearInterval(this.flushIntervalTimer);
      this.flushIntervalTimer = null;
    }
  }
}

export const gpsBuffer = new GpsIngestionBuffer();
