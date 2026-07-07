import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { supabase, getOrCreateUser } from '../supabase'
import { discordDate } from '../types'
import { cmd } from '../commandMentions'

export const data = new SlashCommandBuilder()
  .setName('request')
  .setDescription('Add a show to the Live Shows board')
  .addSubcommand(sub =>
    sub
      .setName('show')
      .setDescription('Request coverage for a show — creates a To Be Requested entry')
      .addStringOption(o => o.setName('artist').setDescription('Artist name').setRequired(true))
      .addStringOption(o => o.setName('date').setDescription('Show date (DD/MM/YYYY)').setRequired(true))
      .addStringOption(o => o.setName('location').setDescription('Venue and city e.g. O2 Academy, London').setRequired(true))
      .addStringOption(o =>
        o.setName('slot')
          .setDescription('Which slot do you want?')
          .setRequired(true)
          .addChoices(
            { name: 'Photo', value: 'photo' },
            { name: 'Words', value: 'words' }
          )
      )
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const user = await getOrCreateUser(
    interaction.user.id,
    interaction.member && 'displayName' in interaction.member
      ? interaction.member.displayName
      : interaction.user.displayName ?? interaction.user.username
  )

  const artist   = interaction.options.getString('artist', true)
  const dateStr  = interaction.options.getString('date', true)
  const location = interaction.options.getString('location', true)
  const slot     = interaction.options.getString('slot', true) as 'photo' | 'words'

  // Parse DD/MM/YYYY → YYYY-MM-DD
  const parts = dateStr.split('/')
  if (parts.length !== 3) {
    await interaction.editReply('Date must be in DD/MM/YYYY format, e.g. 25/07/2026')
    return
  }
  const [day, month, year] = parts
  const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  if (isNaN(new Date(isoDate).getTime())) {
    await interaction.editReply(`Invalid date: ${dateStr}. Use DD/MM/YYYY format.`)
    return
  }

  // Duplicate check — mirrors the internal site's Add Show warning (see
  // lib/duplicates.ts there). Same artist on the SAME DATE is almost
  // certainly the same show, so don't insert; point at /claim instead.
  // Same artist on other dates is possibly legit (two nights) — proceed
  // but say so. ilike pattern chars escaped, same as getOrCreateUser.
  const pattern = '%' + artist.replace(/[\\%_]/g, '\\$&') + '%'
  const { data: existing } = await supabase
    .from('shows')
    .select('id, artist, show_date, location, status, photographer_id, writer_id')
    .ilike('artist', pattern)

  const sameDate = (existing ?? []).filter(s => s.show_date === isoDate)
  if (sameDate.length > 0) {
    const s = sameDate[0]
    const photo = s.photographer_id ? 'taken' : 'open'
    const words = s.writer_id ? 'taken' : 'open'
    await interaction.editReply(
      `**${s.artist}** is already on the board for ${discordDate(s.show_date)} (${s.location}).\n` +
      `Slots: 📸 ${photo} · ✍️ ${words}. Grab one with ${cmd('claim show')} instead of adding it twice.`
    )
    return
  }
  const otherDates = (existing ?? []).filter(s => s.show_date !== isoDate)

  const newShow: Record<string, unknown> = {
    artist,
    location,
    show_date: isoDate,
    status:    'to_be_requested',
    priority:  false,
  }

  if (slot === 'photo')  newShow.photographer_id = user.id
  if (slot === 'words')  newShow.writer_id        = user.id

  const { data: created, error } = await supabase
    .from('shows')
    .insert(newShow)
    .select()
    .single()

  if (error || !created) {
    await interaction.editReply('Failed to create the show. Try again or add it via the internal site.')
    return
  }

  // No manual channel confirmation — the insert fires the Realtime
  // onShowInserted embed in the live channel; posting here as well doubled it.
  const note = otherDates.length
    ? `\nNote: ${otherDates[0].artist} is also on the board for ${otherDates.map(s => discordDate(s.show_date)).join(', ')} — just checking you're not doubling up.`
    : ''
  await interaction.editReply(`✅ **${artist}** added to the Live Shows board. You've been put down for **${slot}**.${note}`)
}
