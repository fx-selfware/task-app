# Latency benchmark

Measures how the app feels over a slow connection, so a performance change can
be proven rather than asserted. Not part of `npm test` — it is a stopwatch, not
an acceptance criterion.

```bash
PERF_LABEL=before npm run test:perf     # on main
# ... make the change ...
PERF_LABEL=after  npm run test:perf
npm run perf:compare before after
```

Reports land in `.perf/<label>.json` (gitignored). `npm run test:perf` rebuilds
first — always run it through the npm script, never `playwright test` directly,
or you will measure a stale build.

## What it simulates

Two independent delays, because the app pays two independent costs:

| Knob | Default | Models |
| --- | --- | --- |
| `PERF_NET_MS` | 120 | Client→server round trip, added to every `/api/*` request by the test |
| `PERF_DB_MS` | 40 | Server→Turso round trip, charged per statement by `lib/dbLatency.ts` |

An API call therefore costs `PERF_NET_MS + (statements × PERF_DB_MS)`. That
second term is the point: it means a route that batches three statements into
one `db.batch()` measures faster than one that runs them sequentially, and an
interactive `db.transaction()` pays for `BEGIN`, every statement, and `COMMIT`.

The latency wrapper also serializes writes, because Turso queues concurrent
writers while local SQLite fails the loser with `SQLITE_BUSY_SNAPSHOT` — an
artifact that only appears once transactions are held open for a simulated
round trip.

Static assets are deliberately not throttled. They are served from the same
machine and are identical before and after, so delaying them would add noise to
every scenario without changing a single delta.

## What it reports

Per scenario, the median of `PERF_REPEATS` (default 3) runs:

- **perceived** — the click until the UI shows the result. This is what the user
  calls "fast". Optimistic UI drives it toward zero without the server changing
  at all.
- **settled** — the click until the last request finishes. Batching database
  round trips and removing redundant refetches drive this down.
- **api** — requests issued per interaction. A mutation that also invalidates
  its query costs two.

A large gap between perceived and settled means the app is hiding latency well.
Two numbers that move together mean it isn't hiding it at all.

Two identical runs land within ±1% on most scenarios, so treat anything under
about 5% as noise. The exception is `settled` on scenarios that finish in tens
of milliseconds, where a background poll landing inside the settle window can
swing the number 15–20%; raise `PERF_REPEATS` if you need to call a small
change there.

## Other knobs

| Variable | Default | Meaning |
| --- | --- | --- |
| `PERF_LABEL` | `run` | Output file name under `.perf/` |
| `PERF_REPEATS` | `3` | Runs per scenario; the report takes the median |
| `PERF_DEVICE` | `Pixel 5` | `desktop` switches to Desktop Chrome |
| `PERF_PORT` | `8098` | Its own port — it never reuses a running server |
| `PERF_IDLE_MS` | `10000` | Window for the `idle:polling` scenario |

## Files

- `interactions.perf.ts` — the scenarios
- `harness.ts` — latency injection, timing, reporting
- `fixtures.ts` — per-scenario account so runs can't perturb each other
- `seed.ts` — fixtures written straight to SQLite (seeding over HTTP would pay
  the simulated latency and measure nothing)
- `compare.ts` — diffs two reports
