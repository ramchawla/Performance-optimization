# AI coach (runs on your Mac, $0)

Every morning at 07:30 this runs Claude Code headless (`claude -p`) under your **Claude Pro subscription**. Claude reads your last 28 days through the Supabase connector and writes one short note into `ai_insights`. The dashboard shows it under "Today's insights".

- **No API key, no per-token billing.** `run-coach.sh` unsets `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` before calling `claude`, because either one would switch the CLI to paid API billing.
- Counts toward your Pro usage limits (one short run a day).
- Runs only when the Mac is on. If it's asleep at 07:30, launchd runs it at next wake.

## Run once by hand

```sh
zsh scripts/coach/run-coach.sh
```

## Schedule it daily

```sh
cp scripts/coach/com.perfhub.coach.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.perfhub.coach.plist
```

Logs: `~/Library/Logs/perfhub-coach.log`

## Stop it

```sh
launchctl unload ~/Library/LaunchAgents/com.perfhub.coach.plist
rm ~/Library/LaunchAgents/com.perfhub.coach.plist
```

Edit `prompt.md` to change what the coach looks at or how it writes.
