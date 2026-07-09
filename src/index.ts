import 'dotenv/config'
import { Client, GatewayIntentBits, TextChannel, Events } from 'discord.js'
import { supabase } from './supabase'
import { commands } from './commands'
import { onShowInserted, onShowUpdated } from './notifications/shows'
import { onReviewInserted, onReviewUpdated, onWeekInserted } from './notifications/reviews'
import { Show, Review, NmfWeek } from './types'
import { initCommandMentions } from './commandMentions'

// ── Validate env ──────────────────────────────────────────────────────────

const requiredEnv = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_LIVE_CHANNEL_ID',
  'DISCORD_CONTENT_CHANNEL_ID',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

// ── Discord client ────────────────────────────────────────────────────────

const client = new Client({ intents: [GatewayIntentBits.Guilds] })

// ── Helper: fetch a channel safely ───────────────────────────────────────

async function getChannel(id: string): Promise<TextChannel | null> {
  try {
    const ch = await client.channels.fetch(id)
    return ch instanceof TextChannel ? ch : null
  } catch {
    console.error(`Could not fetch channel ${id}`)
    return null
  }
}

// ── Supabase Realtime subscriptions ──────────────────────────────────────

// Channel status watchdog, v2.
//
// v1 exited immediately on CHANNEL_ERROR — and on 9 July a 1-second socket
// blip (code 1006) errored all three channels, supabase-js re-subscribed
// them ON ITS OWN within the same second, and the already-scheduled exit
// killed a healthy bot anyway. With no Railway restart policy configured,
// that turned one second of blip into five hours of downtime.
//
// v2 gives the client's own rejoin logic a grace window: a bad status arms
// a 60s timer, and a SUBSCRIBED for that channel disarms it. Only a channel
// that stays down for the full minute triggers the exit — the true
// wedged-subscription case (the original 7 July silent-notifications
// incident) that in-place rejoining doesn't fix. railway.toml now carries
// an explicit ON_FAILURE restart policy so the exit path actually restarts.
const pendingExits = new Map<string, NodeJS.Timeout>()
const GRACE_MS = 60_000

function watchChannel(name: string) {
  return (status: string, err?: Error) => {
    console.log(`[realtime] ${name}: ${status}${err ? ` (${err.message})` : ''}`)

    if (status === 'SUBSCRIBED') {
      const pending = pendingExits.get(name)
      if (pending) {
        clearTimeout(pending)
        pendingExits.delete(name)
        console.log(`[realtime] ${name} recovered on its own — exit cancelled`)
      }
      return
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (pendingExits.has(name)) return // timer already running
      console.warn(`[realtime] ${name} unhealthy — exiting in ${GRACE_MS / 1000}s unless it recovers`)
      pendingExits.set(name, setTimeout(() => {
        console.error(`[realtime] ${name} did not recover within ${GRACE_MS / 1000}s — exiting for a fresh start`)
        process.exit(1)
      }, GRACE_MS))
    }
  }
}

function setupRealtime(): void {
  // Shows table
  supabase
    .channel('shows-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shows' }, async payload => {
      const ch = await getChannel(process.env.DISCORD_LIVE_CHANNEL_ID!)
      if (ch) await onShowInserted(payload.new as Show, ch)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shows' }, async payload => {
      const ch = await getChannel(process.env.DISCORD_LIVE_CHANNEL_ID!)
      if (ch) await onShowUpdated(payload.old as Show, payload.new as Show, ch)
    })
    .subscribe(watchChannel('shows'))

  // Reviews table
  supabase
    .channel('reviews-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, async payload => {
      const ch = await getChannel(process.env.DISCORD_CONTENT_CHANNEL_ID!)
      if (ch) await onReviewInserted(payload.new as Review, ch)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reviews' }, async payload => {
      const ch = await getChannel(process.env.DISCORD_CONTENT_CHANNEL_ID!)
      if (ch) await onReviewUpdated(payload.old as Review, payload.new as Review, ch)
    })
    .subscribe(watchChannel('reviews'))

  // NMF weeks table
  supabase
    .channel('weeks-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'nmf_weeks' }, async payload => {
      const ch = await getChannel(process.env.DISCORD_CONTENT_CHANNEL_ID!)
      if (ch) await onWeekInserted(payload.new as NmfWeek, ch)
    })
    .subscribe(watchChannel('nmf_weeks'))
}

// ── Command handler ───────────────────────────────────────────────────────

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return

  const command = commands.get(interaction.commandName)
  if (!command) return

  try {
    await command.execute(interaction)
  } catch (err) {
    console.error(`Error in command /${interaction.commandName}:`, err)
    const msg = { content: 'Something went wrong. Try again in a moment.', ephemeral: true }
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg)
    } else {
      await interaction.reply(msg)
    }
  }
})

// ── Boot ──────────────────────────────────────────────────────────────────

client.once(Events.ClientReady, c => {
  void initCommandMentions(c)
  console.log(`✓ Logged in as ${c.user.tag}`)
  setupRealtime()
  console.log(`✓ Realtime subscriptions active`)
  console.log(`✓ ${commands.size} commands registered`)
})

client.login(process.env.DISCORD_BOT_TOKEN)
