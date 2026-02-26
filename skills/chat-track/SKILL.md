---
name: chat-track
description: Manage Telegram chat tracking and view auto-generated notes. Use when the user asks to track a chat, monitor conversations, view chat notes, or manage tracked chats. Trigger phrases include "track chat", "monitor chat", "view notes", "chat notes", "start tracking", "stop tracking".
---

# Chat Tracking

Monitor Telegram chats and automatically generate notes when notable events occur.

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

1. When `mtcute.trackingEnabled` is true in settings, the daemon checks tracked chats periodically
2. The interval is set by `mtcute.trackingInterval` (minutes, default: 30)
3. For each tracked chat with 5+ new messages, Claude analyzes the conversation
4. If something notable is found, a note is saved as a markdown file
5. Notes are stored in `.claude/claudeclaw/mtcute/notes/<chatId>/`

## Enabling tracking for a chat

After adding a chat via `claudeclaw mtcute chats add`, set `trackingEnabled: true` for that chat in `.claude/claudeclaw/mtcute/target-chats.json`.

## Configuration

In `settings.json`:
```json
{
  "mtcute": {
    "enabled": true,
    "trackingEnabled": true,
    "trackingInterval": 30
  }
}
```
