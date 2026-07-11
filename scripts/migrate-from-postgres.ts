/**
 * One-off data migration: task-app v1 Postgres (Prisma schema) -> v2 SQLite (Drizzle schema).
 *
 * Usage:
 *   PG_URL=postgresql://user:pass@localhost:15432/taskapp SQLITE_PATH=./data/app.db npx tsx scripts/migrate-from-postgres.ts
 *
 * The target SQLite file must not already exist (refuses to overwrite).
 * Password hashes (bcryptjs) are copied verbatim, so existing logins keep working.
 * Verifies per-table row counts and SQLite foreign-key integrity at the end.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../db/schema';

// Prisma model -> sqlite drizzle table. Insertion order irrelevant: FKs are
// off during insert and checked afterwards.
const TABLES = [
  { pg: 'User', target: schema.users },
  { pg: 'TaskList', target: schema.taskLists },
  { pg: 'Task', target: schema.tasks },
  { pg: 'TaskListShare', target: schema.taskListShares },
  { pg: 'TaskTemplate', target: schema.taskTemplates },
  { pg: 'TemplateTask', target: schema.templateTasks },
  { pg: 'TemplateShare', target: schema.templateShares },
] as const;

export interface PgClientLike {
  query(sql: string): Promise<{ rows: Record<string, unknown>[] }>;
}

export async function runMigration(pg: PgClientLike, sqlitePathRaw: string): Promise<boolean> {
  const sqlitePath = path.resolve(sqlitePathRaw);
  if (fs.existsSync(sqlitePath)) {
    console.error(`Refusing to write into existing file: ${sqlitePath}`);
    return false;
  }
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

  const sqlite = new Database(sqlitePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = OFF');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(__dirname, '..', 'drizzle') });

  const counts: Array<{ table: string; pg: number; sqlite: number }> = [];

  for (const { pg: pgTable, target } of TABLES) {
    // pg returns camelCase keys (Prisma column names) and Date objects for
    // timestamps — exactly what the Drizzle schema expects.
    const { rows } = await pg.query(`SELECT * FROM "${pgTable}"`);
    if (rows.length > 0) {
      db.transaction(() => {
        for (let i = 0; i < rows.length; i += 500) {
          db.insert(target)
            .values(rows.slice(i, i + 500) as any)
            .run();
        }
      });
    }
    const [{ n }] = sqlite
      .prepare(`SELECT COUNT(*) AS n FROM "${getSqliteTableName(target)}"`)
      .all() as Array<{ n: number }>;
    counts.push({ table: pgTable, pg: rows.length, sqlite: n });
  }

  sqlite.pragma('foreign_keys = ON');
  const violations = sqlite.pragma('foreign_key_check') as unknown[];

  console.log('\nRow counts (postgres -> sqlite):');
  let ok = true;
  for (const c of counts) {
    const match = c.pg === c.sqlite;
    ok &&= match;
    console.log(`  ${match ? '✓' : '✗'} ${c.table}: ${c.pg} -> ${c.sqlite}`);
  }
  if (violations.length > 0) {
    ok = false;
    console.error(`✗ Foreign key violations: ${JSON.stringify(violations.slice(0, 5))}`);
  } else {
    console.log('  ✓ No foreign key violations');
  }

  sqlite.close();
  if (ok) console.log(`\nMigration complete: ${sqlitePath}`);
  else console.error('\nMigration FAILED verification.');
  return ok;
}

function getSqliteTableName(table: (typeof TABLES)[number]['target']): string {
  return (table as any)[Symbol.for('drizzle:Name')];
}

async function main() {
  const { PG_URL, SQLITE_PATH } = process.env;
  if (!PG_URL || !SQLITE_PATH) {
    console.error('Both PG_URL and SQLITE_PATH are required.');
    process.exit(1);
  }
  const { Client } = await import('pg');
  const client = new Client({ connectionString: PG_URL });
  await client.connect();
  try {
    const ok = await runMigration(client, SQLITE_PATH);
    process.exit(ok ? 0 : 1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
