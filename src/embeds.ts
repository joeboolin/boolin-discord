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
export function brandEmbed(colour: number = BRAND.ink): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(colour)
    .setAuthor({ name: 'Boolin Tunes', iconURL: LOGO })
    .setTimestamp()
}
