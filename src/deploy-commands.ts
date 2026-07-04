import 'dotenv/config'
import { REST, Routes } from 'discord.js'
import * as help      from './commands/help'
import * as unclaimed from './commands/unclaimed'
import * as shows     from './commands/shows'
import * as reviews   from './commands/reviews'
import * as claim     from './commands/claim'
import * as unclaim   from './commands/unclaim'
import * as done      from './commands/done'
import * as request   from './commands/request'
import * as contact  from './commands/contact'
import * as addcontact   from './commands/addcontact'
import * as exportroster from './commands/exportroster'

const token    = process.env.DISCORD_BOT_TOKEN!
const clientId = process.env.DISCORD_CLIENT_ID!
const guildId  = process.env.DISCORD_GUILD_ID

const commandData = [help, unclaimed, shows, reviews, claim, unclaim, done, request, contact, addcontact, exportroster]
  .map(c => c.data.toJSON())

const rest = new REST().setToken(token)

;(async () => {
  try {
    console.log(`Registering ${commandData.length} slash commands…`)
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData })
      console.log(`✓ Registered to guild ${guildId} (instant)`)
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commandData })
      console.log('✓ Registered globally (may take up to 1 hour)')
    }
  } catch (err) {
    console.error('Failed to register commands:', err)
    process.exit(1)
  }
})()
