import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { supabase } from '../supabase'

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Link your Discord account to your existing Boolin Tunes profile (optional)')
  .addStringOption(o =>
    o.setName('email')
      .setDescription('Your Boolin Tunes email address')
      .setRequired(true)
  )

// /register is now optional — all commands work without it via auto-registration.
// Use this only if you want to link your Discord account to an existing profile
// (e.g. to get your real name on claims rather than your Discord display name).
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  const email = interaction.options.getString('email', true).toLowerCase().trim()

  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, discord_id')
    .eq('email', email)
    .single()

  if (error || !user) {
    await interaction.editReply(
      `No profile found for **${email}**. You can still use all bot commands — this just links your Discord to an existing profile.`
    )
    return
  }

  if (user.discord_id && user.discord_id !== interaction.user.id) {
    await interaction.editReply(
      'That profile is already linked to a different Discord account. Contact Joe or Dobbin to reset it.'
    )
    return
  }

  if (user.discord_id === interaction.user.id) {
    await interaction.editReply(`Already linked as **${user.name}** — you're good to go.`)
    return
  }

  const { error: updateError } = await supabase
    .from('users')
    .update({ discord_id: interaction.user.id })
    .eq('id', user.id)

  if (updateError) {
    await interaction.editReply('Something went wrong updating your profile. Try again or ping Joe.')
    return
  }

  await interaction.editReply(`✅ Linked as **${user.name}**. Your claims will now show your real name.`)
}
