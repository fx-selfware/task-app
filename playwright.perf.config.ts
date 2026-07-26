import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Latency benchmark — separate from playwright.config.ts on purpose:
 *
 * - it must own its web server (the main config reuses whatever is already on
 *   the port, which would silently drop the PERF_DB_LATENCY_MS env var);
 * - it measures a production build, since `next dev` compiles on demand and
 *   ships an unminified React that would dwarf the differences being measured;
 * - it is not BDD. These are not acceptance criteria, they are stopwatches.
 *
 * See tests/perf/README.md.
 */

const PERF_PORT = Number(process.env.PERF_PORT ?? 8098);
const BASE_URL = `http://localhost:${PERF_PORT}`;
const PERF_DB_URL = `file:${path.join(__dirname, 'tests', '.test', 'perf.db')}`;

/** Simulated round-trip latency to the database, charged per statement. */
const PERF_DB_MS = process.env.PERF_DB_MS ?? '40';

// The runner seeds fixtures over this same file — deliberately without the
// latency wrapper, which is set on the web server only.
process.env.TURSO_DATABASE_URL ??= PERF_DB_URL;

const device = process.env.PERF_DEVICE === 'desktop' ? devices['Desktop Chrome'] : devices['Pixel 5'];

export default defineConfig({
  testDir: './tests/perf',
  testMatch: '**/*.perf.ts',
  globalSetup: './tests/support/globalSetup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    // Deterministic runs: the service worker would otherwise serve some static
    // assets from cache on later scenarios and none on the first.
    serviceWorkers: 'block',
    ...device,
  },
  webServer: {
    command: `npx next start -p ${PERF_PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      TURSO_DATABASE_URL: PERF_DB_URL,
      JWT_SECRET: 'perf-jwt-secret-at-least-32-chars!',
      COOKIE_SECURE: 'false',
      PERF_DB_LATENCY_MS: PERF_DB_MS,
      PORT: String(PERF_PORT),
    },
  },
});
