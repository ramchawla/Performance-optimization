#!/bin/zsh
# Writes one ai_insights row via PostgREST — service-role key, same as query.sh.
# Usage: insert_note.sh '<note text>'
set -euo pipefail
SCRIPT_DIR="${0:A:h}"
[[ -f "$SCRIPT_DIR/.env" ]] && source "$SCRIPT_DIR/.env"
: "${SUPABASE_URL:?SUPABASE_URL not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set}"
: "${COACH_USER_ID:?COACH_USER_ID not set}"

note="$1"
today="$(date +%F)"
start="$(date -v-28d +%F 2>/dev/null || date -d '28 days ago' +%F)"

# jq builds the JSON body so the note's own quotes/newlines can't break it —
# the failure mode this replaces (raw SQL dollar-quoting) already bit us once
# in garmin-local-login.ts's INSERT, see HANDOFF.md.
body=$(jq -n --arg uid "$COACH_USER_ID" --arg ps "$start" --arg pe "$today" --arg body "$note" \
  '{user_id: $uid, period_start: $ps, period_end: $pe, body_md: $body, model: "claude-code-pro"}')

curl -sf -X POST "${SUPABASE_URL}/rest/v1/ai_insights" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "$body"
