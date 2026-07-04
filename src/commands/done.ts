import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { supabase, getOrCreateUser } from '../supabase'

export const data = new SlashCommandBuilder()
  .setName('done')
  .setDescription('Mark a review as done')
  .addStringOption(o => o.setName('artist').setDescription('Artist name (partial match)').setRequired(true))

// No manual channel.send() here — the status change fires the Realtime
// "marked done" embed. See claim.ts for rationale.

// Shared: flip one review to done, race-safe (.neq guard on the write) and
// with the error actually checked before we congratulate anyone.
async function markDone(
  interaction: ChatInputCommandInteraction,
  review: { id: string; artist: string }
): Promise<void> {
  const { data: updated, error } = await supabase
    .from('reviews')
    .update({ status: 'done' })
    .eq('id', review.id)
    .neq('status', 'done')
    .select('id')

  if (error) {
    await interaction.editReply('Database error while updating — try again in a moment.')
    return
  }
  if (!updated?.length) {
    await interaction.editReply(`**${review.artist}** is already marked done.`)
    return
  }

  await interaction.editReply(`✅ Marked **${review.artist}** as done.`)
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const user = await getOrCreateUser(
    interaction.user.id,
    interaction.member && 'displayName' in interaction.member
      ? interaction.member.displayName
      : interaction.user.displayName ?? interaction.user.username
  )

  const artist = interaction.options.getString('artist', true)

  // Find a review assigned to this user matching the artist
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, artist')
    .ilike('artist', `%${artist}%`)
    .eq('assignee_id', user.id)
    .neq('status', 'done')

  if (!reviews?.length) {
    // Also try any review matching the artist regardless of assignee
    // (deliberate: lets editors close out someone else's finished review)
    const { data: unassigned } = await supabase
      .from('reviews')
      .select('id, artist')
      .ilike('artist', `%${artist}%`)
      .neq('status', 'done')

    if (!unassigned?.length) {
      await interaction.editReply(`No active reviews matching "${artist}".`)
      return
    }
    if (unassigned.length > 1) {
      await interaction.editReply(`Multiple matches:\n${unassigned.map(r => `• ${r.artist}`).join('\n')}`)
      return
    }

    await markDone(interaction, unassigned[0])
    return
  }

  if (reviews.length > 1) {
    await interaction.editReply(`Multiple matches:\n${reviews.map(r => `• ${r.artist}`).join('\n')}`)
    return
  }

  await markDone(interaction, reviews[0])
}
