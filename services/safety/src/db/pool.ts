import { Pool } from 'pg';
import { config } from '../config';

export const pool = new Pool(
  config.databaseUrl
    ? { connectionString: config.databaseUrl, max: 20, idleTimeoutMillis: 30000 }
    : {
        host: config.dbHost,
        port: config.dbPort,
        user: config.dbUser,
        password: config.dbPassword,
        database: config.dbName,
        max: 20,
        idleTimeoutMillis: 30000,
      }
);

export async function checkDbConnection(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 AS connected');
    return res.rows[0]?.connected === 1;
  } catch {
    return false;
  }
}
