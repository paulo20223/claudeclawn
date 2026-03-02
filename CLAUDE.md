# ClaudeClaw

Background daemon plugin for Claude Code: Telegram bot, cron jobs, web dashboard, voice transcription.

## Dev commands

```bash
bun run start                # Launch daemon (default command)
bun run dev:web              # Watch mode + web dashboard
bun run telegram             # Telegram bot (Bot API polling)
bun run status               # Show running instance status
bun run mtcute               # MTProto gateway server
bun run mtcute:auth          # Authorize MTProto session
```

Task runner (Docker workflow):

```bash
task setup        # Full setup: build → lang → auth → tg auth
task build        # Build Docker image
task up / down    # Start / stop containers
task tg:auth      # Authorize mtcute inside Docker
task logs         # Follow container logs
task deploy       # Deploy to production via SSH
```

## Architecture

**Runtime**: Bun + TypeScript (ESNext). Single external dep: `@mtcute/bun` for MTProto.

**Execution model**: `runner.ts` spawns `claude` CLI as subprocess via `Bun.spawn`. A serial promise queue prevents concurrent `--resume` on the same session. On rate limit detection, falls back to alternate model/API configured in settings.

**Main loop** (`src/commands/start.ts`, ~650 lines):
1. Initializes config, session, optional services (web, telegram, mtcute)
2. Runs cron job check every 60s
3. Hot-reloads settings and jobs every 30s
4. Processes telegram messages via queue

**Data flow**: Telegram message → handler → runner queue → claude CLI → response → Telegram reply

## Key modules

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry point, command routing |
| `src/commands/start.ts` | Main daemon loop, service orchestration |
| `src/runner.ts` | Claude CLI execution, serial queue, rate limit fallback |
| `src/config.ts` | Settings from `.claude/claudeclaw/settings.json` |
| `src/jobs.ts` | Load cron jobs from Markdown + YAML frontmatter |
| `src/cron.ts` | Cron expression parser |
| `src/sessions.ts` | Global session management |
| `src/timezone.ts` | Timezone helpers for cron scheduling |
| `src/pid.ts` | Daemon PID file lifecycle |
| `src/preflight.ts` | Claude Code plugin auto-installer |
| `src/skills.ts` | Skills loader from `skills/` dirs |
| `src/statusline.ts` | Writes state.json for statusline script |
| `src/web.ts` | Re-export barrel for `./ui` |
| `src/telegram/` | Telegram Bot API: polling, handler, commands, media, stickers |
| `src/mtcute/` | MTProto gateway: chat tracking, history, notes, summaries |
| `src/ui/` | Web dashboard HTTP server |
| `prompts/` | System prompts (IDENTITY.md, SOUL.md, USER.md, BOOTSTRAP.md) |

## Patterns

**Serial queue** — `runner.ts` wraps every Claude invocation in `enqueue()`. Only one `claude --resume` runs at a time.

**Hot-reload** — `start.ts` re-reads `settings.json` and job files from disk every 30s. No restart needed for config changes.

**Cron jobs** — Markdown files with YAML frontmatter in `.claude/claudeclaw/jobs/`. Preset jobs auto-installed from `presets/jobs/` on first init. Fields: `cron`, `enabled`, `notify` (`true | false | "error"`), `script` (optional shell command instead of prompt).

**Security levels** — 4 tiers: `locked`, `strict`, `moderate` (default), `unrestricted`. Configured in settings, passed to claude CLI.

**Prompt resolution** — Strings ending in `.md`, `.txt`, `.prompt` are treated as file paths and read from disk.

## Project structure

```
src/
  commands/        # CLI commands (start, stop, status, send, telegram, mtcute)
  telegram/        # Bot API integration (polling + webhook-style handler)
  mtcute/          # MTProto client/gateway (userbot features)
  ui/              # Web dashboard (SPA served via Bun HTTP)
prompts/           # System prompt files injected into claude sessions
presets/jobs/      # Default cron job templates (copied to data dir on init)
skills/            # Claude Code skills (planner, chat tools, sticker packs, etc.)
data/              # Runtime data (gitignored): jobs, logs, session, settings
  jobs/            # Active cron job definitions (.md)
  logs/            # Execution logs
  settings.json    # Runtime configuration
```

Data directory at runtime: `.claude/claudeclaw/` (relative to cwd).

## Environment variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `CLAUDECLAW_WEB_TOKEN` | bot | Auth token for web dashboard |
| `CLAUDECLAW_WEB_HOST` | bot | Web bind address (default `127.0.0.1`, Docker sets `0.0.0.0`) |
| `STT_URL` | bot | Whisper STT service URL (e.g. `http://stt:8080`) |
| `MTCUTE_URL` | bot, tg | MTProto gateway URL (default `http://tg:3000`) |
| `MTCUTE_API_ID` | tg | Telegram API ID for MTProto |
| `MTCUTE_API_HASH` | tg | Telegram API hash for MTProto |
| `MTCUTE_SESSION_NAME` | tg | Session name (default `claudeclaw`) |
| `MTCUTE_PORT` | tg | Gateway listen port (default `3000`) |

## Docker services

| Service | Image | Purpose |
|---------|-------|---------|
| `bot` | Dockerfile (bun + node + claude CLI) | Main daemon with web dashboard on `:4632` |
| `tg` | Same Dockerfile | MTProto gateway server |
| `stt` | `ghcr.io/ggml-org/whisper.cpp:main` | Speech-to-text (Whisper) |
