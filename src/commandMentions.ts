import { Client } from 'discord.js'

// ── Clickable command mentions ──────────────────────────────────────────────
// </claim review:id> renders as a tappable chip in Discord that opens the
// command pre-filled — far better than telling people to type /claim.
// Command IDs are only known after registration, so we fetch them once at
// ready. Guild commands are checked first (deploy-commands registers to the
// guild when DISCORD_GUILD_ID is set), falling back to global.

const ids = new Map<string, string>()

export async function initCommandMentions(client: Client): Promise<void> {
  try {
    const guildId = process.env.DISCORD_GUILD_ID
    const commands = guildId
      ? await (await client.guilds.fetch(guildId)).commands.fetch()
      : await client.application?.commands.fetch()
    commands?.forEach(c => ids.set(c.name, c.id))
    console.log(`[commandMentions] loaded ${ids.size} command ids`)
  } catch (err) {
    // Non-fatal: cmd() falls back to plain /name text
    console.error('[commandMentions] failed to fetch command ids:', err)
  }
}

/**
 * cmd('claim review') → '</claim review:123456789>' (clickable), or
 * '/claim review' as plain text if ids haven't loaded. Pass the full path
 * including subcommand; the id is always the root command's.
 */
export function cmd(path: string): string {
  const id = ids.get(path.split(' ')[0])
  return id ? `</${path}:${id}>` : `/${path}`
}
