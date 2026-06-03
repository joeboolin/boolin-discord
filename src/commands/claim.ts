import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js'
import { supabase } from '../supabase'
import { fmtDate } from '../types'

export const data = new SlashCommandBuilder()
  .setName('claim')
  .setDescription('Claim a show slot or review')
  .addSubcommand(sub =>
    sub
      .setName('show')
      .setDescription('Claim a photographer or writer slot on a show')
      .addStringOption(o => o.setName('artist').setDescription('Artist name (partial match)').setRequired(true))
      .addStringOption(o =>
        o.setName('slot')
          .setDescription('Which slot to claim')
          .setRequired(true)
          .addChoices({ name: 'Photo', value: 'photo' }, { name: 'Words', value: 'words' })
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('review')
      .setDescription('Assign yourself to a review')
      .addStringOption(o => o.setName('artist').setDescription('Artist name (partial match)').setRequired(true))
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  // Look up registered user
  const { data: user } = await supabase
    .from('users')
    .select('id, name')
    .eq('discord_id', interaction.user.id)
    .single()

  if (!user) {
    await interaction.editReply('You need to register first — run `/register` to link your Discord account.')
    return
  }

  const sub    = interaction.options.getSubcommand()
  const artist = interaction.options.getString('artist', true)

  if (sub === 'show') {
    const slot = interaction.options.getString('slot', true) as 'photo' | 'words'
    const field = slot === 'photo' ? 'photographer_id' : 'writer_id'
    const today = new Date().toISOString().split('T')[0]

    // Fuzzy match upcoming show
    const { data: shows } = await supabase
      .from('shows')
      .select('id, artist, show_date, location, photographer_id, writer_id')
      .ilike('artist', `%${artist}%`)
      .gte('show_date', today)
      .order('show_date')

    if (!shows?.length) {
      await interaction.editReply(`No upcoming shows matching "${artist}". To add it to the board, use:\n\`/request show artist:${artist} date:DD/MM/YYYY location:Venue, City\``)
      return
    }
    if (shows.length > 1) {
      const list = shows.map(s => `• ${s.artist} — ${fmtDate(s.show_date)}`).join('\n')
      await interaction.editReply(`Multiple matches — be more specific:\n${list}`)
      return
    }

    const show = shows[0]
    if (show[field]) {
      await interaction.editReply(`The ${slot} slot for **${show.artist}** is already taken.`)
      return
    }

    await supabase.from('shows').update({ [field]: user.id }).eq('id', show.id)

    // Visible channel confirmation
    const msg = `📸 **${user.name}** claimed the **${slot}** slot for **${show.artist}** (${fmtDate(show.show_date)})`
    const channel = interaction.channel
    if (channel instanceof TextChannel) await channel.send(msg)

    await interaction.editReply(`✅ Claimed the ${slot} slot for **${show.artist}**.`)

  } else if (sub === 'review') {
    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, artist, nmf_week_id, assignee_id')
      .ilike('artist', `%${artist}%`)
      .is('assignee_id', null)
      .neq('status', 'done')

    if (!reviews?.length) {
      await interaction.editReply(`No unassigned reviews matching "${artist}".`)
      return
    }
    if (reviews.length > 1) {
      const list = reviews.map(r => `• ${r.artist}`).join('\n')
      await interaction.editReply(`Multiple matches — be more specific:\n${list}`)
      return
    }

    const review = reviews[0]
    await supabase.from('reviews').update({ assignee_id: user.id }).eq('id', review.id)

    const msg = `✍️ **${user.name}** claimed the review for **${review.artist}**`
    const channel = interaction.channel
    if (channel instanceof TextChannel) await channel.send(msg)

    await interaction.editReply(`✅ Claimed the review for **${review.artist}**.`)
  }
}
