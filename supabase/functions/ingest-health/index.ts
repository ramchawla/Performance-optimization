// Supabase Edge Function: ingest-health
// Deploy with: supabase functions deploy ingest-health
// Point Health Auto Export's "Automation > REST API" export at this URL with
// header:  Authorization: Bearer <per-user webhook_secret from integration_accounts>
//
// Implements the normalization rules in TECHNICAL-DESIGN.md §4 verbatim.
// Do not "fix" the sleep wake-date attribution or the per-metric aggregation
// rule without updating that doc first — they're deliberate design choices,
// not defaults.

import { createClient } from "jsr:@supabase/supabase-js@2";

// ---- Metric mapping table (HAE name -> our metric_type + unit + transform) ----
type Aggregation = "latest" | "larger";

interface MetricRule {
  ourType: string;
  unit: string;
  aggregation: Aggregation;
  transform?: (v: number) => number;
}

const METRIC_MAP: Record<string, MetricRule> = {
  "sleep_analysis.asleep": {
    ourType: "sleep_duration_s",
    unit: "s",
    aggregation: "latest",
    transform: (hours) => hours * 3600,
  },
  heart_rate_variability: { ourType: "hrv_ms", unit: "ms", aggregation: "latest" },
  resting_heart_rate: { ourType: "resting_hr_bpm", unit: "bpm", aggregation: "latest" },
  step_count: { ourType: "steps", unit: "count", aggregation: "larger" },
  active_energy: { ourType: "active_energy_kcal", unit: "kcal", aggregation: "larger" },
};

interface IncomingMetric {
  name: string;
  date: string; // ISO datetime from HAE
  qty?: number;
  value?: number;
}

interface HAEPayload {
  data?: {
    metrics?: IncomingMetric[];
  };
  [key: string]: unknown; // permissive — HAE payload shape varies by version
}

function attributedDate(isoDateTime: string, timezone: string): string {
  // Sleep is attributed to the WAKE-UP date in the user's local timezone —
  // TECHNICAL-DESIGN §4. For non-sleep metrics this is just "the local date
  // of the sample," which is the same computation.
  const d = new Date(isoDateTime);
  const local = new Date(d.toLocaleString("en-US", { timeZone: timezone }));
  return local.toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerSecret = authHeader.replace(/^Bearer\s+/i, "");
  if (!bearerSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! // service role — Edge Function only, per CLAUDE.md rule 4
  );

  // Resolve which user this secret belongs to.
  const { data: account, error: acctErr } = await supabase
    .from("integration_accounts")
    .select("user_id")
    .eq("provider", "health_export")
    .eq("webhook_secret", bearerSecret)
    .maybeSingle();

  if (acctErr || !account) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = account.user_id as string;

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  const timezone = profile?.timezone ?? "America/Toronto";

  let payload: HAEPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const metrics = payload?.data?.metrics ?? [];
  let skipped = 0;
  let upserted = 0;

  for (const m of metrics) {
    const rule = METRIC_MAP[m.name];
    if (!rule) {
      skipped++;
      continue; // unknown metric — never fail the request, per §4
    }

    const rawValue = m.qty ?? m.value;
    if (typeof rawValue !== "number") {
      skipped++;
      continue;
    }

    const value = rule.transform ? rule.transform(rawValue) : rawValue;
    const metricDate = attributedDate(m.date, timezone);

    if (rule.aggregation === "latest") {
      await supabase.from("health_metrics").upsert(
        {
          user_id: userId,
          metric_type: rule.ourType,
          metric_date: metricDate,
          value,
          unit: rule.unit,
          source: "health_export",
          raw: m as unknown as Record<string, unknown>,
        },
        { onConflict: "user_id,metric_type,metric_date,source" }
      );
      upserted++;
    } else {
      // "larger" aggregation: only overwrite if the new value is bigger,
      // per §4's cumulative-metric rule.
      const { data: existing } = await supabase
        .from("health_metrics")
        .select("value")
        .eq("user_id", userId)
        .eq("metric_type", rule.ourType)
        .eq("metric_date", metricDate)
        .eq("source", "health_export")
        .maybeSingle();

      if (!existing || value > existing.value) {
        await supabase.from("health_metrics").upsert(
          {
            user_id: userId,
            metric_type: rule.ourType,
            metric_date: metricDate,
            value,
            unit: rule.unit,
            source: "health_export",
            raw: m as unknown as Record<string, unknown>,
          },
          { onConflict: "user_id,metric_type,metric_date,source" }
        );
      }
      upserted++;
    }
  }

  return new Response(JSON.stringify({ ok: true, upserted, skipped }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
