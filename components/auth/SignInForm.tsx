"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Magic-link auth per CLAUDE.md / Phase 0 acceptance criteria.
export function SignInForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-neutral-600">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-base"
      />
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-white disabled:opacity-50"
      >
        {status === "sending" ? "Sending..." : "Send magic link"}
      </button>
      {status === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}
    </form>
  );
}
