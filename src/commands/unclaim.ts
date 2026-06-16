import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from 'discord.js'
import { supabase } from '../supabase'
import { getOrCreateUser } from '../lib/getOrCreateUser'
import { fmtDate } from '../types'

export const data = new SlashCommandBuilder()
  .setName('unclaim')
  .setDescription('Release a show slot or review')
  .addSubcommand(sub =>
    sub
      .setName('show')
      .setDescription('Release your photographer or writer slot')
      .addStringOption(o => o.setName('artist').setDescription('Artist name (partial match)').setRequired(true))
      .addStringOption(o =>
        o.setName('slot')
          .setDescription('Which slot to release')
          .setRequired(true)
          .addChoices({ name: 'Photo', value: 'photo' }, { name: 'Words', value: 'words' })
      )
  )
  .addSubcommand(sub =>
    sub
      .setName('review')
      .setDescription('Release a review you have claimed')
      .addStringOption(o => o.setName('artist').setDescription('Artist name (partial match)').setRequired(true))
  )

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true })

  const user = await getOrCreateUser(interaction.user)
  if (!user) {
    await interaction.editReply('Could not look up your Boolin Tunes profile. Try again in a moment.')
    return
  }

  const sub    = interaction.options.getSubcommand()
  const artist = interaction.options.getString('artist', true)

  if (sub === 'show') {
    const slot  = interaction.options.getString('slot', true) as 'photo' | 'words'
    const field = slot === 'photo' ? 'photographer_id' : 'writer_id'
    const today = new Date().toISOString().split('T')[0]

    const { data: shows } = await supabase
      .from('shows')
      .select('id, artist, show_date')
      .ilike('artist', `%${artist}%`)
      .gte('show_date', today)
      .eq(field, user.id)

    if (!shows?.length) {
      await interaction.editReply(`No upcoming shows matching "${artist}" where you hold the ${slot} slot.`)
      return
    }

    const show = shows[0]
    await supabase.from('shows').update({ [field]: null }).eq('id', show.id)

    const msg = `⚠️ **${user.name}** unclaimed the **${slot}** slot for **${show.artist}** (${fmtDate(show.show_date)}) — now open`
    const channel = interaction.channel
    if (channel instanceof TextChannel) await channel.send(msg)

    await interaction.editReply(`Released the ${slot} slot for **${show.artist}**.`)

  } else if (sub === 'review') {
    const { data: reviews } = await supabase
      .from('reviews')
      .select('id, artist')
      .ilike('artist', `%${artist}%`)
      .eq('assignee_id', user.id)

    if (!reviews?.length) {
      await interaction.editReply(`No reviews matching "${artist}" assigned to you.`)
      return
    }

    const review = reviews[0]
    await supabase.from('reviews').update({ assignee_id: null }).eq('id', review.id)

    const msg = `⚠️ **${user.name}** unclaimed the review for **${review.artist}** — now open`
    const channel = interaction.channel
    if (channel instanceof TextChannel) await channel.send(msg)

    await interaction.editReply(`Released the review for **${review.artist}**.`)
  }
}
