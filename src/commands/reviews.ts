import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js'
import { supabase } from '../supabase'
import { fmtWeekDate, todayLondon } from '../types'

export const data = new SlashCommandBuilder()
  .setName('reviews')
  .setDescription('Lists unassigned reviews for the current and next NMF week')

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  // Get the two nearest upcoming weeks
  const today = todayLondon()
  const { data: weeks, error: weeksError } = await supabase
    .from('nmf_weeks')
    .select('id, week_date')
    .gte('week_date', today)
    .order('week_date', { ascending: true })
    .limit(2)

  if (weeksError || !weeks?.length) {
    await interaction.editReply('No upcoming NMF weeks found.')
    return
  }

  const weekIds = weeks.map(w => w.id)

  const { data: reviews, error } = await supabase
    .from('reviews')
    .select('*, nmf_week:nmf_weeks(week_date)')
    .in('nmf_week_id', weekIds)
    .is('assignee_id', null)
    .neq('status', 'done')
    .order('nmf_week_id')
    .order('artist')

  if (error) {
    await interaction.editReply('Error fetching reviews.')
    return
  }

  if (!reviews?.length) {
    await interaction.editReply('✅ No unassigned reviews for the next two weeks.')
    return
  }

  const embed = new EmbedBuilder()
    .setTitle('Unassigned Reviews')
    .setColor(0x6366f1)

  // Group by week
  const byWeek = new Map<string, typeof reviews>()
  for (const r of reviews) {
    const key = r.nmf_week_id
    if (!byWeek.has(key)) byWeek.set(key, [])
    byWeek.get(key)!.push(r)
  }

  for (const [weekId, weekReviews] of byWeek) {
    const week = weeks.find(w => w.id === weekId)
    const weekLabel = week ? `w/c ${fmtWeekDate(week.week_date)}` : 'Unknown week'
    const lines = weekReviews.map(r => `• **${r.artist}**`)
    embed.addFields({ name: weekLabel, value: lines.join('\n') || '—' })
  }

  embed.setFooter({ text: 'Use /claim review [artist] to take one' })

  await interaction.editReply({ embeds: [embed] })
}
