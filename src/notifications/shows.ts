import { TextChannel } from 'discord.js'
import { supabase } from '../supabase'
import { Show, statusLabel, discordDate } from '../types'
import { brandEmbed, BRAND } from '../embeds'

// Brand palette (see src/embeds.ts) — sage for positive, sand for
// open/attention, moss for neutral moves, red for removals.
const COLOURS = {
  added:     BRAND.ink,
  moved:     BRAND.moss,
  confirmed: BRAND.sage,
  claimed:   BRAND.sage,
  unclaimed: BRAND.sand,
}

async function getUserName(userId: string | null): Promise<string> {
  if (!userId) return 'Unclaimed'
  const { data } = await supabase.from('users').select('name').eq('id', userId).single()
  return data?.name ?? 'Unknown'
}

export async function onShowInserted(show: Show, channel: TextChannel): Promise<void> {
  const slots: string[] = []
  if (!show.photographer_id) slots.push('📸 Photo')
  if (!show.writer_id)       slots.push('✍️ Words')

  const embed = brandEmbed(COLOURS.added)
    .setTitle(show.artist)
    .setDescription('Added to the Live Shows board')
    .addFields(
      { name: 'Date',     value: discordDate(show.show_date), inline: true },
      { name: 'Location', value: show.location,            inline: true },
      { name: 'Status',   value: statusLabel(show.status), inline: true },
      { name: 'Open slots', value: slots.length ? slots.join(' · ') : 'All filled' }
    )

  await channel.send({ embeds: [embed] })
}

export async function onShowUpdated(
  oldShow: Show,
  newShow: Show,
  channel: TextChannel
): Promise<void> {

  // Status change
  if (oldShow.status !== newShow.status) {
    if (newShow.status === 'fully_confirmed') {
      const photographer = await getUserName(newShow.photographer_id)
      const writer       = await getUserName(newShow.writer_id)

      const embed = brandEmbed(COLOURS.confirmed)
        .setTitle(newShow.artist)
        .setDescription('✅ Fully Confirmed')
        .addFields(
          { name: 'Date',          value: discordDate(newShow.show_date), inline: true },
          { name: 'Location',      value: newShow.location,            inline: true },
          { name: '📸 Photographer', value: photographer,              inline: true },
          { name: '✍️ Writer',       value: writer,                    inline: true },
        )

      await channel.send({ embeds: [embed] })
    } else {
      const embed = brandEmbed(COLOURS.moved)
        .setTitle(newShow.artist)
        .setDescription(`Status changed from **${statusLabel(oldShow.status)}** to **${statusLabel(newShow.status)}**`)
        .addFields(
          { name: 'Date',     value: discordDate(newShow.show_date), inline: true },
          { name: 'Location', value: newShow.location,            inline: true },
        )

      await channel.send({ embeds: [embed] })
    }
  }

  // Photographer slot
  if (oldShow.photographer_id !== newShow.photographer_id) {
    if (newShow.photographer_id && !oldShow.photographer_id) {
      const name = await getUserName(newShow.photographer_id)
      const embed = brandEmbed(COLOURS.claimed)
        .setTitle(newShow.artist)
        .setDescription(`📸 **${name}** claimed the photo slot`)
      await channel.send({ embeds: [embed] })
    } else if (!newShow.photographer_id && oldShow.photographer_id) {
      const name = await getUserName(oldShow.photographer_id)
      const embed = brandEmbed(COLOURS.unclaimed)
        .setTitle(newShow.artist)
        .setDescription(`📸 **${name}** unclaimed the photo slot — now open`)
      await channel.send({ embeds: [embed] })
    }
  }

  // Writer slot
  if (oldShow.writer_id !== newShow.writer_id) {
    if (newShow.writer_id && !oldShow.writer_id) {
      const name = await getUserName(newShow.writer_id)
      const embed = brandEmbed(COLOURS.claimed)
        .setTitle(newShow.artist)
        .setDescription(`✍️ **${name}** claimed the words slot`)
      await channel.send({ embeds: [embed] })
    } else if (!newShow.writer_id && oldShow.writer_id) {
      const name = await getUserName(oldShow.writer_id)
      const embed = brandEmbed(COLOURS.unclaimed)
        .setTitle(newShow.artist)
        .setDescription(`✍️ **${name}** unclaimed the words slot — now open`)
      await channel.send({ embeds: [embed] })
    }
  }
}
