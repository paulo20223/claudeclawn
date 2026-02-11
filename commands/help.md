---
description: Show heartbeat plugin help
---

Display this help information to the user:

**Claude Heartbeat** — a cron-like daemon that runs Claude prompts on a schedule.

**Commands:**
- `/heartbeat:start` — Initialize config and start the daemon
- `/heartbeat:stop` — Stop the running daemon
- `/heartbeat:status` — Show daemon status, countdowns, and config
- `/heartbeat:logs` — Show recent execution logs (accepts count or job name filter)
- `/heartbeat:help` — Show this help message

**How it works:**
- The daemon runs in the background checking your schedule every 60 seconds
- A **heartbeat** prompt runs at a fixed interval (default: every 15 minutes)
- **Jobs** are markdown files in `.claude/heartbeat/jobs/` with cron schedules
- The statusline shows a live countdown to the next run

**Configuration:**
- `.claude/heartbeat/settings.json` — Main config (heartbeat interval, prompt, enabled)
- `.claude/heartbeat/jobs/*.md` — Cron jobs with schedule frontmatter and a prompt body

**Job file format:**
```markdown
---
schedule: "0 9 * * *"
---
Your prompt here. Claude will run this at the scheduled time.
```

Schedule uses standard cron syntax: `minute hour day-of-month month day-of-week`
