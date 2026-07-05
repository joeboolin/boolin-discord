import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { supabase } from '../supabase'
import { Show, discordDate, todayLondon } from '../types'
import { brandEmbed, BRAND } from '../embeds'
import { cmd } from '../commandMentions'

export const data = new SlashCommandBuilder()
  .setName('unclaimed')
  .setDescription('Lists upcoming shows with open photographer or writer slots')

// Month label for grouping, in UK time to match show dates
function monthKey(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(new Date(iso + 'T12:00:00Z'))
}

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

  const embed = brandEmbed(BRAND.sand)
    .setTitle(`Open Slots — ${shows.length} show${shows.length !== 1 ? 's' : ''}`)
    .setFooter({ text: 'Claim with /claim show — tap a command chip below' })

  // Group by month (dates are already sorted, so months come out in order)
  const byMonth = new Map<string, Show[]>()
  for (const s of shows as Show[]) {
    const key = monthKey(s.show_date)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key)!.push(s)
  }

  for (const [month, monthShows] of byMonth) {
    const lines = monthShows.map(s => {
      const chips: string[] = []
      if (!s.photographer_id) chips.push('`📸 Photo`')
      if (!s.writer_id)       chips.push('`✍️ Words`')
      return `**${s.artist}** — ${discordDate(s.show_date)} · ${s.location}\n${chips.join(' ')}`
    })

    // Field values cap at 1024 chars — continue into unnamed fields if a
    // month overflows
    let current = ''
    let first = true
    const flush = () => {
      if (!current) return
      embed.addFields({
        name: first ? `${month} (${monthShows.length})` : '\u200b',
        value: current,
      })
      first = false
      current = ''
    }
    for (const line of lines) {
      if ((current + '\n\n' + line).length > 1000) flush()
      current = current ? current + '\n\n' + line : line
    }
    flush()
  }

  embed.setDescription(`Take one with ${cmd('claim show')}`)

  await interaction.editReply({ embeds: [embed] })
}
