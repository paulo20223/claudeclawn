---
name: manage-jobs
description: Create, edit, list, and delete ClaudeClaw cron jobs. Use when users ask to create a job, new job, add a job, edit a job, change job schedule, delete a job, remove a job, list jobs, show jobs, view jobs, cron job, schedule a job, recurring job, set up a notification, automate a task on schedule, change cron expression, modify job, job format, or mention files in .claude/claudeclaw/jobs/. Trigger phrases include "создай джоб", "новый джоб", "добавь джоб", "измени джоб", "отредактируй джоб", "удали джоб", "покажи джобы", "список джобов", "расписание джоба", "крон джоб".
---

# Manage Jobs

Управление cron-джобами ClaudeClaw. Используй `$ARGUMENTS` для определения действия.

## Формат джоба

Джобы — Markdown-файлы с YAML frontmatter в `.claude/claudeclaw/jobs/`. Имя файла = имя джоба.

```markdown
---
recurring: true
schedule: "30 9 * * 1-5"
notify: true
---

Текст промпта для Claude или shell-команда.
```

### Поля frontmatter

| Поле | Тип | Обязательное | Default | Описание |
|------|-----|:---:|---------|----------|
| `schedule` | string | да | — | Cron-выражение (5 полей) |
| `recurring` | boolean | да | — | `true` — повторяющийся, `false` — одноразовый |
| `notify` | `true` / `false` / `"error"` | нет | `true` | Отправлять результат в Telegram |
| `type` | `"prompt"` / `"script"` | нет | `"prompt"` | `prompt` — текст для Claude, `script` — shell-команда |
| `format` | `"plain"` / `"html"` / `"markdown"` | нет | `"plain"` | Формат сообщения в Telegram |

**Алиасы:** `daily` работает как `recurring`.

### Cron-синтаксис

```
┌──────── минуты (0-59)
│ ┌────── часы (0-23)
│ │ ┌──── день месяца (1-31)
│ │ │ ┌── месяц (1-12)
│ │ │ │ ┌ день недели (0-6, 0=вс)
│ │ │ │ │
* * * * *
```

Поддерживается: `*`, диапазоны `1-5`, списки `1,3,5`, шаг `*/15`, комбинации `1-5/2`.

**Частые паттерны:**

| Расписание | Выражение |
|-----------|-----------|
| Каждый день в 9:00 | `0 9 * * *` |
| Будни в 9:30 | `30 9 * * 1-5` |
| Каждый понедельник в 10:00 | `0 10 * * 1` |
| Каждые 6 часов | `0 */6 * * *` |
| 1-е число каждого месяца | `0 12 1 * *` |
| Пн, Ср, Пт в 18:00 | `0 18 * * 1,3,5` |

**Время — UTC** по умолчанию (timezone из настроек ClaudeClaw применяется автоматически).

### Типы джобов

**prompt** (default) — тело файла передаётся Claude как промпт:
```markdown
---
recurring: true
schedule: "0 9 * * 1-5"
---

Проверь статус CI/CD пайплайнов и сообщи если что-то сломано.
```

**script** — тело файла выполняется как shell-команда:
```markdown
---
recurring: true
schedule: "0 13 * * *"
type: script
---

bun run /app/scripts/news.ts
```

## Действия

### Создание джоба

1. Определи из запроса пользователя:
   - **Что делать** — промпт или скрипт
   - **Когда** — расписание (подбери cron-выражение)
   - **Уведомления** — нужны ли, default `true`
   - **Имя** — kebab-case, отражает суть (`morning-report`, `ci-check`, `news-digest`)

2. Создай файл `.claude/claudeclaw/jobs/<name>.md`

3. Подтверди создание — покажи имя, расписание человекочитаемо, notify.

### Редактирование джоба

1. Прочитай текущий файл джоба из `.claude/claudeclaw/jobs/`
2. Внеси изменения (расписание, промпт, notify, format)
3. Покажи что изменилось

### Удаление джоба

1. Подтверди у пользователя, что именно этот джоб нужно удалить
2. Удали файл из `.claude/claudeclaw/jobs/`

### Просмотр джобов

1. Прочитай файлы из `.claude/claudeclaw/jobs/`
2. Покажи список: имя, расписание (человекочитаемо), тип, notify
3. Если пресеты нужны — они в `presets/jobs/` (шаблоны, не активные)

## Пресеты

В `presets/jobs/` есть готовые шаблоны. Для активации — скопировать в `.claude/claudeclaw/jobs/` (можно отредактировать по пути).

## Валидация

При создании/редактировании проверь:
- `schedule` — ровно 5 полей через пробел
- `recurring` — указан явно (`true` или `false`)
- Для `type: script` — тело не пустое
- Имя файла — kebab-case, `.md` расширение
- Нет дубликата по имени
