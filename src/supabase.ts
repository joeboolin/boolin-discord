import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

// Service role key — bypasses RLS, safe for server-side bot use only
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: {
      // @ts-expect-error — ws's constructor signature doesn't satisfy
      // supabase-js's WebSocketLikeConstructor type; they are runtime-
      // compatible on Node 20. If this line ever errors as an UNUSED
      // expect-error, the upstream types were fixed — delete the comment.
      transport: ws,
    },
  }
)

export interface BotUser {
  id: string
  name: string
}

// Escape ilike pattern metacharacters. Without this, a Discord display name
// containing % or _ acts as a wildcard — a name of "%" would match EVERY
// unlinked user and silently link the wrong account.
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
}

// Auto-provision users so /register is never needed.
// Match order: linked discord_id → existing row by display name (links it) → create new.
//
// Concurrency: two simultaneous first-time commands can race step 3. The
// partial unique index on users.discord_id (see sql/2026-07-04-users-discord-id-unique.sql)
// makes the second insert fail with 23505, which we recover from by
// re-selecting the winner's row. Throws on unrecoverable failure so the
// global interaction handler replies with the generic error message instead
// of the command continuing with a phantom user.
export async function getOrCreateUser(
  discordId: string,
  displayName: string
): Promise<BotUser> {
  // 1. Already linked
  const { data: linked } = await supabase
    .from('users')
    .select('id, name')
    .eq('discord_id', discordId)
    .maybeSingle()
  if (linked) return linked

  // 2. Existing user added via the internal site — link their Discord on first use.
  //    The .is('discord_id', null) guard on the UPDATE (not just the select)
  //    means a concurrent link of the same row is a harmless no-op for the loser.
  const { data: byName } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', escapeIlike(displayName))
    .is('discord_id', null)
    .limit(1)
  if (byName?.length) {
    const { error: linkError } = await supabase
      .from('users')
      .update({ discord_id: discordId })
      .eq('id', byName[0].id)
      .is('discord_id', null)
    if (!linkError) return byName[0]
    console.error('[getOrCreateUser] name-link failed:', linkError.message)
  }

  // 3. Brand new — create from Discord identity.
  // users.id has no DB default, so generate here; email placeholder keeps any
  // uniqueness constraint happy without colliding with real addresses.
  const newUser = {
    id: crypto.randomUUID(),
    name: displayName,
    email: `${discordId}@discord.boolintunes.com`,
    role: 'contributor',
    discord_id: discordId,
  }
  const { error } = await supabase.from('users').insert(newUser)
  if (error) {
    // 23505 = unique violation: another command created this user a moment
    // ago (or the name-link above lost a race). Their row is the truth.
    if (error.code === '23505') {
      const { data: raced } = await supabase
        .from('users')
        .select('id, name')
        .eq('discord_id', discordId)
        .maybeSingle()
      if (raced) return raced
    }
    console.error('[getOrCreateUser] insert failed:', error.message)
    throw new Error(`Could not create user for ${displayName}`)
  }
  return { id: newUser.id, name: newUser.name }
}
