import fs from 'node:fs';
import path from 'node:path';
import type { Page, Request } from '@playwright/test';

/**
 * Latency the client pays per API request, on top of whatever the server takes.
 * Models the mobile radio + TLS round trip (~120ms is a typical 4G RTT).
 */
export const NET_MS = Number(process.env.PERF_NET_MS ?? 120);

/** Times each scenario runs; the report uses the median. */
export const REPEATS = Number(process.env.PERF_REPEATS ?? 3);

/** Names the output file: .perf/<label>.json */
export const LABEL = process.env.PERF_LABEL ?? 'run';

/** How long `idle:polling` sits on a page counting background requests. */
export const IDLE_MS = Number(process.env.PERF_IDLE_MS ?? 10_000);

/** No API request in flight for this long ⇒ the interaction has settled. */
const QUIET_MS = 150;

const RESULTS_DIR = path.join(__dirname, '..', '..', '.perf');

export interface Sample {
  /** Click → the UI shows the result. What the user calls "fast". */
  perceivedMs: number;
  /** Click → the last request finishes. The work actually done. */
  settledMs: number;
  /** API requests issued between click and settled. */
  apiCalls: number;
}

export interface ScenarioResult {
  name: string;
  description: string;
  samples: Sample[];
}

const results: ScenarioResult[] = [];

const isApi = (url: string) => new URL(url).pathname.startsWith('/api/');

export const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

// --- network ---------------------------------------------------------------

export interface ApiTracker {
  inFlight: number;
  total: number;
  lastFinishedAt: number;
}

/** Counts API traffic for the lifetime of the page. Install once, read often. */
export function trackApi(page: Page): ApiTracker {
  const tracker: ApiTracker = { inFlight: 0, total: 0, lastFinishedAt: 0 };

  const settle = (request: Request) => {
    if (!isApi(request.url())) return;
    tracker.inFlight = Math.max(0, tracker.inFlight - 1);
    tracker.lastFinishedAt = Date.now();
  };

  page.on('request', (request) => {
    if (!isApi(request.url())) return;
    tracker.inFlight += 1;
    tracker.total += 1;
  });
  page.on('requestfinished', settle);
  page.on('requestfailed', settle);

  return tracker;
}

/**
 * Delays every API request. Applied only around the measured interaction so
 * that seeding and navigation setup stay fast.
 *
 * Static assets are deliberately left alone: they are served from the same
 * machine and are identical before and after, so throttling them would add
 * noise to every scenario without changing any delta.
 */
export async function enableNetworkLatency(page: Page, ms = NET_MS): Promise<void> {
  await page.route('**/api/**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
}

export async function disableNetworkLatency(page: Page): Promise<void> {
  await page.unroute('**/api/**');
}

/** Resolves once no API request has been in flight for QUIET_MS. */
async function waitForSettled(page: Page, tracker: ApiTracker, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (tracker.inFlight === 0 && Date.now() - tracker.lastFinishedAt >= QUIET_MS) return;
    await page.waitForTimeout(25);
  }
  throw new Error('timed out waiting for API requests to settle');
}

// --- measurement -----------------------------------------------------------

export interface Scenario {
  name: string;
  description: string;
  /** Untimed, full-speed setup: navigate, open the modal, type the title. */
  arrange?: (run: number) => Promise<void>;
  /** Timed: the single click that commits, plus the wait for visible feedback. */
  act: (run: number) => Promise<void>;
}

/**
 * Runs a scenario REPEATS times under simulated latency and records, per run,
 * how long the UI took to respond versus how long the work took to finish.
 * The gap between the two is exactly what optimistic UI buys.
 */
export async function benchmark(page: Page, tracker: ApiTracker, scenario: Scenario): Promise<void> {
  const samples: Sample[] = [];

  for (let run = 0; run < REPEATS; run++) {
    await scenario.arrange?.(run);
    await waitForSettled(page, tracker);

    const callsBefore = tracker.total;
    await enableNetworkLatency(page);
    const started = performance.now();

    await scenario.act(run);
    const perceivedMs = performance.now() - started;

    await waitForSettled(page, tracker);
    const settledMs = performance.now() - started - QUIET_MS;
    await disableNetworkLatency(page);

    samples.push({
      perceivedMs: Math.round(perceivedMs),
      settledMs: Math.round(Math.max(settledMs, perceivedMs)),
      apiCalls: tracker.total - callsBefore,
    });
  }

  record({ name: scenario.name, description: scenario.description, samples });
}

export function record(result: ScenarioResult): void {
  results.push(result);
}

// --- reporting -------------------------------------------------------------

export function writeReport(): string {
  const report = {
    label: LABEL,
    createdAt: new Date().toISOString(),
    config: {
      netMs: NET_MS,
      dbMs: Number(process.env.PERF_DB_MS ?? 40),
      repeats: REPEATS,
      device: process.env.PERF_DEVICE ?? 'Pixel 5',
    },
    scenarios: results.map((r) => ({
      name: r.name,
      description: r.description,
      perceivedMs: median(r.samples.map((s) => s.perceivedMs)),
      settledMs: median(r.samples.map((s) => s.settledMs)),
      apiCalls: median(r.samples.map((s) => s.apiCalls)),
      samples: r.samples,
    })),
  };

  fs.mkdirSync(RESULTS_DIR, { recursive: true });
  const file = path.join(RESULTS_DIR, `${LABEL}.json`);
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);

  printTable(report.scenarios);
  return file;
}

function printTable(scenarios: { name: string; perceivedMs: number; settledMs: number; apiCalls: number }[]): void {
  const rows = scenarios.map((s) => [s.name, `${s.perceivedMs}`, `${s.settledMs}`, `${s.apiCalls}`]);
  const header = ['scenario', 'perceived', 'settled', 'api'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ');

  console.log(`\nperf: ${LABEL} (net ${NET_MS}ms/request, db ${process.env.PERF_DB_MS ?? 40}ms/round trip, median of ${REPEATS})`);
  console.log(line(header));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of rows) console.log(line(row));
  console.log('');
}
