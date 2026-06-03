# Boolin Tunes Discord Bot

Replaces ClickUp's Discord integration with a purpose-built bot. Posts notifications when shows or reviews are added/updated, and responds to slash commands for surfacing unclaimed work.

---

## Setup

### 1. Create a Discord bot

1. Go to [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Name it `Boolin Tunes`
3. Go to **Bot** → **Add Bot**
4. Under **Token**, click **Reset Token** and copy it → `DISCORD_BOT_TOKEN`
5. Under **Privileged Gateway Intents**, enable **Server Members Intent**
6. Go to **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot permissions: `Send Messages`, `Embed Links`, `Read Message History`
7. Copy the generated URL, open it, and add the bot to your server

### 2. Get IDs

In Discord, go to **User Settings → Advanced** and enable **Developer Mode**.

Then right-click:
- Your **server** → Copy Server ID → `DISCORD_GUILD_ID`
- **#live-content-chat** → Copy Channel ID → `DISCORD_LIVE_CHANNEL_ID`
- **#content-chat** → Copy Channel ID → `DISCORD_CONTENT_CHANNEL_ID`

Go to your Discord app page → **General Information** → copy **Application ID** → `DISCORD_CLIENT_ID`

### 3. Get Supabase service role key

Supabase Dashboard → Project Settings → API → **Legacy anon, service_role API keys** tab → copy the `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Configure env

```bash
cp .env.example .env
# Fill in all values
```

### 5. Install and run

```bash
npm install

# Register slash commands with Discord (run once, or when commands change)
npm run deploy-commands

# Start the bot
npm run dev          # development
npm run build && npm start  # production
```

---

## Deploying to Railway

1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add all env vars in Railway's Variables tab
4. Set the start command to `npm run build && npm start`
5. Deploy — Railway keeps it running persistently

---

## What it does

### Notifications (Phase 1)
Listens to Supabase Realtime and posts to Discord automatically:

**#live-content-chat** — when a show is added, status changes, or slots are claimed/unclaimed

**#content-chat** — when a new NMF week is created, a review is added, claimed, or marked done

### Commands (Phase 2)
- `/help` — lists all commands
- `/unclaimed` — shows with open photo or words slots
- `/shows` — fully confirmed upcoming shows
- `/reviews` — unassigned reviews for current and next NMF week
