import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { brandEmbed, BRAND } from '../embeds'
import { cmd } from '../commandMentions'

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Lists all Boolin Tunes bot commands')

// Built at execute time (not module load) so cmd() can resolve command ids
// fetched at ready — each entry renders as a clickable mention that opens
// the command pre-filled.
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = brandEmbed(BRAND.ink)
    .setTitle('Boolin Tunes Bot — Commands')
    .setDescription('Tap any command to run it.')
    .addFields(
      {
        name: '🎸 Live Shows',
        value: [
          `${cmd('unclaimed')} — Shows with open photographer or writer slots`,
          `${cmd('shows')} — All upcoming fully confirmed shows`,
          `${cmd('request show')} — Add a new show to the board`,
          `${cmd('claim show')} — Claim a photo/words slot on a show`,
          `${cmd('unclaim show')} — Release your slot`,
        ].join('\n'),
      },
      {
        name: '📝 Content Board',
        value: [
          `${cmd('reviews')} — Unassigned reviews for current and next NMF week`,
          `${cmd('claim review')} — Assign yourself to a review`,
          `${cmd('unclaim review')} — Release a review`,
          `${cmd('done')} — Mark a review as done`,
        ].join('\n'),
      },
      {
        name: '📇 PR Tools',
        value: [
          `${cmd('contact')} — Look up the PR contact for an artist`,
          `${cmd('addcontact')} — Add a PR contact to the database`,
          `${cmd('exportroster')} — Export a company roster`,
        ].join('\n'),
      }
    )
    .setFooter({ text: 'No registration needed — first command auto-links your account' })

  await interaction.reply({ embeds: [embed], ephemeral: true })
}
