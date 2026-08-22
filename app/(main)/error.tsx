"use client";

/**
 * Catches render/data errors inside the signed-in app. The layout — tab bar,
 * navigation — survives, so this is a recoverable dead end rather than a
 * white screen: you can retry, or leave for a tab that works.
 */
export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-[family-name:var(--font-space-grotesk)] text-lg text-fg">
        This screen hit an error
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-muted">
        Nothing you logged has been lost — anything saved on this device is still queued and will
        upload once this screen recovers.
      </p>

      <button
        type="button"
        onClick={reset}
        className="mt-1 w-full max-w-xs rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-[0.985]"
      >
        Try again
      </button>
      <a href="/dashboard" className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
        Back to dashboard
      </a>

      {/* The digest is the only handle on a production error whose message has
          been stripped by the build. Worth showing when there's no Sentry. */}
      {error.digest && <p className="mt-2 font-mono text-[11px] text-muted/60">ref {error.digest}</p>}
    </main>
  );
}
