"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "reset";

const INPUT =
  "w-full rounded-xl border border-surface-raised bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none";

/**
 * Password auth (magic link is off to avoid Supabase's email rate limit).
 *
 * There is no sign-up path: this is a single-user app and public sign-up is
 * disabled in Supabase. Rendering a "Create account" button that the server
 * will always reject is worse than not rendering it. Adding a second user
 * means creating them in the Supabase dashboard.
 */
export function SignInForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "sent">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function fail(text: string) {
    setStatus("error");
    setMessage(text);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage(null);
    const supabase = createClient();

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) return fail(error.message);
      setStatus("sent");
      setMessage("Check your email for a reset link.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Supabase deliberately returns the same message for a wrong password
      // and an unknown email, so don't imply which one it was.
      return fail(`${error.message}. Check the email and password.`);
    }
    if (!data.session) return fail("Signed in but no session returned — check Supabase auth settings.");
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={INPUT}
      />

      {mode !== "reset" && (
        <input
          type="password"
          required
          // No minLength here on purpose — a minimum belongs on the screens
          // that *create* a password. Enforcing it at sign-in would lock out
          // an account whose existing password predates the rule.
          autoComplete="current-password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT}
        />
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        {status === "loading" ? "Working…" : mode === "signin" ? "Sign in" : "Send reset link"}
      </button>

      <div className="text-xs">
        {mode === "signin" ? (
          <button type="button" onClick={() => setMode("reset")} className="text-muted hover:text-fg">
            Forgot password
          </button>
        ) : (
          <button type="button" onClick={() => setMode("signin")} className="text-accent">
            Back to sign in
          </button>
        )}
      </div>

      {message && (
        <p className={`text-sm ${status === "error" ? "text-red-400" : "text-accent"}`}>{message}</p>
      )}
    </form>
  );
}
