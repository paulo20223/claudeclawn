# File Formats Reference

## index.yaml

```yaml
tasks:
  - id: t001
    text: "Task description"
    created: "YYYY-MM-DD"
    due: "YYYY-MM-DD"       # optional
    project: project-name   # optional
    status: active           # active | done | dropped
    carried: 0
    friction: false          # auto-set when carried >= 3
```

## days/YYYY-MM-DD.md

```markdown
---
date: "YYYY-MM-DD"
day: weekday
planned: [t001, t002]
completed: []
added: []
predictability: 0
---

# Day Title

## Tasks
- [ ] Task (tNNN)
- [ ] Task (tNNN)

## Notes
```

## weeks/YYYY-WNN.md

```markdown
---
week: "YYYY-WNN"
red_thread: "Focus for this week"
---

# Week N — Red Thread: Focus

## Daily summaries...

## Summary
- Predictability avg: N%
- Tasks completed: X/Y
- Friction items: N
- Red Thread progress: N%
```

## context/periodic.yaml

```yaml
items:
  - name: "Item name"
    last: "YYYY-MM-DD"
    interval_days: 45
    reminder: true
```

## context/projects.yaml

```yaml
projects:
  - name: project-name
    status: active           # active | paused | done
    deadline: "YYYY-MM-DD"   # optional
    stack: "tech stack"      # optional
    focus: "current focus"   # optional
    notes: "any notes"       # optional
```

## context/people.yaml

```yaml
people:
  - name: "Person name"
    role: "their role"
    context: "how they're connected"
    notes: "current relevant info"
```

## context/recurring.yaml

```yaml
events:
  - name: "Event name"
    schedule: "description or cron"
    time: "HH:MM"
    days: [1, 2, 3, 4, 5]   # 0=Sun, 1=Mon, etc
    notes: "any notes"
```

## metrics.yaml

```yaml
days_tracked: 0
avg_predictability: 0
total_completed: 0
total_planned: 0
current_streak: 0
friction_resolved: 0
```
