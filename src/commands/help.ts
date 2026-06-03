import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js'

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Lists all Boolin Tunes bot commands')

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('Boolin Tunes Bot — Commands')
    .setColor(0x4a5c3a)
    .addFields(
      {
        name: '🎸 Live Shows',
        value: [
          '`/unclaimed` — Shows with open photographer or writer slots',
          '`/shows` — All upcoming fully confirmed shows',
          '`/request show [artist] [date] [location]` — Add a new show to the board',
          '`/claim show [artist] photo|words` — Claim a slot on an existing show',
          '`/unclaim show [artist] photo|words` — Release your slot',
        ].join('\n'),
      },
      {
        name: '📝 Content Board',
        value: [
          '`/reviews` — Unassigned reviews for current and next NMF week',
          '`/claim review [artist]` — Assign yourself to a review',
          '`/unclaim review [artist]` — Release a review',
          '`/done [artist]` — Mark a review as done',
        ].join('\n'),
      },
      {
        name: '👤 Account',
        value: '`/register [email]` — Link your Discord account to your Boolin Tunes profile',
      }
    )
    .setFooter({ text: 'Boolin Tunes Internal' })

  await interaction.reply({ embeds: [embed], ephemeral: true })
}
