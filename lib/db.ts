import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '@/db/schema';
import { instrumentClient } from '@/lib/dbInstrument';
import { dbMetricsEnabled, recordRoundTrip } from '@/lib/dbMetrics';

export type Db = LibSQLDatabase<typeof schema>;

// Stashed on globalThis so the instance survives Next dev HMR reloads.
const globalForDb = globalThis as unknown as { __taskAppDb?: Promise<Db> };

async function init(): Promise<Db> {
  // Read env directly (not getConfig) so DB access never requires the
  // auth-related env vars — the test runner resets rows without JWT_SECRET.
  const url = process.env.TURSO_DATABASE_URL ?? 'file:./data/app.db';

  if (url.startsWith('file:') && url !== 'file::memory:') {
    fs.mkdirSync(path.dirname(path.resolve(url.slice('file:'.length))), { recursive: true });
  }

  const rawClient = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  // Test-only hooks, both inert unless their env var is set (see lib/dbInstrument):
  // PERF_DB_LATENCY_MS makes a local database feel remote for tests/perf,
  // EXPOSE_DB_METRICS counts round trips for features/api/round-trips.feature.
  const delayMs = Number(process.env.PERF_DB_LATENCY_MS ?? 0);
  const instrumented = delayMs > 0 || dbMetricsEnabled;
  const client = instrumented
    ? instrumentClient(rawClient, { delayMs, onRoundTrip: dbMetricsEnabled ? recordRoundTrip : undefined })
    : rawClient;

  const db = drizzle(client, { schema });

  if (url.startsWith('file:')) {
    // Embedded/local database: vanilla SQLite defaults FKs off, and nothing
    // else applies migrations. Remote Turso enforces FKs server-side and gets
    // migrations at build/deploy time (drizzle-kit migrate in vercel-build).
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA busy_timeout = 5000');
    await client.execute('PRAGMA foreign_keys = ON');
    await migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  }

  return db;
}

export function getDb(): Promise<Db> {
  return (globalForDb.__taskAppDb ??= init());
}
