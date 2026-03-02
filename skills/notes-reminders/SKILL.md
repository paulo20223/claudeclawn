---
name: notes-reminders
description: Notes and reminders manager. Trigger phrases include "заметка", "запиши", "записать", "заметки", "напомни", "напоминание", "напоминания", "напомнить", "remind", "reminder", "note", "notes", "записка", "пометка", "не забыть", "запомни на будущее", "сохрани заметку", "список напоминаний", "что записано", "покажи заметки".
---

# Notes & Reminders

You manage the user's notes and reminders through natural language. Notes are reference information (like Apple Notes), reminders are time-triggered notifications (like Apple Reminders) that create cron jobs.

## Storage

All data lives in `.claude/claudeclaw/`:

```
notes/
  index.yaml          # Note registry (metadata)
  content/
    <id>.md            # Note bodies (pure markdown)
reminders/
  index.yaml           # Reminder registry
jobs/
  reminder-<id>.md     # Auto-generated cron jobs
```

For detailed YAML/Markdown schemas, see [references/data-formats.md](references/data-formats.md).

## Core Workflow

### 1. Read State First

Before any action, read the relevant index file:
- For notes: `notes/index.yaml`
- For reminders: `reminders/index.yaml`
- If files don't exist yet, initialize them with defaults (see Init section)

### 2. Understand Intent

| Intent | Examples |
|--------|----------|
| **create note** | "запиши...", "заметка: ...", "сохрани заметку..." |
| **list notes** | "покажи заметки", "что записано", "заметки" |
| **search notes** | "найди заметку про...", "есть что-нибудь о..." |
| **edit note** | "обнови заметку...", "добавь в заметку..." |
| **pin note** | "закрепи заметку...", "открепи..." |
| **delete note** | "удали заметку..." |
| **create reminder** | "напомни...", "не забыть...", "remind me..." |
| **list reminders** | "напоминания", "что запланировано" |
| **complete reminder** | "готово напоминание...", "выполнено..." |
| **edit reminder** | "перенеси напоминание...", "измени время..." |
| **delete reminder** | "удали напоминание...", "отмени..." |
| **manage folders/lists** | "создай папку...", "создай список..." |

### 3. Execute

#### Init (if index files don't exist)

Create directory structure and default index files:

**notes/index.yaml**:
```yaml
next_id: 1
folders:
  - default
notes: []
```

**reminders/index.yaml**:
```yaml
next_id: 1
lists:
  - default
reminders: []
```

---

## Notes Operations

### Create Note

1. Read `notes/index.yaml`
2. Generate ID: `n` + zero-padded `next_id` (e.g. `n001`)
3. Increment `next_id`
4. Determine title from user message (or `""` for quick notes)
5. Extract tags if mentioned
6. Add entry to `notes` array with `created`/`updated` = now, `folder: default`, `pinned: false`
7. Write body to `notes/content/<id>.md`
8. Save `notes/index.yaml`

### List Notes

Show notes grouped by folder, pinned first. Format:

```
📝 Заметки:

📌 Meeting notes (n001) — work, meeting — 1 мар
Discussed Q2 roadmap...

Quick thought about API (n002) — 28 фев
Maybe we should use...
```

- Show first ~50 chars of body as preview
- For quick notes (empty title), use first line of body as title
- Show tags inline if present
- Show relative or short date

### Search Notes

1. Search by title and tags in `index.yaml`
2. If not found, grep through `notes/content/` for body matches
3. Show matching notes with highlighted context

### Edit Note

1. Find note by ID or fuzzy match on title
2. Read current body from `content/<id>.md`
3. Apply changes (append, replace, or rewrite)
4. Update `updated` timestamp in index
5. Save both files

### Pin/Unpin

Toggle `pinned` field in index.

### Delete Note

1. Remove entry from `notes` array in index
2. Delete `content/<id>.md`
3. Save index

### Folder Management

- **Create**: Add to `folders` list
- **Rename**: Update `folders` list + all notes referencing old name
- **Delete**: Only if empty (no notes in folder), otherwise warn
- **Move note**: Update note's `folder` field

---

## Reminders Operations

### Create Reminder

1. Read `reminders/index.yaml`
2. Generate ID: `r` + zero-padded `next_id` (e.g. `r001`)
3. Increment `next_id`
4. Parse user input for: text, due datetime, priority, recurring, advance
5. Defaults: `priority: medium`, `advance: 60`, `recurring: null`, `list: default`
6. Calculate cron schedule (see below)
7. Write job file to `jobs/reminder-<id>.md`
8. Add entry to `reminders` array with `status: active`, `job_file: "reminder-<id>"`
9. Save `reminders/index.yaml`

### Calculate Cron Schedule

```
notification_time = due - advance minutes
```

Extract minute (M), hour (H), day (D), month (MON), day-of-week (DOW) from notification_time.

| Type | Cron | recurring field in job |
|------|------|-----------------------|
| One-shot | `M H D MON *` | `false` |
| daily | `M H * * *` | `true` |
| weekly | `M H * * DOW` | `true` |
| monthly | `M H D * *` | `true` |

### Job File Template

```markdown
---
schedule: "<cron>"
recurring: <true|false>
notify: true
---

Напоминание<DUE_LABEL>:
**<TEXT>**
Приоритет: <PRIORITY>
```

DUE_LABEL logic (relative to notification time):
- `advance = 0` → ` (сейчас)`
- Same day → ` (сегодня в HH:MM)`
- Next day → ` (завтра в HH:MM)`
- Further → ` (DD.MM в HH:MM)`

### List Reminders

Show active reminders grouped by list, sorted by due date:

```
⏰ Напоминания:

📋 default:
- [ ] Submit tax return (r001) — high — 15 мар 18:00
- [ ] Buy groceries (r002) — medium — сегодня 19:00

✅ Выполненные (2):
- [x] Call dentist (r003) — 28 фев
```

- Active first, sorted by due ascending
- Show completed count, expand on request

### Complete Reminder

1. Find by ID or fuzzy match
2. If **not recurring**: set `status: completed`, `completed_at: now`, delete job file
3. If **recurring**: keep `status: active`, shift `due` forward:
   - daily: +1 day
   - weekly: +7 days
   - monthly: +1 month
4. Recalculate cron and rewrite job file (for recurring)
5. Save index

### Edit Reminder

1. Find reminder
2. Update fields (text, due, priority, advance, recurring, list)
3. If `due` or `advance` changed: recalculate cron, rewrite job file
4. Save index

### Delete Reminder

1. Remove from `reminders` array
2. Delete job file from `jobs/`
3. Save index

### List Management

- **Create**: Add to `lists`
- **Rename**: Update `lists` + all reminders referencing old name
- **Delete**: Only if empty

---

## Parsing Natural Language

### Due Time Parsing

| Input | Parsed as |
|-------|-----------|
| "через час" | now + 1h |
| "через 30 минут" | now + 30m |
| "завтра" | tomorrow 09:00 |
| "завтра в 15:00" | tomorrow 15:00 |
| "в пятницу" | next Friday 09:00 |
| "15 марта" | March 15 09:00 |
| "15.03 в 18:00" | March 15 18:00 |
| "каждый день в 9" | daily, 09:00 |
| "каждую неделю" | weekly, same time |
| "каждый месяц" | monthly, same day/time |

Default time if not specified: `09:00`.

### Priority

- "важно", "срочно", "high" → `high`
- "неважно", "low", "потом" → `low`
- Default: `medium`

## Response Style

- Concise, friendly, in Russian
- After creating: confirm with key details (ID, due, etc.)
- After listing: structured format as shown above
- Keep responses short unless user asks for details
