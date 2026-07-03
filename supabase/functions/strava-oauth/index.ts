// Supabase Edge Function: strava-oauth
// STATUS: stub — full implementation is Phase 4 (see PHASE-PLAN.md).
// Design is already locked in TECHNICAL-DESIGN.md §7:
//   - OAuth2 code flow, tokens stored in integration_accounts
//   - ALWAYS check expires_at and refresh before calling the Strava API
//     (Strava access tokens expire every 6 hours)
//   - Read-only for v1 (poll GET /athlete/activities on a "Sync now" button);
//     writing our runs back to Strava is deferred to P2
//   - Respect 429 with backoff even though personal-scale usage won't hit
//     Strava's rate limits (100/15min, 1000/day)
//
// Do not build this out ahead of Phase 4 — nutrition/training/health ingest
// are higher priority and this needs a registered Strava API application
// (client id/secret) as a prerequisite anyway.

Deno.serve(async () => {
  return new Response(
    JSON.stringify({ status: "not_implemented", phase: 4, seeDoc: "TECHNICAL-DESIGN.md §7" }),
    { status: 501, headers: { "Content-Type": "application/json" } }
  );
});
