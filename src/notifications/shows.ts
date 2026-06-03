import { EmbedBuilder, TextChannel } from 'discord.js'
import { supabase } from '../supabase'
import { Show, STATUS_LABELS, fmtDate } from '../types'

const COLOURS = {
  added:     0x5865f2, // blue
  moved:     0xf59e0b, // amber
  confirmed: 0x22c55e, // green
  claimed:   0x22c55e, // green
  unclaimed: 0xef4444, // red
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

  const embed = new EmbedBuilder()
    .setColor(COLOURS.added)
    .setTitle(show.artist)
    .setDescription('Added to the Live Shows board')
    .addFields(
      { name: 'Date',     value: fmtDate(show.show_date), inline: true },
      { name: 'Location', value: show.location,            inline: true },
      { name: 'Status',   value: STATUS_LABELS[show.status], inline: true },
      { name: 'Open slots', value: slots.length ? slots.join(' · ') : 'All filled' }
    )
    .setFooter({ text: 'Boolin Tunes' })
    .setTimestamp()

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

      const embed = new EmbedBuilder()
        .setColor(COLOURS.confirmed)
        .setTitle(newShow.artist)
        .setDescription('✅ Fully Confirmed')
        .addFields(
          { name: 'Date',          value: fmtDate(newShow.show_date), inline: true },
          { name: 'Location',      value: newShow.location,            inline: true },
          { name: '📸 Photographer', value: photographer,              inline: true },
          { name: '✍️ Writer',       value: writer,                    inline: true },
        )
        .setFooter({ text: 'Boolin Tunes' })
        .setTimestamp()

      await channel.send({ embeds: [embed] })
    } else {
      const embed = new EmbedBuilder()
        .setColor(COLOURS.moved)
        .setTitle(newShow.artist)
        .setDescription(`Status changed from **${STATUS_LABELS[oldShow.status]}** to **${STATUS_LABELS[newShow.status]}**`)
        .addFields(
          { name: 'Date',     value: fmtDate(newShow.show_date), inline: true },
          { name: 'Location', value: newShow.location,            inline: true },
        )
        .setFooter({ text: 'Boolin Tunes' })
        .setTimestamp()

      await channel.send({ embeds: [embed] })
    }
  }

  // Photographer slot
  if (oldShow.photographer_id !== newShow.photographer_id) {
    if (newShow.photographer_id && !oldShow.photographer_id) {
      const name = await getUserName(newShow.photographer_id)
      const embed = new EmbedBuilder()
        .setColor(COLOURS.claimed)
        .setTitle(newShow.artist)
        .setDescription(`📸 **${name}** claimed the photo slot`)
        .setFooter({ text: 'Boolin Tunes' })
        .setTimestamp()
      await channel.send({ embeds: [embed] })
    } else if (!newShow.photographer_id && oldShow.photographer_id) {
      const name = await getUserName(oldShow.photographer_id)
      const embed = new EmbedBuilder()
        .setColor(COLOURS.unclaimed)
        .setTitle(newShow.artist)
        .setDescription(`📸 **${name}** unclaimed the photo slot — now open`)
        .setFooter({ text: 'Boolin Tunes' })
        .setTimestamp()
      await channel.send({ embeds: [embed] })
    }
  }

  // Writer slot
  if (oldShow.writer_id !== newShow.writer_id) {
    if (newShow.writer_id && !oldShow.writer_id) {
      const name = await getUserName(newShow.writer_id)
      const embed = new EmbedBuilder()
        .setColor(COLOURS.claimed)
        .setTitle(newShow.artist)
        .setDescription(`✍️ **${name}** claimed the words slot`)
        .setFooter({ text: 'Boolin Tunes' })
        .setTimestamp()
      await channel.send({ embeds: [embed] })
    } else if (!newShow.writer_id && oldShow.writer_id) {
      const name = await getUserName(oldShow.writer_id)
      const embed = new EmbedBuilder()
        .setColor(COLOURS.unclaimed)
        .setTitle(newShow.artist)
        .setDescription(`✍️ **${name}** unclaimed the words slot — now open`)
        .setFooter({ text: 'Boolin Tunes' })
        .setTimestamp()
      await channel.send({ embeds: [embed] })
    }
  }
}
