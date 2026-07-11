import { resetDb } from './resetDb';

/**
 * Fresh data per test run (parity with the old stack's `compose up -V`
 * clean-DB behavior). Truncates rows rather than deleting the SQLite file:
 * a locally reused dev server (reuseExistingServer) keeps its open handle on
 * the same inode, so file deletion would silently split server and test
 * runner onto two different databases.
 */
export default async function globalSetup() {
  const dbUrl = process.env.TURSO_DATABASE_URL;
  if (!dbUrl || !dbUrl.includes('.test')) return; // never touch a real DB
  await resetDb(); // getDb() creates + migrates the file if it doesn't exist yet
}
