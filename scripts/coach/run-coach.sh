#!/bin/zsh
# Daily AI coach note for Performance Hub — $0 by design.
#
# Runs Claude Code headless on this Mac under the user's Claude Pro
# subscription (counts toward Pro usage limits, never billed per token). It
# reads the last 28 days via query.sh/insert_note.sh (PostgREST + the
# service-role key — same auth every edge function in this repo uses) and
# inserts one row into ai_insights, which the dashboard shows.
#
# Deliberately NOT the Supabase MCP connector: that's tied to an interactive
# session's OAuth authorization, which has no persistent credential a cron
# job launched by launchd can use — every unattended run failed silently
# until this was rewritten (2026-09-28).
#
# Lives in ~/.perfhub/coach/, not under this repo's Desktop path: launchd
# invokes /bin/zsh directly (not through Terminal/Claude Code), and macOS's
# per-app Desktop-folder permission that this repo sits under does not cover
# that invocation — every run failed with "can't open input file" until this
# moved out from under ~/Desktop (2026-09-28). The canonical, version-
# controlled copy lives in this repo; ~/.perfhub/coach/ is a deployed copy
# plus the untracked .env secrets file. Re-sync after editing the repo copy:
#   cp scripts/coach/{run-coach.sh,prompt.md,query.sh,insert_note.sh} ~/.perfhub/coach/
#
# Scheduled by com.perfhub.coach.plist (see README.md). Safe to run by hand.
set -euo pipefail

# An API key in the environment would silently switch the CLI from the Pro
# subscription to pay-per-token API billing. Strip them rather than trust the
# caller's environment — the whole point of this job is that it costs nothing.
unset ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

SCRIPT_DIR="${0:A:h}"
[[ -f "$SCRIPT_DIR/.env" ]] || { echo "[$(date '+%F %T')] missing $SCRIPT_DIR/.env — see .env.example"; exit 1; }
source "$SCRIPT_DIR/.env"
: "${COACH_USER_ID:?COACH_USER_ID not set in .env}"
TODAY="$(TZ=America/Toronto date +%F)"

PROMPT="$(sed -e "s/{{USER_ID}}/${COACH_USER_ID}/g" -e "s/{{TODAY}}/${TODAY}/g" "$SCRIPT_DIR/prompt.md")"

echo "[$(date '+%F %T')] coach run for $TODAY"
cd "$SCRIPT_DIR"
claude -p "$PROMPT" \
  --allowedTools "Bash(./query.sh:*) Bash(./insert_note.sh:*)" \
  --max-turns 20
echo "[$(date '+%F %T')] done"
