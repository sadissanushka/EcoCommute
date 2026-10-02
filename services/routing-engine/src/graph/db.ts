import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/corporate_shuttle',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export async function testDbConnection(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 as connected, postgis_version() as postgis;');
    console.log(`[DB] Connected successfully to PostgreSQL with PostGIS: ${res.rows[0].postgis}`);
    return true;
  } catch (err) {
    console.error('[DB] Connection error:', err);
    return false;
  }
}
