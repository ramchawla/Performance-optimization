import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

export type BetaInvite = Database["public"]["Tables"]["beta_allowlist"]["Row"];

/**
 * Whether the signed-in user can manage the beta allowlist. Backed by
 * is_app_owner() (0017), a SECURITY DEFINER RPC — app_owners itself has no
 * RLS policies at all, so this is the only way to read ownership, and it's
 * impossible to fake from the client.
 */
export function useIsAppOwner() {
  return useQuery({
    queryKey: ["is-app-owner"],
    queryFn: async (): Promise<boolean> => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_app_owner");
      if (error) throw error;
      return data ?? false;
    },
  });
}

/**
 * Owner-only (RLS: "owners manage" policy on beta_allowlist, 0017). Pass
 * `enabled: false` while ownership is still loading/false — RLS would return
 * zero rows for anyone else regardless, but there's no reason to make the
 * round trip on every /settings visit from every non-owner.
 */
export function useBetaAllowlist(enabled = true) {
  return useQuery({
    queryKey: ["beta-allowlist"],
    queryFn: async (): Promise<BetaInvite[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("beta_allowlist")
        .select("*")
        .order("invited_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled,
  });
}

export function useAddBetaInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; note?: string }) => {
      const supabase = createClient();
      // getSession() reads the already-held local session — no network round
      // trip — same choice as useDeleteAccount below. RLS (is_app_owner()) is
      // what actually authorizes this write; invited_by is just attribution,
      // not a security check, so getUser()'s extra server re-validation
      // bought nothing here but latency on every keystroke-adjacent click.
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) throw new Error("Not signed in");
      // The email = lower(email) check constraint enforces this server-side too.
      const { error } = await supabase.from("beta_allowlist").insert({
        email: input.email.trim().toLowerCase(),
        invited_by: userId,
        note: input.note?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beta-allowlist"] }),
  });
}

export function useRemoveBetaInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("beta_allowlist").delete().eq("email", email);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beta-allowlist"] }),
  });
}

/**
 * Permanently deletes the caller's own account: photos, then the auth user
 * (which cascades every other row — see supabase/functions/delete-account).
 * There is no undo; the confirm-by-typing-DELETE gate lives in the UI.
 *
 * qc.clear() + the caller doing a hard navigation (not router.push) afterward
 * is deliberate: TanStack Query cache is keyed by query name only (e.g.
 * ["dashboard"]), not by user id. On a shared device, a client-side route
 * change alone would leave the deleted user's cached data sitting in memory
 * for whoever signs in next, until each query happened to refetch.
 */
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Not signed in");

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? `Delete failed (${res.status})`);
      await supabase.auth.signOut();
      qc.clear();
    },
  });
}
