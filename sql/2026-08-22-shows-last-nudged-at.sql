-- Adds last_nudged_at to shows, so the daily aging-show nudge (boolin-discord,
-- src/notifications/nudges.ts) can tell "already nudged today" from "still
-- stuck, nudge again" without a separate log table. NULL until the first
-- nudge. Shared table with boolin-internal — supabase/schema.sql there
-- documents the same column.
alter table public.shows
  add column if not exists last_nudged_at timestamptz;
