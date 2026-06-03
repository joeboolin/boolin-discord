import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { supabase } from '../supabase'

export const data = new SlashCommandBuilder()
  .setName('register')
  .setDescription('Link your Discord account to your Boolin Tunes profile')
  .addStringOption(o =>
    o.setName('email')
      .setDescription('Your Boolin Tunes email address')
      .setRequired(true)
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const email = interaction.options.getString('email', true).toLowerCase().trim()

  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, discord_id')
    .eq('email', email)
    .single()

  if (error || !user) {
    await interaction.editReply(
      `No account found for **${email}**. Make sure you're using the email address on your Boolin Tunes profile.`
    )
    return
  }

  if (user.discord_id && user.discord_id !== interaction.user.id) {
    await interaction.editReply(
      'That account is already linked to a different Discord user. Contact Joe or Dobbin to reset it.'
    )
    return
  }

  if (user.discord_id === interaction.user.id) {
    await interaction.editReply(`Already registered as **${user.name}** — you're good to go.`)
    return
  }

  await supabase
    .from('users')
    .update({ discord_id: interaction.user.id })
    .eq('id', user.id)

  await interaction.editReply(
    `✅ Registered as **${user.name}**. You can now use \`/claim\`, \`/unclaim\`, and \`/done\`.`
  )
}
