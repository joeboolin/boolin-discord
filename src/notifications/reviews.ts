import { TextChannel } from 'discord.js'
import { supabase } from '../supabase'
import { brandEmbed, BRAND } from '../embeds'
import { cmd } from '../commandMentions'
import { Review, NmfWeek, fmtWeekDate } from '../types'

const COLOURS = {
  added:     BRAND.ink,
  claimed:   BRAND.sage,
  unclaimed: BRAND.sand,
  done:      BRAND.sage,
  removed:   BRAND.red,
  week:      BRAND.ink, // new content week announcements
}

async function getUserName(userId: string | null): Promise<string> {
  if (!userId) return 'Unassigned'
  const { data } = await supabase.from('users').select('name').eq('id', userId).single()
  return data?.name ?? 'Unknown'
}

async function getWeekDate(weekId: string): Promise<string> {
  const { data } = await supabase.from('nmf_weeks').select('week_date').eq('id', weekId).single()
  return data?.week_date ? fmtWeekDate(data.week_date) : 'Unknown week'
}

export async function onReviewInserted(review: Review, channel: TextChannel): Promise<void> {
  const weekDate  = await getWeekDate(review.nmf_week_id)
  const assignee  = review.assignee_id ? await getUserName(review.assignee_id) : null

  const embed = brandEmbed(COLOURS.added)
    .setTitle(review.artist)
    .setDescription(
      assignee
        ? `Added to **w/c ${weekDate}** — assigned to **${assignee}**`
        : `Added to **w/c ${weekDate}** — unassigned`
    )
    .setFooter(assignee ? null : { text: `Take it: /claim review ${review.artist}` })

  await channel.send({ embeds: [embed] })
}

export async function onReviewUpdated(
  oldReview: Review,
  newReview: Review,
  channel: TextChannel
): Promise<void> {
  // Claimed
  if (!oldReview.assignee_id && newReview.assignee_id) {
    const name = await getUserName(newReview.assignee_id)
    const embed = brandEmbed(COLOURS.claimed)
      .setTitle(newReview.artist)
      .setDescription(`✍️ **${name}** claimed this review`)
    await channel.send({ embeds: [embed] })
    return
  }

  // Unclaimed
  if (oldReview.assignee_id && !newReview.assignee_id) {
    const name = await getUserName(oldReview.assignee_id)
    const embed = brandEmbed(COLOURS.unclaimed)
      .setTitle(newReview.artist)
      .setDescription(`**${name}** unclaimed this review — now open`)
    await channel.send({ embeds: [embed] })
    return
  }

  // Done
  if (oldReview.status !== 'done' && newReview.status === 'done') {
    const name = await getUserName(newReview.assignee_id)
    const embed = brandEmbed(COLOURS.done)
      .setTitle(newReview.artist)
      .setDescription(`✅ Review marked done by **${name}**`)
    await channel.send({ embeds: [embed] })
  }
}

export async function onWeekInserted(week: NmfWeek, channel: TextChannel): Promise<void> {
  const { count } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('nmf_week_id', week.id)
    .is('assignee_id', null)

  const embed = brandEmbed(COLOURS.week)
    .setTitle(`New Content Week — w/c ${fmtWeekDate(week.week_date)}`)
    .setDescription(
      count && count > 0
        ? `${count} reviews unassigned. Use ${cmd('reviews')} to see them.`
        : 'No reviews yet — add some via the internal site.'
    )

  await channel.send({ embeds: [embed] })
}
