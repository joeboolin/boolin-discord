import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  AttachmentBuilder,
} from 'discord.js'
import { supabase } from '../supabase'

export const data = new SlashCommandBuilder()
  .setName('exportroster')
  .setDescription('Export the full PR roster as a CSV file')

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true })

  const { data: roster, error } = await supabase
    .from('pr_roster')
    .select(`
      company,
      name,
      type,
      source_url
    `)
    .order('company')
    .order('name')

  if (error || !roster) {
    await interaction.editReply(`❌ Database error: ${error?.message}`)
    return
  }

  // Fetch contacts for each company
  const { data: contacts } = await supabase
    .from('pr_contacts')
    .select('company, name, email')
    .order('company')
    .order('name')

  // Index contacts by company
  const contactMap: Record<string, string> = {}
  for (const c of contacts ?? []) {
    if (!contactMap[c.company]) {
      contactMap[c.company] = c.email
    }
  }

  // Build CSV
  const rows = [
    ['Company', 'Artist', 'Type', 'Primary Contact Email', 'Source URL'],
    ...roster.map(r => [
      r.company,
      r.name,
      r.type,
      contactMap[r.company] ?? '',
      r.source_url ?? '',
    ]),
  ]

  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const date = new Date().toISOString().split('T')[0]
  const filename = `pr-roster-${date}.csv`
  const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), { name: filename })

  await interaction.editReply({
    content: `📎 PR roster — ${roster.length} entries`,
    files: [attachment],
  })
}
