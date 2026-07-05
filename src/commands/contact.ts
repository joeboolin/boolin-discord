import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js'
import { supabase } from '../supabase'

const REGION_FLAGS: Record<string, string> = {
  UK:  '🇬🇧',
  US:  '🇺🇸',
  AUS: '🇦🇺',
  EU:  '🇪🇺',
  INT: '🌍',
}

function regionFlag(region: string | null): string {
  if (!region) return ''
  return REGION_FLAGS[region] ?? ''
}

export const data = new SlashCommandBuilder()
  .setName('contact')
  .setDescription('Look up the PR contact for an artist')
  .addStringOption(opt =>
    opt
      .setName('artist')
      .setDescription('Artist name to search for')
      .setRequired(true)
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  const query = interaction.options.getString('artist', true).trim()

  await interaction.deferReply()

  // Step 1 — find matching artists + company metadata
  const { data: results, error } = await supabase
    .from('pr_roster')
    .select(`
      name,
      company,
      pr_companies (
        website,
        region
      )
    `)
    .eq('type', 'Artist')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(10)

  if (error) {
    await interaction.editReply(`❌ Database error: ${error.message}`)
    return
  }

  if (!results || results.length === 0) {
    await interaction.editReply(
      `No PR contact found for **${query}**. They may not be on any scraped roster yet.`
    )
    return
  }

  // Group by artist name
  const grouped: Record<string, typeof results> = {}
  for (const row of results) {
    if (!grouped[row.name]) grouped[row.name] = []
    grouped[row.name].push(row)
  }

  const artistNames = Object.keys(grouped)

  if (artistNames.length > 3) {
    const list = artistNames.slice(0, 8).join(', ')
    await interaction.editReply(
      `Found ${artistNames.length} matches for **"${query}"** — try being more specific.\n> ${list}${artistNames.length > 8 ? '...' : ''}`
    )
    return
  }

  // Step 2 — fetch all contacts for the matched companies
  const companies = [...new Set(results.map(r => r.company))]
  const { data: contacts } = await supabase
    .from('pr_contacts')
    .select('company, name, email')
    .in('company', companies)
    .order('name')

  // Index contacts by company
  const contactMap: Record<string, { name: string; email: string }[]> = {}
  for (const c of contacts ?? []) {
    if (!contactMap[c.company]) contactMap[c.company] = []
    contactMap[c.company].push({ name: c.name, email: c.email })
  }

  // Build embeds
  const embeds: EmbedBuilder[] = []

  for (const artistName of artistNames) {
    const rows = grouped[artistName]
    const embed = new EmbedBuilder()
      .setTitle(`🎵 ${artistName}`)
      .setColor(0x1d291c) // BRAND.ink — brand palette, not Discord blurple

    const sections = rows.map(row => {
      const co = row.pr_companies as unknown as {
        website: string | null
        region: string | null
      } | null

      const flag    = regionFlag(co?.region ?? null)
      const heading = flag ? `${flag} **${row.company}**` : `**${row.company}**`
      const website = co?.website ? `🔗 ${co.website}` : ''

      const people = contactMap[row.company]
      const contactLines = people && people.length > 0
        ? people.map(p => `📧 ${p.name} — ${p.email}`).join('\n')
        : '📧 No contacts on record'

      return `${heading}\n${contactLines}${website ? `\n${website}` : ''}`
    })

    embed.setDescription(sections.join('\n\n'))
    embeds.push(embed)
  }

  await interaction.editReply({ embeds })
}
