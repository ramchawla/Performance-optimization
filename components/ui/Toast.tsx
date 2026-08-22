"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Toasts — CLAUDE.md rule 7 ("toast + preserved input for user actions").
 *
 * No dependency: a list, a context and a timer is the whole feature, and a
 * toast library would be more configuration surface than code (rule 9).
 *
 * Deliberately does NOT own the "preserved input" half of that rule. Clearing
 * a form is the form's decision, so the pattern is: don't reset on error, and
 * call `toast.error()` to say why. A toast component that also managed form
 * state would have to know about every form in the app.
 */

export type ToastKind = "error" | "success" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional retry — the useful thing to offer when a write fails. */
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  error: (message: string, action?: Toast["action"]) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

/**
 * Escape hatch for code that isn't a component and so can't call the hook —
 * specifically the QueryClient's MutationCache, which is constructed before
 * this provider mounts. That one registration is what makes every failed write
 * in the app surface a toast without touching a single mutation call site.
 *
 * No-op before mount, which only matters for a failure during the first paint.
 */
let sink: ToastApi | null = null;

export function notifyError(message: string, action?: Toast["action"]): void {
  sink?.error(message, action);
}

// Errors stay until dismissed. An error that vanishes after four seconds is an
// error the user can miss entirely, and rule 7 exists so failures are seen.
const DURATION: Record<ToastKind, number | null> = {
  error: null,
  success: 3_000,
  info: 4_000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string, action?: Toast["action"]) => {
      const id = nextId.current++;
      setToasts((current) => {
        // Repeated identical failures (a retrying sync, a mistyped field
        // resubmitted) should not build a wall of the same message.
        const deduped = current.filter((t) => !(t.kind === kind && t.message === message));
        return [...deduped, { id, kind, message, action }].slice(-3);
      });

      const ms = DURATION[kind];
      if (ms !== null) setTimeout(() => dismiss(id), ms);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      error: (message, action) => push("error", message, action),
      success: (message) => push("success", message),
      info: (message) => push("info", message),
      dismiss,
    }),
    [push, dismiss]
  );

  // In an effect, not during render: assigning module state while rendering is
  // a side effect React is allowed to discard or replay.
  useEffect(() => {
    sink = api;
    return () => {
      if (sink === api) sink = null;
    };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        // polite, not assertive: a screen reader shouldn't be cut off
        // mid-sentence by a background sync succeeding.
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_STYLE: Record<ToastKind, string> = {
  error: "border-red-900/60 bg-red-950/90 text-red-100",
  success: "border-accent/40 bg-surface/95 text-fg",
  info: "border-surface-raised bg-surface/95 text-fg",
};

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  return (
    <div
      role={toast.kind === "error" ? "alert" : "status"}
      className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-3.5 py-3 text-sm shadow-lg backdrop-blur ${KIND_STYLE[toast.kind]}`}
    >
      <span className="flex-1 leading-snug">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="shrink-0 font-semibold text-accent underline-offset-2 hover:underline"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-lg leading-none opacity-60 transition-opacity hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
