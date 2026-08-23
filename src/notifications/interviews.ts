import { TextChannel } from 'discord.js'
import { InterviewCard, interviewStatusLabel } from '../types'
import { brandEmbed, interviewStatusColour } from '../embeds'

// Deliberately quieter than shows/reviews: a new card always posts, but an
// update only posts when the status LANDS on one of these three milestones.
// Backlog <-> Requested churn (or any other move) stays silent — see
// CLAUDE.md, "Interview notifications to Discord".
const MILESTONES: ReadonlySet<string> = new Set(['confirmed', 'recorded', 'done'])

export async function onInterviewInserted(card: InterviewCard, channel: TextChannel): Promise<void> {
  const embed = brandEmbed(interviewStatusColour(card.status))
    .setTitle(card.title)
    .setDescription(`Added to the Interviews board — **${interviewStatusLabel(card.status)}**`)

  await channel.send({ embeds: [embed] })
}

export async function onInterviewUpdated(
  oldCard: InterviewCard,
  newCard: InterviewCard,
  channel: TextChannel
): Promise<void> {
  if (oldCard.status === newCard.status) return
  if (!MILESTONES.has(newCard.status)) return

  const embed = brandEmbed(interviewStatusColour(newCard.status))
    .setTitle(newCard.title)
    .setDescription(`Status changed to **${interviewStatusLabel(newCard.status)}**`)

  await channel.send({ embeds: [embed] })
}
