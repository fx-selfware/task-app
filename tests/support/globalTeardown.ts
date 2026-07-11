import { inArray, or, sql } from 'drizzle-orm';
import { users } from '@/db/schema';
import { getDb } from '@/lib/db';

// Accounts the e2e suite creates: unique throwaways (e2e_<ts>_<rand>@example.com)
// plus the fixed collaborator/admin emails referenced in features/e2e/*.feature.
const FIXED_TEST_EMAILS = ['collab@example.com', 'rt@example.com', 'tpl-collab@example.com', 'admin@test.com'];

/**
 * Deletes every account the suite creates (cascades take their lists, tasks,
 * shares, and templates). Runs against TURSO_DATABASE_URL — the local .test
 * file by default; when smoke-testing a deployed instance via BASE_URL,
 * export TURSO_DATABASE_URL/TURSO_AUTH_TOKEN too so cleanup reaches that
 * database, otherwise the test accounts stay behind.
 */
export default async function globalTeardown() {
  if (!process.env.TURSO_DATABASE_URL) return;
  const db = await getDb();
  await db
    .delete(users)
    .where(or(sql`${users.email} LIKE 'e2e\\_%' ESCAPE '\\'`, inArray(users.email, FIXED_TEST_EMAILS)));
}
