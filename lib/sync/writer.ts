/**
 * Real Supabase-backed OutboxWriter — plugs into syncWorker.ts. Upsert
 * onConflict client_id per TECHNICAL-DESIGN.md §3; drainOutbox already
 * processes entries in parent-before-child order, so this stays dumb.
 */
import { createClient } from "@/lib/supabase/client";
import type { OutboxWriter } from "./syncWorker";

export function createSupabaseWriter(): OutboxWriter {
  const supabase = createClient();

  return async (entry) => {
    if (entry.op === "delete") {
      const { error } = await supabase
        .from(entry.table)
        .delete()
        .eq("client_id", entry.payload.client_id as string);
      return { ok: !error };
    }

    const { error } = await supabase
      .from(entry.table)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- payload shape varies per outbox table
      .upsert(entry.payload as any, { onConflict: "client_id" });
    return { ok: !error };
  };
}
