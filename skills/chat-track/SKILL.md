---
name: chat-track
description: Manage Telegram chat tracking and view auto-generated notes. Use when the user asks to track a chat, list tracked chats, view chat notes, enable or disable tracking, or asks what chats are monitored. Trigger phrases include "track chat", "monitor chat", "view notes", "chat notes", "start tracking", "stop tracking", "какие чаты отслеживаются", "включи трекинг", "покажи заметки".
---

# Chat Tracking

Monitor Telegram chats and automatically generate notes when notable events occur.

## Prerequisites

- mtcute must be authenticated (`claudeclaw mtcute auth`)
- `mtcute.enabled` and `mtcute.trackingEnabled` must be `true` in settings.json

## Commands

```bash
# List target chats
claudeclaw mtcute chats

# Search for chats to add
claudeclaw mtcute chats search <query>

# Add a chat to targets
claudeclaw mtcute chats add <chatId>

# Remove a chat from targets
claudeclaw mtcute chats remove <chatId>

# View auto-generated notes
claudeclaw mtcute notes [chatId]

# Check tracking status
claudeclaw mtcute status
```

## How tracking works

1. The daemon checks tracked chats every `mtcute.trackingInterval` minutes (default: 30)
2. Chats with 5+ new messages are sent to Claude for analysis
3. Notable findings are saved as markdown notes in `.claude/claudeclaw/mtcute/notes/<chatId>/`

## Related skills

- **chat-summary** — generate an on-demand summary of any chat
- **chat-reply** — draft and send replies to chats
