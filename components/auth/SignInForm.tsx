"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth";

type Mode = "signin" | "signup" | "reset";

const INPUT =
  "w-full rounded-xl border border-surface-raised bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none";

/**
 * Password auth (magic link is off to avoid Supabase's email rate limit).
 *
 * Sign-up is invite-only for the friends beta (0017_beta_allowlist.sql —
 * no ToS/legal layer exists yet, see PRODUCTION-PLAN.md). Must also be
 * enabled in the Supabase dashboard (Auth → Providers → Email → "Allow new
 * users to sign up"), which this code has no control over; the allowlist is
 * the actual gate on top of that.
 *
 * is_email_beta_invited() is checked BEFORE calling signUp() so an
 * uninvited email gets one clear sentence instead of whatever opaque
 * "Database error saving new user" GoTrue returns when the real enforcement
 * — a BEFORE INSERT trigger on auth.users — rejects the insert. That trigger
 * is what actually stops a bypass of this pre-check, not this code.
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

    if (mode === "signup") {
      if (password.length < MIN_PASSWORD_LENGTH)
        return fail(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);

      const { data: invited, error: checkError } = await supabase.rpc("is_email_beta_invited", {
        check_email: email,
      });
      // A failed pre-check (network blip, etc.) doesn't block a genuinely
      // invited friend — fall through to the real signUp attempt, which the
      // DB trigger enforces regardless of what this check said.
      if (!checkError && invited === false) {
        return fail("Performance Hub is invite-only right now — ask Ram to add your email.");
      }

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        // Only show the invite-only message when the pre-check positively
        // said "not invited" (invited === false, checkError absent) — that's
        // the one case we actually know is the beta gate. A checkError alone
        // means we don't know why signUp failed, so the real error.message
        // (already registered, rate limited, ...) is what's actually useful;
        // masking it here was a bug — it hid a friend's real problem behind
        // a wrong "ask Ram" message.
        return fail(invited === false && !checkError ? "Performance Hub is invite-only right now — ask Ram to add your email." : error.message);
      }
      if (!data.session) {
        setStatus("sent");
        setMessage("Check your email to confirm your account.");
        return;
      }
      router.push("/dashboard");
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
          // No minLength on sign-in: a minimum belongs on the screens that
          // *create* a password, and enforcing it here would lock out an
          // account whose existing password predates the rule. Sign-up does
          // enforce it, since that's where the password is created.
          minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          placeholder={mode === "signup" ? `password (min ${MIN_PASSWORD_LENGTH} characters)` : "password"}
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
        {status === "loading"
          ? "Working…"
          : mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : "Send reset link"}
      </button>

      <div className="flex items-center justify-between text-xs">
        {mode === "signin" && (
          <>
            <button type="button" onClick={() => setMode("signup")} className="text-accent">
              Create account
            </button>
            <button type="button" onClick={() => setMode("reset")} className="text-muted hover:text-fg">
              Forgot password
            </button>
          </>
        )}
        {mode !== "signin" && (
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
