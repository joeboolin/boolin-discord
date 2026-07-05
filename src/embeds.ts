import { EmbedBuilder } from 'discord.js'

// ── Boolin Tunes embed branding ─────────────────────────────────────────────
// One place for colours + the author strip, so every embed the bot sends
// carries the mark and the palette matches the site's CSS variables.

export const BRAND = {
  sage: 0x6e8a5e, // positive — confirmed, claimed, done
  sand: 0xc5c086, // open/attention — unclaimed lists, released slots
  ink:  0x1d291c, // neutral — informational lists
  moss: 0x2b3d33, // secondary neutral — status moves
  red:  0xb4413c, // removals
} as const

// Same wordmark the internal site uses; Discord renders webp author icons.
const LOGO =
  'https://boolintunes.com/wp-content/themes/boolin-tunes/assets/logos/kahal_web_adjust_w.webp'

/**
 * Base embed: brand colour + Boolin Tunes author strip + timestamp.
 * Callers add title/description/fields; use setFooter for contextual
 * hints only (the author strip already carries the branding, so no more
 * "Boolin Tunes" footers).
 */
// Show-status stripe colours — these MATCH the internal board's kanban
// column accents (Tailwind blue-400 / gray-300 / amber-400 / purple-400 /
// green-500, see SHOW_STATUS_THEME in boolin-internal lib/types.ts), so an
// embed's stripe reads as the same state as the column the card sits in.
// Change the board's colours? Change these too.
export const STATUS_COLOURS: Record<string, number> = {
  backlog:                    0x60a5fa, // blue-400
  to_be_requested:            0xd1d5db, // gray-300
  awaiting_response:          0xfbbf24, // amber-400
  awaiting_full_confirmation: 0xc084fc, // purple-400
  fully_confirmed:            0x22c55e, // green-500
}

export function statusColour(status: string): number {
  return STATUS_COLOURS[status] ?? BRAND.ink
}

export function brandEmbed(colour: number = BRAND.ink): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(colour)
    .setAuthor({ name: 'Boolin Tunes', iconURL: LOGO })
    .setTimestamp()
}
