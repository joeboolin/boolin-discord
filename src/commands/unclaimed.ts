import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { supabase } from '../supabase'
import { Show, fmtDate, todayLondon } from '../types'

export const data = new SlashCommandBuilder()
  .setName('unclaimed')
  .setDescription('Lists upcoming shows with open photographer or writer slots')

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const today = todayLondon()

  const { data: shows, error } = await supabase
    .from('shows')
    .select('*')
    .gte('show_date', today)
    .or('photographer_id.is.null,writer_id.is.null')
    .order('show_date', { ascending: true })

  if (error) {
    await interaction.editReply('Error fetching shows. Try again in a moment.')
    return
  }

  if (!shows || shows.length === 0) {
    await interaction.editReply('✅ All upcoming shows have both slots filled.')
    return
  }

  const embed = new EmbedBuilder()
    .setTitle('Shows with Open Slots')
    .setColor(0xf59e0b) // amber

  const lines = (shows as Show[]).map(s => {
    const slots: string[] = []
    if (!s.photographer_id) slots.push('📸 Photo')
    if (!s.writer_id)       slots.push('✍️ Words')
    return `**${s.artist}** — ${fmtDate(s.show_date)}, ${s.location}\n└ ${slots.join(' · ')}`
  })

  // Discord embed fields max 1024 chars — chunk if needed
  const chunks: string[] = []
  let current = ''
  for (const line of lines) {
    if ((current + '\n\n' + line).length > 1000) {
      chunks.push(current)
      current = line
    } else {
      current = current ? current + '\n\n' + line : line
    }
  }
  if (current) chunks.push(current)

  chunks.forEach((chunk, i) => {
    embed.addFields({ name: i === 0 ? `${shows.length} show(s)` : '\u200b', value: chunk })
  })

  await interaction.editReply({ embeds: [embed] })
}
