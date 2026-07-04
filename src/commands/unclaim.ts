import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { supabase, getOrCreateUser } from '../supabase'
import { fmtDate, todayLondon } from '../types'

export const data = new SlashCommandBuilder()
  .setName('unclaim')
  .setDescription('Release a show slot or review')
  .addSubcommand(sub =>
    sub
      .setName('show')
      .setDescription('Release your photographer or writer slot')
      .addStringOption(o => o.setName('artist').setDescription('Artist name (partial match)').setRequired(true))
      .addStringOption(o =>
        o.setName('slot')
          .setDescription('Which slot to release')
          .setRequired(true)
          .addChoices({ name: 'Photo', value: 'photo' }, { name: 'Words', value: 'words' })
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('review')
      .setDescription('Release a review you have claimed')
      .addStringOption(o => o.setName('artist').setDescription('Artist name (partial match)').setRequired(true))
  )

// No manual channel.send() here — the Realtime subscription posts the public
// "now open" embed when the DB row changes. See claim.ts for rationale.

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
    const slot  = interaction.options.getString('slot', true) as 'photo' | 'words'
    const field = slot === 'photo' ? 'photographer_id' : 'writer_id'
    const today = todayLondon()

    const { data: shows } = await supabase
      .from('shows')
      .select('id, artist, show_date')
      .ilike('artist', `%${artist}%`)
      .gte('show_date', today)
      .eq(field, user.id)

    if (!shows?.length) {
      await interaction.editReply(`No upcoming shows matching "${artist}" where you hold the ${slot} slot.`)
      return
    }
    // Same guard as /claim — releasing shows[0] blind could unclaim the
    // wrong date when an artist has multiple upcoming shows.
    if (shows.length > 1) {
      const list = shows.map(s => `• ${s.artist} — ${fmtDate(s.show_date)}`).join('\n')
      await interaction.editReply(`Multiple matches — be more specific:\n${list}`)
      return
    }

    const show = shows[0]
    // .eq(field, user.id) on the write: only clears the slot if it is still
    // yours at write time.
    const { data: updated, error } = await supabase
      .from('shows')
      .update({ [field]: null })
      .eq('id', show.id)
      .eq(field, user.id)
      .select('id')

    if (error || !updated?.length) {
      await interaction.editReply('Could not release the slot — it may have just changed. Check the board and try again.')
      return
    }

    await interaction.editReply(`Released the ${slot} slot for **${show.artist}**.`)

  } else if (sub === 'review') {
    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, artist')
      .ilike('artist', `%${artist}%`)
      .eq('assignee_id', user.id)

    if (!reviews?.length) {
      await interaction.editReply(`No reviews matching "${artist}" assigned to you.`)
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
      .update({ assignee_id: null })
      .eq('id', review.id)
      .eq('assignee_id', user.id)
      .select('id')

    if (error || !updated?.length) {
      await interaction.editReply('Could not release the review — it may have just changed. Check the board and try again.')
      return
    }

    await interaction.editReply(`Released the review for **${review.artist}**.`)
  }
}
