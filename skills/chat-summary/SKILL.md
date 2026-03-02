---
name: chat-summary
description: Generate a summary of a Telegram chat using mtcute. Use when the user asks to summarize a chat, get a chat overview, or asks "what happened in" a chat. Trigger phrases include "summarize chat", "chat summary", "what happened in", "overview of chat", "recap chat".
---

# Chat Summary

Generate a summary of recent messages in a Telegram chat using the mtcute MTProto client.

## Usage

```bash
claudeclaw mtcute summary <chatId> [limit]
```

- `chatId` — numeric ID of the target chat (find via `claudeclaw mtcute chats search`)
- `limit` — number of messages to analyze (default: 100)

## How it works

1. Reads the last N messages from the specified chat via MTProto
2. Formats them with timestamps and sender names
3. Sends to Claude for analysis
4. Returns a concise summary of topics, decisions, and action items

## Prerequisites

- mtcute must be authenticated (`claudeclaw mtcute auth`)
- Chat must be accessible to the authenticated user account
