-- One users row per Discord account; makes getOrCreateUser race-safe.
create unique index if not exists users_discord_id_unique
  on public.users (discord_id)
  where discord_id is not null;
