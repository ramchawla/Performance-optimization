import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/**
 * True when the user prefers reduced motion. CSS handles most of the app's
 * motion via `@media (prefers-reduced-motion: reduce)` in globals.css, but
 * Recharts animates via JS (react-smooth), which that media query can't
 * reach — components pass this to `isAnimationActive` to gate it.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
