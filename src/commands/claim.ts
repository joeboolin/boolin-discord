import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js'
import { supabase, getOrCreateUser } from '../supabase'
import { discordDate, todayLondon } from '../types'

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

// No manual channel.send() confirmations in here — the DB update fires the
// Supabase Realtime subscription, which posts the public embed to the
// notification channel. Posting from the command as well produced doubles.

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const user = await getOrCreateUser(
    interaction.user.id,
    interaction.member && 'displayName' in interaction.member
      ? interaction.member.displayName
      : interaction.user.displayName ?? interaction.user.username
  )

  const sub    = interaction.options.getSubcommand()
  const artist = interaction.options.getString('artist', true)

  if (sub === 'show') {
    const slot = interaction.options.getString('slot', true) as 'photo' | 'words'
    const field = slot === 'photo' ? 'photographer_id' : 'writer_id'
    const today = todayLondon()

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
      const list = shows.map(s => `• ${s.artist} — ${discordDate(s.show_date)}`).join('\n')
      await interaction.editReply(`Multiple matches — be more specific:\n${list}`)
      return
    }

    const show = shows[0]
    if (show[field]) {
      await interaction.editReply(`The ${slot} slot for **${show.artist}** is already taken.`)
      return
    }

    // Conditional update: .is(field, null) makes this race-safe. If someone
    // claimed between our read and this write, zero rows update and we say
    // so, instead of silently overwriting their claim.
    const { data: updated, error } = await supabase
      .from('shows')
      .update({ [field]: user.id })
      .eq('id', show.id)
      .is(field, null)
      .select('id')

    if (error) {
      await interaction.editReply('Database error while claiming — try again in a moment.')
      return
    }
    if (!updated?.length) {
      await interaction.editReply(`Someone beat you to it — the ${slot} slot for **${show.artist}** was just taken.`)
      return
    }

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
    const { data: updated, error } = await supabase
      .from('reviews')
      .update({ assignee_id: user.id })
      .eq('id', review.id)
      .is('assignee_id', null)
      .select('id')

    if (error) {
      await interaction.editReply('Database error while claiming — try again in a moment.')
      return
    }
    if (!updated?.length) {
      await interaction.editReply(`Someone beat you to it — the review for **${review.artist}** was just claimed.`)
      return
    }

    await interaction.editReply(`✅ Claimed the review for **${review.artist}**.`)
  }
}
