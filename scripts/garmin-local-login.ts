/**
 * Run locally, on your home network — NOT deployed anywhere, NOT called by
 * the app. Exists because Garmin's OAuth token-exchange endpoint
 * (/oauth-service/oauth/preauthorized) 429s when hit from Supabase's edge
 * function IPs but works fine from a home connection (confirmed by hand,
 * 2026-09-24) — this does the one-time login from an IP that isn't blocked,
 * so the app never has to touch that endpoint itself. Ongoing syncs use the
 * resulting tokens directly (loadToken(), not login()) and don't hit the
 * blocked endpoint at all — see TECHNICAL-DESIGN.md §7b.
 *
 * Usage:
 *   npx tsx scripts/garmin-local-login.ts
 *   (prompts for email/password — nothing is stored, this process just
 *   prints the resulting token pair as JSON)
 *
 * Then paste the printed JSON into Settings → Garmin → "Already have
 * session tokens?" in the app, once. Ordinary "Connect" (username/password
 * from the app itself) still goes through Supabase and will keep 429ing
 * until/unless that IP gets unblocked — this script is the workaround, not
 * a replacement for fixing that if it ever resolves.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
// A dynamic `await import(...)` here was a top-level await, which tsx
// transforms to CJS by default (no "type": "module" in package.json) and
// CJS output can't have top-level await. Static import avoids that — Node's
// CJS/ESM interop resolves garmin-connect's `module.exports = {GarminConnect}`
// shape fine here (unlike Deno's npm: specifier, which doesn't).
import { GarminConnect } from "garmin-connect";

async function main() {
  // One shared interface for both questions — a fresh createInterface() per
  // prompt() call lost the second answer entirely when stdin was piped
  // (verified by hand: exit 0, "Logging in..." never printed, second answer
  // came back empty). A single interface is also just the standard pattern.
  const rl = createInterface({ input: stdin, output: stdout });
  const email = (await rl.question("Garmin email: ")).trim();
  // Plain, visible input rather than a hand-rolled masked-input reader —
  // this runs on your own machine, and raw-mode terminal input handling is
  // easy to get subtly wrong (backspace, non-TTY input, platform quirks) for
  // a one-off script that's hard to test without a real interactive TTY.
  const password = (await rl.question("Garmin password (visible while typing): ")).trim();
  rl.close();

  const client = new GarminConnect({ username: email, password });
  console.error("Logging in...");
  await client.login();

  const oauth1Token = client.client.oauth1Token;
  const oauth2Token = client.client.oauth2Token;

  console.error("\nSuccess. Paste this into the app's Settings → Garmin → advanced token field:\n");
  console.log(JSON.stringify({ oauth1Token, oauth2Token }));
}

main().catch((err) => {
  console.error("\nLogin failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
