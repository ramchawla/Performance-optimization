# AI coach (runs on your Mac, $0)

Every morning at 07:30 this runs Claude Code headless (`claude -p`) under your **Claude Pro subscription**. Claude reads your last 28 days and writes one short note into `ai_insights`. The dashboard shows it under "Today's insights".

- **No API key, no per-token billing.** `run-coach.sh` unsets `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` before calling `claude`, because either one would switch the CLI to paid API billing.
- Counts toward your Pro usage limits (one short run a day).
- Runs only when the Mac is on. If it's asleep at 07:30, launchd runs it at next wake.
- **Reads/writes via `query.sh` / `insert_note.sh`** — plain `curl` against Supabase's REST API using the service-role key, the same auth every edge function in this repo uses. Deliberately *not* the Supabase MCP connector: that needs an interactive login, which has no persistent credential a `launchd` job can use — every scheduled run failed silently until this was rewritten (2026-09-28).

## Deployed copy lives outside this repo — on purpose

The files here are the version-controlled source. The job actually runs from **`~/.perfhub/coach/`**, not from this Desktop-nested repo path: `launchd` invokes `/bin/zsh` directly (not through Terminal or Claude Code), and macOS's per-app Desktop-folder permission never covers that invocation — every run failed with `can't open input file` until the deployed copy moved out from under `~/Desktop` (2026-09-28, same root cause as the earlier Claude Code file-access issue this session hit).

After editing anything in this directory, re-sync the deployed copy:

```sh
cp scripts/coach/{run-coach.sh,prompt.md,query.sh,insert_note.sh} ~/.perfhub/coach/
```

`~/.perfhub/coach/.env` (secrets — never in this repo) is set up once:

```sh
cp scripts/coach/.env.example ~/.perfhub/coach/.env
# then fill in SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard -> Settings -> API)
chmod 600 ~/.perfhub/coach/.env
```

## Run once by hand

```sh
zsh ~/.perfhub/coach/run-coach.sh
```

## Schedule it daily

```sh
cp scripts/coach/com.perfhub.coach.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.perfhub.coach.plist
```

Check it's actually succeeding (exit code, not just "loaded"):

```sh
launchctl list | grep perfhub    # second column: 0 = last run succeeded
tail -20 ~/Library/Logs/perfhub-coach.log
```

## Stop it

```sh
launchctl unload ~/Library/LaunchAgents/com.perfhub.coach.plist
rm ~/Library/LaunchAgents/com.perfhub.coach.plist
```

Edit `prompt.md` to change what the coach looks at or how it writes — it uses PostgREST query syntax (`select=...&col=eq.value`), not raw SQL.
