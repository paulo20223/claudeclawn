# Data Formats Reference

## Notes

### notes/index.yaml

```yaml
next_id: 1

folders:
  - default

notes:
  - id: n001
    title: "Meeting notes"        # "" for quick notes (display first line of body)
    folder: default
    tags: [work, meeting]         # optional, [] if none
    pinned: false
    created: "2026-03-01T14:30:00"
    updated: "2026-03-01T15:10:00"
```

**ID format**: `n` + zero-padded 3-digit number (`n001`, `n002`, ...). Increment `next_id` after each creation.

**Folders**: flat list of strings. `default` always exists. Notes reference folder by name.

### notes/content/<id>.md

Pure markdown, no frontmatter. The file name matches the note ID.

```markdown
# Meeting notes

Discussed Q2 roadmap with the team.

## Action items
- Review budget proposal
- Schedule follow-up
```

For quick notes (title is `""`), the first non-empty line of the body is used as display title.

## Reminders

### reminders/index.yaml

```yaml
next_id: 1

lists:
  - default

reminders:
  - id: r001
    text: "Submit tax return"
    list: default
    priority: high               # low | medium | high
    due: "2026-03-15T18:00"      # ISO datetime
    advance: 1440                # minutes before due for notification (1440 = 1 day)
    recurring: null              # null | daily | weekly | monthly
    status: active               # active | completed
    completed_at: null           # ISO datetime when completed
    created: "2026-03-01T10:00:00"
    job_file: "reminder-r001"    # name of .md file in jobs/ (without extension)
```

**ID format**: `r` + zero-padded 3-digit number (`r001`, `r002`, ...). Increment `next_id` after each creation.

**Lists**: flat list of strings. `default` always exists.

**Priority levels**: `low`, `medium`, `high`. Default: `medium`.

**Advance**: minutes before `due` to trigger notification. Default: `60` (1 hour). Common values:
- `0` — notify at due time
- `60` — 1 hour before
- `1440` — 1 day before

### Job File — jobs/reminder-<id>.md

Auto-generated cron job for each active reminder. Lives in `.claude/claudeclaw/jobs/`.

```markdown
---
schedule: "0 18 14 3 *"
recurring: false
notify: true
---

Напоминание (завтра в 18:00):
**Submit tax return**
Приоритет: high
```

**Frontmatter fields** (must match `src/jobs.ts` format):
- `schedule` — cron expression (minute hour day month weekday)
- `recurring` — `true` for repeating reminders, `false` for one-shot
- `notify` — always `true` for reminders

## Cron Schedule Calculation

```
notification_time = due - advance_minutes
```

From `notification_time`, extract cron fields:

| Recurring | Cron pattern | Example |
|-----------|-------------|---------|
| null (one-shot) | `M H D MON *` | `0 18 14 3 *` |
| daily | `M H * * *` | `0 9 * * *` |
| weekly | `M H * * DOW` | `0 9 * * 1` (Monday) |
| monthly | `M H DOM * *` | `0 9 15 * *` |

Where `M` = minute, `H` = hour, `D` = day, `MON` = month (1-12), `DOW` = day of week (0=Sun).

## Job Body Template

```
Напоминание{{DUE_LABEL}}:
**{{TEXT}}**
Приоритет: {{PRIORITY}}
```

`DUE_LABEL` examples:
- advance = 0: ` (сейчас)`
- advance > 0, same day: ` (сегодня в HH:MM)`
- advance > 0, next day: ` (завтра в HH:MM)`
- advance > 0, further: ` (DD.MM в HH:MM)`
