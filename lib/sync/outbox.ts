/**
 * IndexedDB outbox — TECHNICAL-DESIGN.md §3. Pure client-side, no Supabase
 * connection needed to build/test this. Only the offline-writable tables
 * listed there may be queued here.
 */

export type OutboxTable =
  | "workout_sessions"
  | "session_exercises"
  | "session_sets"
  | "body_metrics"
  | "mobility_logs"
  | "soreness_logs"
  | "nutrition_logs";

export type OutboxOp = "upsert" | "delete";

export interface OutboxEntry {
  mutationId: string;
  table: OutboxTable;
  op: OutboxOp;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

const DB_NAME = "performance-hub-outbox";
const DB_VERSION = 1;
const STORE_NAME = "outbox";

// Parent-before-child ordering per TECHNICAL-DESIGN §3 — drain must respect this.
export const TABLE_PRIORITY: Record<OutboxTable, number> = {
  workout_sessions: 0,
  session_exercises: 1,
  session_sets: 2,
  body_metrics: 0,
  mobility_logs: 0,
  soreness_logs: 0,
  nutrition_logs: 0,
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "mutationId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = fn(tx.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function enqueue(
  table: OutboxTable,
  op: OutboxOp,
  payload: Record<string, unknown>
): Promise<OutboxEntry> {
  const entry: OutboxEntry = {
    mutationId: crypto.randomUUID(),
    table,
    op,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await withStore("readwrite", (store) => store.add(entry));
  return entry;
}

/** FIFO by createdAt, sorted parent-before-child within equal timestamps. */
export async function listPending(): Promise<OutboxEntry[]> {
  const entries = await withStore<OutboxEntry[]>("readonly", (store) => store.getAll());
  return entries.sort((a, b) => {
    const created = a.createdAt.localeCompare(b.createdAt);
    if (created !== 0) return created;
    return TABLE_PRIORITY[a.table] - TABLE_PRIORITY[b.table];
  });
}

export async function remove(mutationId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(mutationId));
}

export async function incrementAttempts(mutationId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(mutationId);
    getRequest.onsuccess = () => {
      const entry = getRequest.result as OutboxEntry | undefined;
      if (entry) {
        entry.attempts += 1;
        store.put(entry);
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function count(): Promise<number> {
  return withStore<number>("readonly", (store) => store.count());
}
