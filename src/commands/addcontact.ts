import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js'
import { supabase } from '../supabase'

export const data = new SlashCommandBuilder()
  .setName('addcontact')
  .setDescription('Add a PR contact to the database')
  .addStringOption(opt =>
    opt.setName('company').setDescription('PR company name (must match exactly)').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('name').setDescription('Contact name').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('email').setDescription('Contact email').setRequired(true)
  )

export async function execute(interaction: ChatInputCommandInteraction) {
  const company = interaction.options.getString('company', true).trim()
  const name    = interaction.options.getString('name', true).trim()
  const email   = interaction.options.getString('email', true).trim().toLowerCase()

  await interaction.deferReply({ ephemeral: true })

  // Verify company exists in pr_companies
  const { data: co } = await supabase
    .from('pr_companies')
    .select('company, region')
    .ilike('company', company)
    .single()

  if (!co) {
    await interaction.editReply(
      `❌ Company **${company}** not found in the database. Check the spelling or add the company first.`
    )
    return
  }

  // Upsert contact
  const { error } = await supabase
    .from('pr_contacts')
    .upsert({ company: co.company, name, email }, { onConflict: 'company,email' })

  if (error) {
    await interaction.editReply(`❌ Database error: ${error.message}`)
    return
  }

  await interaction.editReply(
    `✅ Added **${name}** (${email}) to **${co.company}**`
  )
}
