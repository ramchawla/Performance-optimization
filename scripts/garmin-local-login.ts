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

// Same CJS-interop caution as the edge function: garmin-connect's
// `module.exports = { GarminConnect, ... }` shape resolves fine under
// Node's CJS/ESM interop (unlike Deno's npm: specifier), but keeping the
// fallback defensive costs nothing.
const pkg = await import("garmin-connect");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GarminConnect = (pkg as any).GarminConnect ?? (pkg as any).default?.GarminConnect;

async function prompt(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  if (!hidden) {
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
  }
  // Minimal masked input — good enough for a one-off local script, not a
  // full terminal UI library for one prompt.
  return new Promise((resolve) => {
    stdout.write(question);
    const onData = (char: Buffer) => {
      const c = char.toString("utf8");
      if (c === "\n" || c === "\r" || c === "") {
        stdin.setRawMode?.(false);
        stdin.removeListener("data", onData);
        stdout.write("\n");
        rl.close();
        resolve(password);
      } else if (c === "") {
        process.exit(1);
      } else if (c === "") {
        password = password.slice(0, -1);
      } else {
        password += c;
      }
    };
    let password = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main() {
  const email = await prompt("Garmin email: ");
  const password = await prompt("Garmin password: ", true);

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
