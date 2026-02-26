---
name: chat-reply
description: Generate a reply for a Telegram chat using mtcute. Use when the user asks to draft a reply, respond to a chat, or wants to send a message. Trigger phrases include "reply to chat", "draft response", "respond in chat", "write reply", "answer in chat".
---

# Chat Reply

Generate a contextual reply for a Telegram chat using the mtcute MTProto client.

## Usage

```bash
claudeclaw mtcute reply <chatId> [--send]
```

- `chatId` — numeric ID of the target chat
- `--send` — auto-send the generated reply (default: preview only)

## How it works

1. Reads recent messages from the chat for context
2. Sends context to Claude with instructions to draft a reply matching conversation tone
3. Returns the suggested reply text
4. If `--send` flag is used, sends the reply directly via MTProto

## Safety

By default, replies are NOT sent automatically. The user reviews the suggestion first.
Use `--send` only when you're confident in the output.
