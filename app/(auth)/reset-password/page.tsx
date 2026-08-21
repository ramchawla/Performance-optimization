"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

/**
 * Landing page for the emailed recovery link. Supabase establishes a session
 * from the link's token before this renders, so updateUser() is all that's
 * needed — there's no old password to supply.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH)
      return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== confirm) return setError("Those don't match.");

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updateError) {
      setError(
        `${updateError.message}. If the link has expired, request a new one from the sign-in page.`
      );
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 1200);
  }

  const inputCls =
    "w-full rounded-xl border border-surface-raised bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="font-display text-2xl font-bold text-fg">Set a new password</h1>

        {done ? (
          <p className="text-sm text-accent">Password updated. Taking you to the dashboard…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              placeholder="New password"
              aria-label="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            <input
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              placeholder="Confirm new password"
              aria-label="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "Saving…" : "Update password"}
            </button>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Link href="/sign-in" className="block text-center text-xs text-muted hover:text-fg">
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
