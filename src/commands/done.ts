import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from 'discord.js'
import { supabase } from '../supabase'
import { getOrCreateUser } from '../lib/getOrCreateUser'

export const data = new SlashCommandBuilder()
  .setName('done')
  .setDescription('Mark a review as done')
  .addStringOption(o => o.setName('artist').setDescription('Artist name (partial match)').setRequired(true))

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const user = await getOrCreateUser(interaction.user)
  if (!user) {
    await interaction.editReply('Could not look up your Boolin Tunes profile. Try again in a moment.')
    return
  }

  const artist = interaction.options.getString('artist', true)

  // Find a review assigned to this user matching the artist
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, artist')
    .ilike('artist', `%${artist}%`)
    .eq('assignee_id', user.id)
    .neq('status', 'done')

  if (!reviews?.length) {
    // Also try any review matching the artist regardless of assignee (admin convenience)
    const { data: any } = await supabase
      .from('reviews')
      .select('id, artist')
      .ilike('artist', `%${artist}%`)
      .neq('status', 'done')

    if (!any?.length) {
      await interaction.editReply(`No active reviews matching "${artist}".`)
      return
    }
    if (any.length > 1) {
      await interaction.editReply(`Multiple matches:\n${any.map(r => `• ${r.artist}`).join('\n')}`)
      return
    }

    await supabase.from('reviews').update({ status: 'done' }).eq('id', any[0].id)
    const msg = `✅ **${user.name}** marked **${any[0].artist}** as done`
    const ch = interaction.channel
    if (ch instanceof TextChannel) await ch.send(msg)
    await interaction.editReply(`✅ Marked **${any[0].artist}** as done.`)
    return
  }

  if (reviews.length > 1) {
    await interaction.editReply(`Multiple matches:\n${reviews.map(r => `• ${r.artist}`).join('\n')}`)
    return
  }

  await supabase.from('reviews').update({ status: 'done' }).eq('id', reviews[0].id)

  const msg = `✅ **${user.name}** marked **${reviews[0].artist}** as done`
  const ch = interaction.channel
  if (ch instanceof TextChannel) await ch.send(msg)

  await interaction.editReply(`✅ Marked **${reviews[0].artist}** as done.`)
}
