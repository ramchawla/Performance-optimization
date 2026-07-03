import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database.types";

/**
 * Server-Component / Route-Handler / Server-Action Supabase client.
 * Still uses the anon key + the user's session cookie — RLS still applies.
 * This is NOT the service-role client; see service.ts for that.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no writable cookie store
            // (e.g. during static rendering) — middleware.ts refreshes the
            // session instead, so this is safe to ignore.
          }
        },
      },
    }
  );
}
