# boolin-discord — embed design pass (4 July 2026)

Copy over the repo root. No deletions, no new deps, no SQL. tsc clean.

## What changed
- **src/embeds.ts (new)** — brand palette (sage = positive, sand = open/
  attention, ink/moss = neutral, red = removals) matching the site's CSS
  variables, plus brandEmbed(): every embed now carries the Boolin Tunes
  author strip with the wordmark and a timestamp. Replaces the arbitrary
  blurple/amber hexes that were scattered across five files.
- **src/commandMentions.ts (new)** — command IDs fetched once at ready;
  cmd('claim review') renders as a clickable chip that opens the command
  pre-filled. Falls back to plain /claim review text if the fetch fails.
- **Native Discord timestamps** — show dates render as <t:…:D>, so everyone
  sees their own locale ("4 July 2026") instead of a fixed en-GB string.
  Week labels in field NAMES keep text formatting (Discord doesn't render
  timestamps there).
- **/unclaimed redesigned** — grouped by month with counts ("July 2026 (6)"),
  each show on two lines with `📸 Photo` / `✍️ Words` chips for exactly the
  slots that are open, and a clickable /claim show mention up top.
- **/help redesigned** — every entry is a tappable command mention, built at
  execute time so the IDs are live.
- **/shows, /reviews, /contact, notifications** — brand colours + author
  strip; "Boolin Tunes" footers dropped (the author strip carries the brand);
  the unassigned-review notification footer keeps its contextual claim hint.

## Apply steps
1. Copy files over, commit, push — Railway redeploys.
2. No deploy-commands run needed (no command definitions changed).
3. Smoke test in Discord: /help (commands should be tappable chips),
   /unclaimed (month groups, slot chips, dates in your local format), then
   drag a show on the site and check the notification embed shows the
   wordmark author strip in brand colours.
