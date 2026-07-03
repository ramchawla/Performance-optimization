import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

/**
 * Client-Component Supabase client. Uses the anon key — RLS is the only
 * authorization boundary here (see CLAUDE.md rule 4). Never import this
 * from a server-only file.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
