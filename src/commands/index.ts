import { Collection, SlashCommandBuilder } from 'discord.js'
import * as help      from './help'
import * as unclaimed from './unclaimed'
import * as shows     from './shows'
import * as reviews   from './reviews'
import * as claim     from './claim'
import * as unclaim   from './unclaim'
import * as done      from './done'
import * as request   from './request'
import * as contact   from './contact'

interface Command {
  data: SlashCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
  execute: (interaction: any) => Promise<void>
}

export const commands = new Collection<string, Command>()

for (const cmd of [help, unclaimed, shows, reviews, claim, unclaim, done, request, contact]) {
  commands.set(cmd.data.name, cmd as Command)
}
