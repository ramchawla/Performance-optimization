/**
 * Drains the outbox — TECHNICAL-DESIGN.md §3. Triggers: online event, every
 * 30s while a session is active, and on-demand. Backoff per entry: 2s, 8s,
 * 30s, then park (stop retrying, keep it queued, surface the badge).
 * Server writer is injected so this stays testable without a live Supabase
 * connection — pass a fake writer in tests, the real upsert client in app code.
 */
import {
  enqueue,
  listPending,
  remove,
  incrementAttempts,
  type OutboxEntry,
  type OutboxOp,
  type OutboxTable,
} from "./outbox";

const BACKOFF_MS = [2_000, 8_000, 30_000];
const PARKED_AFTER_ATTEMPTS = BACKOFF_MS.length;

export type OutboxWriter = (entry: OutboxEntry) => Promise<{ ok: boolean }>;

export interface DrainResult {
  synced: number;
  parked: number;
  remaining: number;
}

/** Parked entries (attempts >= PARKED_AFTER_ATTEMPTS) are skipped until manually retried. */
export async function drainOutbox(writeToServer: OutboxWriter): Promise<DrainResult> {
  const pending = await listPending();
  let synced = 0;
  let parked = 0;

  for (const entry of pending) {
    if (entry.attempts >= PARKED_AFTER_ATTEMPTS) {
      parked += 1;
      continue;
    }

    const result = await writeToServer(entry);
    if (result.ok) {
      await remove(entry.mutationId);
      synced += 1;
    } else {
      await incrementAttempts(entry.mutationId);
      if (entry.attempts + 1 >= PARKED_AFTER_ATTEMPTS) parked += 1;
    }
  }

  const remaining = pending.length - synced;
  return { synced, parked, remaining };
}

export function nextBackoffMs(attempts: number): number | null {
  return attempts < BACKOFF_MS.length ? BACKOFF_MS[attempts] : null;
}

export interface SyncWorkerHandle {
  stop: () => void;
}

/**
 * On-demand drain, for the moment right after a mutation enqueues something.
 *
 * Without it, a queued write waits out the 30s interval before it reaches the
 * server, and every list on screen is read back *from* the server — so a
 * one-tap action like logging a glass of water would appear to do nothing for
 * half a minute. Registered by the sync worker rather than imported directly
 * so that query modules don't each have to construct a Supabase writer.
 *
 * No-op before the worker mounts, and deliberately fire-and-forget: the
 * interval and the online event are still the guarantees. This is only latency.
 */
let activeDrain: (() => Promise<void>) | null = null;

export function syncNow(): Promise<void> {
  return activeDrain?.() ?? Promise.resolve();
}

/**
 * What every offline-writable mutation should call. Queues locally first so
 * the write survives a dead connection, then drains immediately.
 *
 * The drain is awaited, not fired and forgotten, and that matters: callers
 * invalidate their queries as soon as this resolves, and those queries read
 * from the server. Returning early would refetch before the row had been
 * written and paint the *old* data over a save the user just made.
 *
 * Offline this still resolves — the write fails, the entry stays queued, and
 * the interval/online triggers pick it up later. The mutation is deliberately
 * reported as successful, because the data is safe on the device: that is the
 * entire point of the outbox.
 */
export async function enqueueAndSync(
  table: OutboxTable,
  op: OutboxOp,
  payload: Record<string, unknown>
) {
  const entry = await enqueue(table, op, payload);
  await syncNow();
  return entry;
}

/**
 * Wires up the online-event + 30s-interval triggers. Call `stop()` on
 * session end / unmount. `intervalMs` overridable for tests.
 */
export function startSyncWorker(writeToServer: OutboxWriter, intervalMs = 30_000): SyncWorkerHandle {
  // Never rejects: a drain failure is an expected offline outcome, and an
  // unhandled rejection here would surface as a mutation error for a write
  // that is safely queued.
  const run = () => drainOutbox(writeToServer).then(() => undefined, () => undefined);

  const onlineHandler = () => void run();
  window.addEventListener("online", onlineHandler);
  const interval = setInterval(run, intervalMs);
  activeDrain = run;
  run();

  return {
    stop: () => {
      window.removeEventListener("online", onlineHandler);
      clearInterval(interval);
      if (activeDrain === run) activeDrain = null;
    },
  };
}
