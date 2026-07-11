import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// TEST_PORT override lets parallel checkouts run tests without colliding.
const TEST_PORT = Number(process.env.TEST_PORT ?? 8099);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${TEST_PORT}`;
const TEST_DB_URL = `file:${path.join(__dirname, '.test', 'test.db')}`;

// The test runner (steps reset the DB directly) and the web server must agree
// on the SQLite file. This module is loaded by every Playwright worker.
process.env.TURSO_DATABASE_URL ??= TEST_DB_URL;

const serverEnv = {
  TURSO_DATABASE_URL: TEST_DB_URL,
  JWT_SECRET: 'test-jwt-secret-at-least-32-chars!',
  COOKIE_SECURE: 'false',
  ADMIN_EMAILS: 'admin@example.com,admin@test.com',
  PORT: String(TEST_PORT),
};

const apiTestDir = defineBddConfig({
  outputDir: '.features-gen/api',
  features: 'features/api/**/*.feature',
  steps: 'tests/steps/api/**/*.ts',
});

// TEMPORARY (rewrite transition): e2e features live in features/pending/e2e
// until their steps are ported; an empty feature set would fail bddgen.
const hasE2eFeatures =
  fs.existsSync(path.join(__dirname, 'features/e2e')) &&
  fs.readdirSync(path.join(__dirname, 'features/e2e')).some((f) => f.endsWith('.feature'));

const e2eTestDir = hasE2eFeatures
  ? defineBddConfig({
      outputDir: '.features-gen/e2e',
      features: 'features/e2e/**/*.feature',
      steps: 'tests/steps/e2e/**/*.ts',
    })
  : '';

export default defineConfig({
  globalSetup: './tests/support/globalSetup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'api',
      testDir: apiTestDir,
    },
    ...(hasE2eFeatures
      ? [
          {
            name: 'chromium',
            testDir: e2eTestDir,
            use: { ...devices['Desktop Chrome'] },
            grepInvert: /@touch-only/,
          },
          {
            name: 'mobile-chrome',
            testDir: e2eTestDir,
            use: { ...devices['Pixel 5'] },
            grep: /@touch-only/,
          },
        ]
      : []),
  ],
  webServer: {
    // CI runs `next build` first and tests the production server; local runs
    // use `next dev` (or reuse an already-running server on the port).
    command: process.env.CI ? `npx next start -p ${TEST_PORT}` : `npx next dev -p ${TEST_PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: serverEnv,
  },
});
