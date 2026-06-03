import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from 'discord.js'
import { supabase } from '../supabase'
import { fmtDate } from '../types'

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

  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('discord_id', interaction.user.id)
    .single()

  if (!user) {
    await interaction.editReply('Run `/register` first to link your Discord account.')
    return
  }

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

  // Post visible confirmation to the channel
  const msg = `📅 **${artist}** added to the Live Shows board with **${user.name}** on ${slot} — ${fmtDate(isoDate)}, ${location}. Status: **To Be Requested**.`
  const ch = interaction.channel
  if (ch instanceof TextChannel) await ch.send(msg)

  await interaction.editReply(`✅ **${artist}** added to the Live Shows board. You've been put down for **${slot}**.`)
}
