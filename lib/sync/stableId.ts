/**
 * Deterministic client_ids for the one-row-per-day tables (sleep_logs,
 * readiness_logs).
 *
 * Append-only tables get a fresh `crypto.randomUUID()` per row and that's the
 * end of it. The daily tables can't: they already carry a unique constraint on
 * (user_id, log_date), so if editing the same day twice produced two different
 * client_ids the second write would insert-conflict on the day and never
 * succeed, no matter how many times the outbox retried it. Deriving the id
 * from (user_id, log_date) makes the second edit an update of the first.
 *
 * RFC 4122 v5 specifically, not an ad-hoc SHA-256 truncation, because
 * migration 0006 has to compute the same values in SQL via uuid_generate_v5 to
 * backfill rows written before the outbox covered these tables.
 */

/** Must match the namespace literal in supabase/migrations/0006. Never change it. */
const NAMESPACE = "6f5b8c1e-3d2a-4f7b-9c48-5a1e2d3b4c5f";

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * RFC 4122 §4.3 name-based UUID, SHA-1 variant. The namespace is overridable
 * only so the test can check this against the published DNS-namespace vectors
 * — that check is what proves it agrees with Postgres's uuid_generate_v5.
 */
export async function uuidV5(name: string, namespace: string = NAMESPACE): Promise<string> {
  const nameBytes = new TextEncoder().encode(name);
  const input = new Uint8Array(16 + nameBytes.length);
  input.set(uuidToBytes(namespace), 0);
  input.set(nameBytes, 16);

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  const out = digest.slice(0, 16);
  out[6] = (out[6] & 0x0f) | 0x50; // version 5
  out[8] = (out[8] & 0x3f) | 0x80; // RFC 4122 variant
  return bytesToUuid(out);
}

/** The stable client_id for a user's row on a given day. */
export function dailyClientId(userId: string, logDate: string): Promise<string> {
  return uuidV5(`${userId}:${logDate}`);
}
