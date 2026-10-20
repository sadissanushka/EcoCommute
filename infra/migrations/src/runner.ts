import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/corporate_shuttle',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'corporate_shuttle',
});

const MIGRATIONS_DIR = path.resolve(__dirname, '../sql');

interface MigrationFile {
  filename: string;
  version: string;
  schema: string;
  description: string;
  filepath: string;
}

function ensureMigrationsDir(): void {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
}

async function ensureMigrationTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      schema_namespace TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

function parseMigrationFilename(filename: string): MigrationFile | null {
  const match = filename.match(/^(\d{12})__([a-z0-9_]+)__(.+)\.sql$/);
  if (!match) return null;
  return {
    filename,
    version: match[1],
    schema: match[2],
    description: match[3],
    filepath: path.join(MIGRATIONS_DIR, filename),
  };
}

function getMigrationFiles(): MigrationFile[] {
  ensureMigrationsDir();
  const files = fs.readdirSync(MIGRATIONS_DIR);
  const parsed = files
    .map(parseMigrationFilename)
    .filter((f): f is MigrationFile => f !== null);

  parsed.sort((a, b) => a.version.localeCompare(b.version));
  return parsed;
}

async function getAppliedMigrations(client: PoolClient): Promise<Set<string>> {
  const res = await client.query('SELECT filename FROM public.schema_migrations');
  return new Set(res.rows.map((r: { filename: string }) => r.filename));
}

export async function migrateUp(): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const applied = await getAppliedMigrations(client);
    const all = getMigrationFiles();
    const pending = all.filter((m) => !applied.has(m.filename));

    if (pending.length === 0) {
      console.log('✅ Database is already up to date. No pending migrations.');
      return;
    }

    console.log(`🚀 Applying ${pending.length} pending migration(s)...`);

    for (const migration of pending) {
      console.log(`\n▶ Applying [${migration.schema}]: ${migration.filename}`);
      const sqlContent = fs.readFileSync(migration.filepath, 'utf8');

      // Extract UP section if file has UP/DOWN split
      const parts = sqlContent.split(/--\s*>>>\s*DOWN\s*>>>/i);
      const upSql = parts[0].replace(/--\s*>>>\s*UP\s*>>>/i, '').trim();

      await client.query('BEGIN');
      try {
        await client.query(upSql);
        await client.query(
          'INSERT INTO public.schema_migrations (filename, schema_namespace) VALUES ($1, $2)',
          [migration.filename, migration.schema]
        );
        await client.query('COMMIT');
        console.log(`✔ Applied: ${migration.filename}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ Migration failed in ${migration.filename}:`, err);
        throw err;
      }
    }

    console.log('\n✨ All pending migrations successfully applied!');
  } finally {
    client.release();
    await pool.end();
  }
}

export async function migrateDown(): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const lastRes = await client.query(
      'SELECT id, filename FROM public.schema_migrations ORDER BY id DESC LIMIT 1'
    );

    if (lastRes.rows.length === 0) {
      console.log('ℹ No applied migrations to revert.');
      return;
    }

    const lastMigration = lastRes.rows[0];
    const filepath = path.join(MIGRATIONS_DIR, lastMigration.filename);

    if (!fs.existsSync(filepath)) {
      throw new Error(`Migration file not found on disk: ${lastMigration.filename}`);
    }

    const sqlContent = fs.readFileSync(filepath, 'utf8');
    const parts = sqlContent.split(/--\s*>>>\s*DOWN\s*>>>/i);

    if (parts.length < 2 || !parts[1].trim()) {
      throw new Error(`Migration ${lastMigration.filename} does not contain a -- >>> DOWN >>> rollback section.`);
    }

    const downSql = parts[1].trim();

    console.log(`⏪ Reverting: ${lastMigration.filename}...`);
    await client.query('BEGIN');
    try {
      await client.query(downSql);
      await client.query('DELETE FROM public.schema_migrations WHERE id = $1', [lastMigration.id]);
      await client.query('COMMIT');
      console.log(`✔ Successfully rolled back: ${lastMigration.filename}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`❌ Rollback failed for ${lastMigration.filename}:`, err);
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

export async function migrateStatus(): Promise<void> {
  const client = await pool.connect();
  try {
    await ensureMigrationTable(client);
    const appliedRes = await client.query(
      'SELECT filename, schema_namespace, applied_at FROM public.schema_migrations ORDER BY id ASC'
    );
    const appliedMap = new Map(appliedRes.rows.map((r: any) => [r.filename, r.applied_at]));
    const all = getMigrationFiles();

    console.log('\n========================================================================================');
    console.log('VERSIONED DATABASE MIGRATION STATUS');
    console.log('========================================================================================');
    console.log(
      'Status'.padEnd(10) +
      'Version'.padEnd(15) +
      'Schema'.padEnd(12) +
      'Applied At'.padEnd(28) +
      'Filename'
    );
    console.log('----------------------------------------------------------------------------------------');

    for (const m of all) {
      const appliedAt = appliedMap.get(m.filename);
      const statusStr = appliedAt ? 'APPLIED' : 'PENDING';
      const appliedAtStr = appliedAt ? new Date(appliedAt).toISOString() : '-';

      console.log(
        statusStr.padEnd(10) +
        m.version.padEnd(15) +
        m.schema.padEnd(12) +
        appliedAtStr.padEnd(28) +
        m.filename
      );
    }
    console.log('========================================================================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

export function createMigration(schema: string, desc: string): void {
  ensureMigrationsDir();
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const timestamp = `${year}${month}${day}${hours}${mins}`;

  const cleanSchema = schema.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const cleanDesc = desc.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const filename = `${timestamp}__${cleanSchema}__${cleanDesc}.sql`;
  const filepath = path.join(MIGRATIONS_DIR, filename);

  const template = `-- Migration: ${filename}
-- Schema: ${cleanSchema}
-- Description: ${desc}
-- Created: ${now.toISOString()}

-- >>> UP >>>
CREATE SCHEMA IF NOT EXISTS ${cleanSchema};

-- Write your forward DDL statements here:


-- >>> DOWN >>>
-- Write rollback statements here:

`;

  fs.writeFileSync(filepath, template, 'utf8');
  console.log(`✅ Created migration file: ${filepath}`);
}

// CLI Command Dispatcher
const command = process.argv[2] || 'status';

if (command === 'up') {
  migrateUp().catch(() => process.exit(1));
} else if (command === 'down') {
  migrateDown().catch(() => process.exit(1));
} else if (command === 'status') {
  migrateStatus().catch(() => process.exit(1));
} else if (command === 'create') {
  const schemaArg = process.argv[3] || 'wallet';
  const descArg = process.argv[4] || 'new_migration';
  createMigration(schemaArg, descArg);
} else {
  console.error(`Unknown command: ${command}. Use 'up', 'down', 'status', or 'create'.`);
  process.exit(1);
}
