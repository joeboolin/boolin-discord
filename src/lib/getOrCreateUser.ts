import { User } from 'discord.js'
import { supabase } from '../supabase'

interface BoolinUser {
  id: string
  name: string
}

// Resolves a Discord user to a Boolin Tunes DB record.
// If no row exists for this discord_id, one is created automatically
// using their Discord display name — so /register is no longer a gate.
export async function getOrCreateUser(discordUser: User): Promise<BoolinUser | null> {
  const { data: existing } = await supabase
    .from('users')
    .select('id, name')
    .eq('discord_id', discordUser.id)
    .maybeSingle()

  if (existing) return existing

  // Auto-create. id has no DB default, so we generate it here.
  const { data: created, error } = await supabase
    .from('users')
    .insert({
      id: crypto.randomUUID(),
      name: discordUser.displayName ?? discordUser.username,
      discord_id: discordUser.id,
    })
    .select('id, name')
    .single()

  if (error || !created) {
    console.error('[getOrCreateUser] Failed to auto-create user:', error?.message)
    return null
  }

  console.log(`[getOrCreateUser] Auto-registered ${created.name} (${discordUser.id})`)
  return created
}
