// Supabase Edge Function: food-search
// STATUS: stub — full implementation is Phase 2 (see PHASE-PLAN.md).
// Design locked in TECHNICAL-DESIGN.md §5:
//   - Proxies USDA FoodData Central so the API key stays server-side
//   - Prefer dataType=Foundation,SR Legacy for whole foods; Branded for
//     packaged foods
//   - Normalize the response with Zod before returning to the client
//   - Caller is responsible for local-first search (own foods/recipes) —
//     this function is only tier 3 of the three-tier search strategy
//
// Requires USDA_API_KEY as a Supabase Edge Function secret (free key from
// api.data.gov) before this can be implemented.

Deno.serve(async () => {
  return new Response(
    JSON.stringify({ status: "not_implemented", phase: 2, seeDoc: "TECHNICAL-DESIGN.md §5" }),
    { status: 501, headers: { "Content-Type": "application/json" } }
  );
});
