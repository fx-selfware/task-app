import type { Client, Transaction } from '@libsql/client';

/**
 * Wraps the libsql client so tests can see and feel what production pays:
 * one network round trip to Turso per statement.
 *
 * - `onRoundTrip` counts them, which `features/api/round-trips.feature` asserts
 *   budgets against so an N+1 or an unbatched read can't creep back in.
 * - `delayMs` charges each one a delay, which makes a local `file:` database
 *   behave like a remote one for the latency benchmark (tests/perf).
 *
 * Either way the shape is the same: `db.batch([a, b, c])` is one round trip,
 * while an interactive `db.transaction()` is BEGIN + one per statement +
 * COMMIT. Both hooks are off unless the corresponding env var is set, so
 * nothing here runs in production.
 */
export interface InstrumentOptions {
  /** Delay charged per round trip, simulating a remote database. */
  delayMs?: number;
  /** Called once per round trip, before it is issued. */
  onRoundTrip?: () => void;
}

export function instrumentClient(client: Client, options: InstrumentOptions): Client {
  const state: State = {
    delayMs: options.delayMs ?? 0,
    onRoundTrip: options.onRoundTrip,
    // Only simulated latency holds locks long enough for writes to collide.
    serializeWrites: (options.delayMs ?? 0) > 0,
  };
  return wrap(client, state, CLIENT_ROUND_TRIPS);
}

interface State {
  delayMs: number;
  onRoundTrip?: () => void;
  serializeWrites: boolean;
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

/**
 * Turso takes a single writer and queues the rest; local SQLite instead fails
 * the loser of a race with SQLITE_BUSY_SNAPSHOT, which busy_timeout does not
 * retry. Holding a write transaction open for a simulated round trip turns any
 * burst of concurrent writes into 500s that exist nowhere but this harness, so
 * the queue models the remote behaviour.
 */
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

function wrap<T extends object>(target: T, state: State, methods: string[]): T {
  return new Proxy(target, {
    get(obj, prop) {
      const value = Reflect.get(obj, prop) as unknown;
      if (typeof value !== 'function') return value;
      const fn = value as (...args: unknown[]) => unknown;
      if (!methods.includes(prop as string)) return fn.bind(obj);

      return async (...args: unknown[]) => {
        const takesWriter = state.serializeWrites && NEEDS_WRITER.includes(prop as string);
        const release = takesWriter ? await acquireWriter() : null;
        let handedOver = false;
        try {
          state.onRoundTrip?.();
          if (state.delayMs > 0) await sleep(state.delayMs);
          const result = await fn.apply(obj, args);
          if (prop !== 'transaction') return result;

          // The writer stays held for the life of the transaction: an
          // interactive transaction pays for every statement and for the
          // commit, which is the whole reason to prefer db.batch() where
          // statements don't depend on each other's results.
          handedOver = true;
          return wrapTransaction(result as Transaction, state, release);
        } finally {
          if (!handedOver) release?.();
        }
      };
    },
  }) as T;
}

function wrapTransaction(transaction: Transaction, state: State, release: (() => void) | null): Transaction {
  const counted = wrap(transaction, state, TRANSACTION_ROUND_TRIPS);
  if (!release) return counted;

  return new Proxy(counted, {
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
