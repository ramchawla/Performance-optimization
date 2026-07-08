/**
 * Drains the outbox — TECHNICAL-DESIGN.md §3. Triggers: online event, every
 * 30s while a session is active, and on-demand. Backoff per entry: 2s, 8s,
 * 30s, then park (stop retrying, keep it queued, surface the badge).
 * Server writer is injected so this stays testable without a live Supabase
 * connection — pass a fake writer in tests, the real upsert client in app code.
 */
import { listPending, remove, incrementAttempts, type OutboxEntry } from "./outbox";

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
 * Wires up the online-event + 30s-interval triggers. Call `stop()` on
 * session end / unmount. `intervalMs` overridable for tests.
 */
export function startSyncWorker(writeToServer: OutboxWriter, intervalMs = 30_000): SyncWorkerHandle {
  const run = () => {
    void drainOutbox(writeToServer);
  };

  const onlineHandler = () => run();
  window.addEventListener("online", onlineHandler);
  const interval = setInterval(run, intervalMs);
  run();

  return {
    stop: () => {
      window.removeEventListener("online", onlineHandler);
      clearInterval(interval);
    },
  };
}
