/**
 * Run once, after Phase 0 Supabase setup is complete:
 *   npx tsx scripts/seed-exercises.ts
 *
 * Requires env vars (see .env.example):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (service role — bypasses RLS to insert
 *                                 system rows with user_id = null)
 */
import { createClient } from "@supabase/supabase-js";
import { SEED_EXERCISES } from "../data/seed-exercises";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local first."
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function main() {
  const rows = SEED_EXERCISES.map((e) => ({
    user_id: null,
    name: e.name,
    muscle_groups: e.muscleGroups,
    equipment: e.equipment,
    is_unilateral: e.isUnilateral ?? false,
    default_rest_seconds: e.defaultRestSeconds ?? 150,
  }));

  const { data, error } = await supabase
    .from("exercises")
    .upsert(rows, { onConflict: "user_id,name" })
    .select("id");

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`Seeded/updated ${data?.length ?? 0} exercises.`);
}

main();
