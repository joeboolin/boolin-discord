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
      transport: ws,
    },
  }
)

export interface BotUser {
  id: string
  name: string
}

// Auto-provision users so /register is never needed.
// Match order: linked discord_id → existing row by display name (links it) → create new.
export async function getOrCreateUser(
  discordId: string,
  displayName: string
): Promise<BotUser> {
  // 1. Already linked
  const { data: linked } = await supabase
    .from('users')
    .select('id, name')
    .eq('discord_id', discordId)
    .single()
  if (linked) return linked

  // 2. Existing user added via the internal site — link their Discord on first use
  const { data: byName } = await supabase
    .from('users')
    .select('id, name')
    .ilike('name', displayName)
    .is('discord_id', null)
    .limit(1)
  if (byName?.length) {
    await supabase.from('users').update({ discord_id: discordId }).eq('id', byName[0].id)
    return byName[0]
  }

  // 3. Brand new — create from Discord identity
  // users.id has no DB default, so generate here; email placeholder keeps any
  // uniqueness constraint happy without colliding with real addresses
  const newUser = {
    id: crypto.randomUUID(),
    name: displayName,
    email: `${discordId}@discord.boolintunes.com`,
    role: 'contributor',
    discord_id: discordId,
  }
  await supabase.from('users').insert(newUser)
  return { id: newUser.id, name: newUser.name }
}
