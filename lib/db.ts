import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@/db/schema';

export type Db = BetterSQLite3Database<typeof schema>;

// Stashed on globalThis so the instance survives Next dev HMR reloads.
const globalForDb = globalThis as unknown as { __taskAppDb?: Db };

function createDb(): Db {
  const dbPath = process.env.SQLITE_PATH ?? './data/app.db';
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  return db;
}

export function getDb(): Db {
  return (globalForDb.__taskAppDb ??= createDb());
}
