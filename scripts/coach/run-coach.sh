#!/bin/zsh
# Daily AI coach note for Performance Hub — $0 by design.
#
# Runs Claude Code headless on this Mac under the user's Claude Pro
# subscription (counts toward Pro usage limits, never billed per token). It
# reads the last 28 days through the Supabase connector Claude Code already
# has and inserts one row into ai_insights, which the dashboard shows.
#
# Scheduled by com.perfhub.coach.plist (see README.md). Safe to run by hand.
set -euo pipefail

# An API key in the environment would silently switch the CLI from the Pro
# subscription to pay-per-token API billing. Strip them rather than trust the
# caller's environment — the whole point of this job is that it costs nothing.
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

SCRIPT_DIR="${0:A:h}"
USER_ID="${COACH_USER_ID:-d17826a7-d20a-4a54-8299-fad65a4426be}"
TODAY="$(TZ=America/Toronto date +%F)"

PROMPT="$(sed -e "s/{{USER_ID}}/${USER_ID}/g" -e "s/{{TODAY}}/${TODAY}/g" "$SCRIPT_DIR/prompt.md")"

echo "[$(date '+%F %T')] coach run for $TODAY"
cd "$SCRIPT_DIR"
claude -p "$PROMPT" \
  --allowedTools "mcp__claude_ai_Supabase__execute_sql" \
  --max-turns 20
echo "[$(date '+%F %T')] done"
