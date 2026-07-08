"use client";

import { useEffect, useState } from "react";
import { count as outboxCount } from "@/lib/sync/outbox";
import { startSyncWorker } from "@/lib/sync/syncWorker";
import { createSupabaseWriter } from "@/lib/sync/writer";

/** Starts the sync worker for the app lifetime and shows an unsynced-changes badge. */
export function SyncStatus() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const handle = startSyncWorker(createSupabaseWriter());
    const poll = setInterval(() => {
      void outboxCount().then(setPending);
    }, 2000);
    void outboxCount().then(setPending);
    return () => {
      handle.stop();
      clearInterval(poll);
    };
  }, []);

  if (pending === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-100 px-3 py-1 text-center text-xs text-amber-900">
      {pending} unsynced change{pending === 1 ? "" : "s"} — will sync when online
    </div>
  );
}
