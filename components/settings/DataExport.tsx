"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { collectExport, exportFilename, totalRows } from "@/lib/export/collect";

/**
 * Supabase's free tier keeps 7 days of daily backups, has no point-in-time
 * recovery, and does not back up Storage at all. This download is therefore
 * the real backup, not a convenience feature — so it tracks when it last ran
 * and says so when that was a while ago.
 */
const LAST_EXPORT_KEY = "perfhub:last-export";
const STALE_DAYS = 30;

function lastExport(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_EXPORT_KEY);
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function DataExport() {
  // Read once on mount rather than during render — localStorage doesn't exist
  // during the server render and would make this component non-hydratable.
  const [last, setLast] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (!mounted) {
    setMounted(true);
    setLast(lastExport());
  }

  async function handleExport() {
    setState("working");
    setMessage(null);
    try {
      const supabase = createClient();
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Not signed in");

      const bundle = await collectExport(supabase, userData.user.id);

      const url = URL.createObjectURL(
        new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFilename(bundle);
      a.click();
      URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      localStorage.setItem(LAST_EXPORT_KEY, now);
      setLast(now);
      setState("idle");

      // A partial export must say so. A backup you wrongly believe is complete
      // is worse than no backup, because you stop taking others.
      setMessage(
        bundle.errors.length
          ? `Downloaded ${totalRows(bundle)} rows, but ${bundle.errors.length} table(s) failed: ${bundle.errors
              .map((e) => e.table)
              .join(", ")}. Try again.`
          : `Downloaded ${totalRows(bundle)} rows.`
      );
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Export failed.");
    }
  }

  const age = last ? daysSince(last) : null;
  const stale = age === null || age >= STALE_DAYS;

  return (
    <div className="p-4">
      <p className="text-sm text-fg">Download everything</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        One JSON file with every log, session, meal and measurement. Supabase&apos;s free plan keeps
        only 7 days of backups and never backs up photos, so this file is your actual safety net —
        keep it somewhere off this machine.
      </p>

      <button
        type="button"
        onClick={handleExport}
        disabled={state === "working"}
        className="mt-3 w-full rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-[0.985] disabled:opacity-50"
      >
        {state === "working" ? "Collecting…" : "Export my data"}
      </button>

      {mounted && (
        <p className={`mt-2 text-xs ${stale ? "text-amber-400" : "text-muted"}`}>
          {age === null
            ? "Never exported from this device."
            : age === 0
              ? "Last export: today."
              : `Last export: ${age} day${age === 1 ? "" : "s"} ago.${stale ? " Worth doing again." : ""}`}
        </p>
      )}

      {message && (
        <p className={`mt-2 text-xs ${state === "error" ? "text-red-400" : "text-muted"}`}>{message}</p>
      )}

      {/* ponytail: progress photos are Storage objects, not rows, so they are
          not in this file. Backing them up needs a scheduled job that copies
          the bucket somewhere else — see PRODUCTION-PLAN DATA-2. */}
      <p className="mt-3 border-t border-surface-raised pt-3 text-[11px] leading-relaxed text-muted/70">
        Progress photos aren&apos;t included — they live in file storage, not the database. Save
        those from your phone separately for now.
      </p>
    </div>
  );
}
