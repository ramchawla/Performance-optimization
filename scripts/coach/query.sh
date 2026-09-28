#!/bin/zsh
# PostgREST helper for the coach job — reads via the service-role key, the
# same auth method every edge function in this repo already uses. No OAuth,
# no interactive login, so it survives running unattended under launchd
# (unlike the Supabase MCP connector this script originally relied on: that's
# tied to an interactive session's authorization and has no persistent
# credential a cron job can use).
#
# Usage: query.sh <table> '<postgrest querystring>'
#   query.sh health_metrics 'select=metric_type,value,metric_date&user_id=eq.'$COACH_USER_ID'&metric_date=gte.'$SINCE'&order=metric_date.desc'
set -euo pipefail
SCRIPT_DIR="${0:A:h}"
[[ -f "$SCRIPT_DIR/.env" ]] && source "$SCRIPT_DIR/.env"
: "${SUPABASE_URL:?SUPABASE_URL not set — see .env.example}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY not set — see .env.example}"

table="$1"
qs="${2:-}"
curl -sf "${SUPABASE_URL}/rest/v1/${table}?${qs}" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
