"use client";

/**
 * Last resort: the root layout itself failed, so nothing above this rendered —
 * no fonts, no providers, no Tailwind guarantee. That's why this file ships its
 * own <html>/<body> and inline styles instead of using the design system.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
          background: "#0a0b0d",
          color: "#f4f5f0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.125rem", margin: 0 }}>Performance Hub failed to load</h1>
        <p style={{ maxWidth: "20rem", fontSize: "0.875rem", lineHeight: 1.6, color: "#8a8f98" }}>
          Your data is safe on the server. This is a problem with the app shell, not your logs.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "0.625rem 1.25rem",
            borderRadius: "0.75rem",
            border: "none",
            background: "#c6ff3d",
            color: "#0a0b0d",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          Reload
        </button>
        {error.digest && (
          <p style={{ fontFamily: "monospace", fontSize: "0.6875rem", color: "#8a8f9880" }}>
            ref {error.digest}
          </p>
        )}
      </body>
    </html>
  );
}
