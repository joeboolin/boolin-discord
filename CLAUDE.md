# boolin-discord

Discord bot for Boolin Tunes (a UK heavy-music publication). TypeScript +
discord.js v14, Supabase Realtime for notifications, deployed on Railway.
Replaces ClickUp's Discord integration: posts when shows and reviews change,
and serves slash commands for claiming and surfacing work.

Shares one Supabase database with `boolin-internal` (separate repo, the Next.js
internal site).

## Commands

```bash
npm run dev              # ts-node against src/
npm run build            # tsc -> dist/ (local typecheck gate; NOT what ships)
npm run deploy-commands  # register slash commands with Discord
```

`npm run build` is the pre-commit gate — it is a typecheck, not a deploy
artifact. See "Deployment".

## Environment

Windows, Git Bash. Paths are `/c/Users/User/...`.

`src/index.ts` validates six env vars at boot and calls `process.exit(1)` on
the first one missing: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`,
`DISCORD_LIVE_CHANNEL_ID`, `DISCORD_CONTENT_CHANNEL_ID`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`.

`DISCORD_GUILD_ID` is deliberately **not** in that list — it is optional and
only read by `deploy-commands`. Set, commands register to that guild and appear
instantly; unset, they register globally and can take up to an hour to show up.
Keep it set.

`INTERNAL_SITE_URL` is also optional — the base URL of the boolin-internal
Next.js site (e.g. its Vercel domain), used only to link the aging-show nudge
(`src/notifications/nudges.ts`) to the Live Shows board. Unset, the nudge still
posts, just without the link.

Never commit `.env` (gitignored — keep it that way). It holds a live bot token
and the Supabase service role key.

## Deployment

Push to `main` → Railway redeploys. There is no staging, so a broken `main` is a
broken bot.

**Railway runs the TypeScript directly.** Both `nixpacks.toml` and
`railway.toml` start with `npx tsx src/index.ts`; `dist/` is never deployed and
`npm start` (`node dist/index.js`) is not the production path. So:
- `npm run build` catches type errors but proves nothing about the start command.
- `dist/` is a local artifact. It is gitignored — do not commit it.

`railway.toml` sets `restartPolicyType = "ON_FAILURE"` with 10 retries. That is
load-bearing, not decoration — see the watchdog below.

### Slash command registration

Pushing does **not** update slash commands. Run `npm run deploy-commands`
locally after changing any command's `data` builder — its name, description,
options or choices. Behaviour-only changes inside `execute()` need no run.

The command list is duplicated in **two** places and both must be edited when
adding or removing a command:
- `src/commands/index.ts` — the runtime `Collection` the interaction handler reads
- `src/deploy-commands.ts` — the registration payload

Miss the first and the command registers but does nothing. Miss the second and
it works in code but never appears in Discord.

## Supabase

Project ID `mthldobpurkdhyfuskio`. Shared with `boolin-internal`.

**This bot uses the service role key, which bypasses RLS entirely.** That is the
opposite of the internal site, which uses the anon key with no session. Do not
carry conclusions about permissions from one repo to the other: a write that
works here can fail silently there.

Because the two share tables, a schema change in one can break the other. Check
both before altering a table either uses. `sql/` holds migrations applied by
hand.

Realtime subscriptions cover `shows`, `reviews` and `nmf_weeks`. A table only
emits events if it is in the `supabase_realtime` publication — adding a handler
for a table that isn't will silently never fire.

### getOrCreateUser

`src/supabase.ts` auto-provisions users so there is no `/register` step. Match
order: linked `discord_id` → existing row by display name (links it) → create
new. Three things there guard against real bugs:

- **ilike metacharacters are escaped.** A Discord display name containing `%`
  acts as a wildcard; a name of `%` would match every unlinked user and link the
  wrong account.
- **The UPDATE repeats `.is('discord_id', null)`**, not just the SELECT, so a
  concurrent link of the same row is a harmless no-op for the loser.
- **A `23505` unique violation is recovered, not thrown.** Two simultaneous
  first-time commands race the insert; the partial unique index in
  `sql/2026-07-04-users-discord-id-unique.sql` makes the loser fail, and we
  re-select the winner's row.

`users.id` has no DB default, so the id is generated with `crypto.randomUUID()`.
The email placeholder is `<discordId>@discord.boolintunes.com`, which keeps any
uniqueness constraint happy without colliding with real
`firstname@boolintunes.com` addresses.

## The realtime watchdog — do not simplify

`watchChannel()` in `src/index.ts` arms a **60 second** timer on
`CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`, and disarms it if that channel reports
`SUBSCRIBED` again. Only a channel still down after the full minute exits the
process.

Both halves are there because of an incident:
- **Exiting at all** fixes the 7 July silent-notifications case, where a
  subscription wedged and in-place rejoining never recovered it.
- **The 60s grace** fixes 9 July, when a one-second socket blip errored all
  three channels, supabase-js re-subscribed them itself within the same second,
  and v1's immediate exit killed a healthy bot. With no restart policy set at
  the time, one second of blip became five hours of downtime.

Reverting to an immediate exit reintroduces the second incident. Removing the
exit reintroduces the first. If the restart policy ever leaves `railway.toml`,
the exit path becomes downtime again.

## Conventions

- Embeds are built with `brandEmbed()` from `src/embeds.ts`, which carries the
  wordmark author strip and a timestamp. Colours come from `BRAND` — sage
  positive, sand open/attention, ink/moss neutral, red removals. Don't hardcode
  hexes; that is what the July design pass removed.
- Command references in copy use `cmd('claim review')` from
  `src/commandMentions.ts`, which renders a tappable chip. IDs are fetched once
  at ready and it falls back to plain text if the fetch fails.
- Dates render as native Discord timestamps (`<t:…:D>`) so each reader sees
  their own locale. Field **names** can't render them — keep text there.
- The `@ts-expect-error` on the `ws` transport in `src/supabase.ts` is load-
  bearing. If it ever reports as *unused*, upstream fixed their types: delete
  the comment rather than working around it.
- Comments should explain *why*, especially where something guards a bug that
  has actually happened.
- Changelogs for Discord: under 4,000 characters, hyphens not em dashes, emoji
  shortcodes, written for the team rather than the repo.

## Known debt

- **`node_modules` is committed** (~3,985 tracked files). Railway runs
  `npm install` in its build phase, so it isn't needed. Untracking it is
  `git rm -r --cached node_modules` plus a commit, but that is a large diff and
  should be its own piece of work.
- **`tsx` is not a dependency.** The start command is `npx tsx src/index.ts`,
  so every container start fetches tsx from the registry. A registry outage or
  a breaking tsx release stops the bot from booting. Adding it to
  `dependencies` would pin it.
