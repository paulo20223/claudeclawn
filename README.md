![ClaudeClaw](images/banner.png)

**Claude Code plugin that runs as a background daemon with Telegram, cron jobs, web dashboard, and voice transcription.**

- 🤖 Telegram bot with voice, images, and stickers
- 💬 MTProto client — chat tracking, summaries, draft replies
- ⏰ Cron jobs from Markdown files with notifications
- 🌐 Web dashboard with settings and logs
- 🎙 Voice transcription via Whisper.cpp
- 🧩 12 built-in skills (planner, notes, YouTube, and more)
- 🐳 Docker-ready with separate services
- 🔒 4 security levels, fallback models, hot-reload

## Quick Start

```bash
git clone https://github.com/moazbuilds/claudeclaw.git
cd claudeclaw
cp .env.example .env    # fill in your keys
task setup              # build + auth + language
task up                 # start all services
```

Dashboard: `http://localhost:4632`

## Configuration

Settings live in `.claude/claudeclaw/settings.json`. Edit directly or use the web dashboard.

```jsonc
{
  "model": "",              // e.g. "opus", "sonnet", "haiku" (empty = default)
  "timezone": "UTC",        // IANA timezone, e.g. "Europe/Moscow"
  "language": "Русский",
  "security": {
    "level": "moderate"     // "locked" | "strict" | "moderate" | "unrestricted"
  },
  "telegram": {
    "token": "",            // BotFather token
    "allowedUserIds": []    // Telegram user IDs (numbers)
  },
  "web": {
    "enabled": false,
    "port": 4632
  }
}
```

## Production

Uses `docker-compose.prod.yml` with [nginx-proxy](https://github.com/nginx-proxy/nginx-proxy).

Create `.env.claw`:

```
VIRTUAL_HOST=your-domain.com
```

```bash
docker compose -f docker-compose.prod.yml up -d
```

Three services: `bot` (daemon + web), `tg` (MTProto), `stt` (Whisper).
Port 4632 is proxied through nginx-proxy.
