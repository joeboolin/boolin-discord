import { TextChannel } from 'discord.js'
import { supabase } from '../supabase'
import { brandEmbed, BRAND } from '../embeds'
import { Show, statusLabel, discordDate, todayLondon } from '../types'

// Aging-show nudge — flags shows still sitting in an early status as their
// date approaches, so they don't fall through the cracks between the person
// who added them and whoever should be chasing a response. Runs daily (see
// scheduleNudgeCheck in index.ts).
//
// last_nudged_at (sql/2026-08-22-shows-last-nudged-at.sql) throttles this to
// one nudge per calendar day per show — a show still stuck tomorrow nudges
// again, it just can't fire twice on the same day.

interface AgingRule {
  status: string
  withinDays: number
}

const AGING_RULES: AgingRule[] = [
  { status: 'to_be_requested',   withinDays: 14 },
  { status: 'awaiting_response', withinDays: 7 },
]

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

// Start of "today" in Europe/London, as an ISO instant. A show nudged at any
// point since then counts as "already nudged today", regardless of what time
// this check happens to run. Treating the London calendar date as a UTC
// midnight is up to an hour off during BST, but that only matters in the hour
// either side of the actual boundary — it still correctly separates "today"
// from "yesterday" for a once-a-day throttle.
function londonMidnightIso(): string {
  return `${todayLondon()}T00:00:00Z`
}

async function fetchAgingShows(): Promise<Show[]> {
  const today   = todayLondon()
  const sinceIso = londonMidnightIso()

  const perRule = await Promise.all(
    AGING_RULES.map(async rule => {
      const { data, error } = await supabase
        .from('shows')
        .select('*')
        .eq('status', rule.status)
        // "Within N days" means upcoming and soon, not distant or already
        // past — a show dated last month sitting in an early status is a
        // different (probably cancelled/forgotten) problem than this nudge.
        .gte('show_date', today)
        .lte('show_date', addDays(today, rule.withinDays))
        .or(`last_nudged_at.is.null,last_nudged_at.lt.${sinceIso}`)

      if (error) {
        console.error(`[nudges] query failed for status ${rule.status}:`, error)
        return []
      }
      return (data ?? []) as Show[]
    })
  )

  return perRule.flat()
}

function boardUrl(): string | null {
  const base = process.env.INTERNAL_SITE_URL
  return base ? `${base.replace(/\/+$/, '')}/shows` : null
}

// Runs one check and, if anything qualifies, sends a single batched message
// rather than one per show — a bad week of unrequested shows shouldn't spam
// the channel with a message each.
export async function runAgingShowNudge(channel: TextChannel): Promise<void> {
  const shows = await fetchAgingShows()
  if (!shows.length) return

  const url = boardUrl()
  const lines = shows.map(
    s => `• **${s.artist}** — ${discordDate(s.show_date)} @ **${s.location}** — _${statusLabel(s.status)}_`
  )

  const embed = brandEmbed(BRAND.sand) // sand = open/attention, same as unclaimed-slot embeds
    .setTitle(`⏰ ${shows.length} show${shows.length === 1 ? '' : 's'} need${shows.length === 1 ? 's' : ''} attention`)
    .setDescription(
      lines.join('\n') + (url ? `\n\n[Open the Live Shows board](${url})` : '')
    )

  try {
    await channel.send({ embeds: [embed] })
  } catch (err) {
    // Don't stamp last_nudged_at if the message never sent — leave these
    // shows eligible so the next run retries them instead of silently
    // marking a nudge that never reached anyone.
    console.error('[nudges] failed to send nudge message:', err)
    return
  }

  const { error } = await supabase
    .from('shows')
    .update({ last_nudged_at: new Date().toISOString() })
    .in('id', shows.map(s => s.id))

  if (error) {
    console.error('[nudges] failed to stamp last_nudged_at:', error)
  }
}
