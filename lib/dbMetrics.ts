import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request database round-trip counter, reported as a response header so
 * `features/api/round-trips.feature` can hold each endpoint to a budget.
 *
 * Gated on EXPOSE_DB_METRICS (set by playwright.config.ts for the test server
 * only): without it there is no AsyncLocalStorage, no counting, and no header.
 */
export const DB_ROUND_TRIPS_HEADER = 'x-db-round-trips';

export const dbMetricsEnabled = process.env.EXPOSE_DB_METRICS === '1';

// Stashed on globalThis for the same reason getDb() is: Next bundles a copy of
// this module per route, and the memoized client captures whichever copy first
// created it. A per-module AsyncLocalStorage would leave the counter writing to
// one instance while the handler reads another, reporting 0 for every request.
const globalForMetrics = globalThis as unknown as {
  __dbMetricsStorage?: AsyncLocalStorage<{ roundTrips: number }>;
};

const storage = dbMetricsEnabled
  ? (globalForMetrics.__dbMetricsStorage ??= new AsyncLocalStorage<{ roundTrips: number }>())
  : null;

/** Passed to instrumentClient; a no-op outside an instrumented request. */
export function recordRoundTrip(): void {
  const store = storage?.getStore();
  if (store) store.roundTrips += 1;
}

/** Runs a route handler with counting active and stamps the result. */
export async function withRoundTripHeader(fn: () => Promise<Response>): Promise<Response> {
  if (!storage) return await fn();

  const store = { roundTrips: 0 };
  return await storage.run(store, async () => {
    const response = await fn();
    response.headers.set(DB_ROUND_TRIPS_HEADER, String(store.roundTrips));
    return response;
  });
}
