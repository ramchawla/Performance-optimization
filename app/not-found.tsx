import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">404</p>
      <h1 className="font-[family-name:var(--font-space-grotesk)] text-lg text-fg">
        No such screen
      </h1>
      <Link
        href="/dashboard"
        className="mt-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition hover:brightness-110 active:scale-[0.985]"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
