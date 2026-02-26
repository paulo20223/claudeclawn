---
name: planner-review
description: Analytics and review for the personal task planner. Use when the user asks for weekly review, patterns, analytics, procrastination analysis, statistics, retrospective, predictability trends, or wants insights about their planning habits. Trigger phrases include "обзор недели", "паттерны", "аналитика", "что прокрастинирую", "статистика", "ретро", "weekly review", "patterns", "analytics", "what am I procrastinating", "retrospective", "predictability", "trends", "how am I doing".
---

# Planner Review — Analytics & Insights

You provide analytical insights about the user's planning patterns, productivity trends, and procrastination habits.

## Data Sources

Read from `.claude/claudeclaw/planner/`:
- `metrics.yaml` — aggregate statistics
- `index.yaml` — current tasks (check friction flags, carry counts)
- `days/*.md` — historical daily plans and results
- `weeks/*.md` — weekly summaries and Red Thread tracking
- `context/projects.yaml` — project status and deadlines

## Analysis Types

### Weekly Review (`обзор недели`, `ретро`)

1. Read all day files for the current/specified week
2. Calculate:
   - Predictability: % of planned tasks completed
   - Completion rate by priority (must/should/could)
   - Tasks added mid-day vs planned
   - Carry-forward count
3. Identify patterns:
   - Which days are most/least productive?
   - Which priority level gets neglected?
   - Red Thread progress
4. Present as a concise summary with actionable insights

### Friction Analysis (`что прокрастинирую`, `паттерны`)

1. Find all tasks with `friction: true` or `carried >= 3`
2. Group by project or category
3. For each friction item, suggest:
   - **Decompose**: Break into smaller subtasks
   - **Delegate**: Can someone else do it?
   - **Drop**: Is it still relevant?
   - **Reframe**: Change approach or priority
4. Look for patterns: same project? same type of task? same day of week?

### Predictability Trends (`статистика`, `trends`)

1. Read `metrics.yaml` and recent day files
2. Show:
   - Predictability over time (improving/declining?)
   - Average tasks per day by priority
   - Capacity utilization (planned vs capacity limits)
   - Streak of days with 100% must completion
3. Compare current week to previous weeks

### Project Health Check

1. Read `context/projects.yaml`
2. Cross-reference with `index.yaml` tasks
3. Flag:
   - **Stale projects**: no tasks in > 7 days but deadline < 30 days
   - **Overloaded projects**: too many active tasks
   - **Orphan tasks**: tasks with no project
4. Suggest rebalancing

## Response Style

- Use data, not opinions — cite specific numbers
- Be encouraging but honest about patterns
- Suggest specific, actionable improvements
- Use Russian, match the user's tone
- Format with clear sections and key metrics highlighted
- Keep it concise — the user wants insights, not a report

## Example Output

```
📊 Неделя 9:
- Predictability: 55% (↓ от 68% на прошлой неделе)
- Must: 12/15 (80%), Should: 5/10 (50%), Could: 1/6 (17%)
- Carry-forward: 4 задачи (2 — friction)

🔍 Паттерны:
- Пятница — слабый день (33% completion)
- Could-задачи систематически не делаются — возможно, стоит снизить capacity
- Проект "ремонт" stale 12 дней, дедлайн через 18

💡 Рекомендации:
- Перенеси Could на выходные или убери из плана
- "Почитать про WebSocket" (carry x5) — разбей на 15-мин блоки или дропни
- Запланируй хотя бы 1 задачу по "ремонт" на эту неделю
```
