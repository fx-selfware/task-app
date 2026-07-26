import type { Client, Transaction } from '@libsql/client';

/**
 * Perf-harness hook, off unless PERF_DB_LATENCY_MS is set (see tests/perf/).
 *
 * A local `file:` database answers in microseconds, which hides the cost the
 * app actually pays in production: one network round trip to Turso per
 * statement. Charging every round trip a fixed delay makes a local run behave
 * like a remote one, so the benchmark can see the difference between
 * `db.batch([a, b, c])` (one round trip) and an interactive `db.transaction()`
 * (BEGIN + one per statement + COMMIT).
 *
 * Writes are also serialized, for the same fidelity reason: Turso takes a
 * single writer and queues the rest, while local SQLite fails the loser of a
 * race outright with SQLITE_BUSY_SNAPSHOT — which busy_timeout does not retry.
 * Without the queue, holding a write transaction open for the simulated
 * latency turns any burst of concurrent writes into 500s that exist nowhere
 * but this harness.
 *
 * Never installed in dev or production: `getDb()` only calls this when the env
 * var is present, and nothing outside tests/perf sets it.
 */
export function withSimulatedLatency(client: Client, ms: number): Client {
  return chargePerRoundTrip(client, ms, CLIENT_ROUND_TRIPS);
}

/** Client methods that each cost exactly one round trip to a remote database. */
const CLIENT_ROUND_TRIPS = ['execute', 'batch', 'executeMultiple', 'migrate', 'transaction'];

/** Same, on the handle returned by `client.transaction()`. */
const TRANSACTION_ROUND_TRIPS = ['execute', 'batch', 'executeMultiple', 'commit', 'rollback'];

/**
 * Methods that take the writer. Single `execute` calls are left out: they are
 * atomic and short, and busy_timeout already retries them.
 */
const NEEDS_WRITER = ['batch', 'executeMultiple', 'migrate', 'transaction'];

/** Frees a stuck writer rather than hanging the server if a transaction leaks. */
const WRITER_TIMEOUT_MS = 15_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let writerQueue: Promise<unknown> = Promise.resolve();

/** Resolves when this caller owns the writer; call the result to hand it on. */
function acquireWriter(): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, WRITER_TIMEOUT_MS);
    release = () => {
      clearTimeout(timer);
      resolve();
    };
  });

  const ourTurn = writerQueue;
  writerQueue = writerQueue.then(() => held);
  return ourTurn.then(() => release);
}

function chargePerRoundTrip<T extends object>(target: T, ms: number, methods: string[]): T {
  return new Proxy(target, {
    get(obj, prop) {
      const value = Reflect.get(obj, prop) as unknown;
      if (typeof value !== 'function') return value;
      const fn = value as (...args: unknown[]) => unknown;
      if (!methods.includes(prop as string)) return fn.bind(obj);

      return async (...args: unknown[]) => {
        const release = NEEDS_WRITER.includes(prop as string) ? await acquireWriter() : null;
        let handedOver = false;
        try {
          await sleep(ms);
          const result = await fn.apply(obj, args);
          if (prop !== 'transaction') return result;

          // The writer stays held for the life of the transaction: an
          // interactive transaction pays the latency again for every statement
          // and for the commit, which is the whole reason to prefer db.batch()
          // where statements don't depend on each other's results.
          handedOver = true;
          return wrapTransaction(result as Transaction, ms, release!);
        } finally {
          if (!handedOver) release?.();
        }
      };
    },
  }) as T;
}

function wrapTransaction(transaction: Transaction, ms: number, release: () => void): Transaction {
  const charged = chargePerRoundTrip(transaction, ms, TRANSACTION_ROUND_TRIPS);
  return new Proxy(charged, {
    get(obj, prop) {
      const value = Reflect.get(obj, prop) as unknown;
      if (typeof value !== 'function') return value;
      if (prop !== 'commit' && prop !== 'rollback' && prop !== 'close') return value;

      const fn = value as (...args: unknown[]) => unknown;
      return async (...args: unknown[]) => {
        try {
          return await fn.apply(obj, args);
        } finally {
          release();
        }
      };
    },
  }) as Transaction;
}
