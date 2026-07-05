import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { supabase } from '../supabase'
import { discordDate, todayLondon } from '../types'
import { brandEmbed, BRAND } from '../embeds'

export const data = new SlashCommandBuilder()
  .setName('shows')
  .setDescription('Lists all upcoming fully confirmed shows')

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const today = todayLondon()

  const { data: shows, error } = await supabase
    .from('shows')
    .select(`
      *,
      photographer:users!shows_photographer_id_fkey(name),
      writer:users!shows_writer_id_fkey(name)
    `)
    .eq('status', 'fully_confirmed')
    .gte('show_date', today)
    .order('show_date', { ascending: true })

  if (error) {
    await interaction.editReply('Error fetching shows.')
    return
  }

  if (!shows || shows.length === 0) {
    await interaction.editReply('No fully confirmed upcoming shows yet.')
    return
  }

  const embed = brandEmbed(BRAND.sage)
    .setTitle('Fully Confirmed Shows')

  const lines = shows.map((s: any) => {
    const photo = s.photographer?.name ?? '—'
    const words = s.writer?.name ?? '—'
    return `**${s.artist}** — ${discordDate(s.show_date)} · ${s.location}\n└ 📸 ${photo} · ✍️ ${words}`
  })

  const chunks: string[] = []
  let current = ''
  for (const line of lines) {
    if ((current + '\n\n' + line).length > 1000) { chunks.push(current); current = line }
    else current = current ? current + '\n\n' + line : line
  }
  if (current) chunks.push(current)

  chunks.forEach((chunk, i) => {
    embed.addFields({ name: i === 0 ? `${shows.length} show(s)` : '\u200b', value: chunk })
  })

  await interaction.editReply({ embeds: [embed] })
}
