"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// ponytail: password auth swapped in temporarily to skip Supabase's magic-link
// email rate limit during dev/testing. Revert to magic-link (git history) before
// any real user-facing launch.
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);

    const supabase = createClient();
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setStatus("error");
        setErrorMsg(signUpError.message);
        return;
      }
      if (!signUpData.session) {
        setStatus("error");
        setErrorMsg(
          "Account created but not signed in — Supabase has \"Confirm email\" on. Turn it off in Authentication > Providers > Email, then try again."
        );
        return;
      }
    } else if (!signInData.session) {
      setStatus("error");
      setErrorMsg("Signed in but no session returned — check Supabase auth settings.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-xl border border-surface-raised bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <input
        type="password"
        required
        minLength={6}
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-xl border border-surface-raised bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
      >
        {status === "loading" ? "Signing in..." : "Sign in / create account"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-400">{errorMsg}</p>
      )}
    </form>
  );
}
