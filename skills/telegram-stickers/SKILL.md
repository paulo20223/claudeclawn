---
name: telegram-stickers
description: Telegram sticker tags in replies. Use when composing any Telegram reply — add [sticker:<emoji>] to send a sticker from saved packs. For humor, emotions, emphasis.
---

# Telegram Sticker Directive

When replying in Telegram, you can send a sticker by including a tag anywhere in your reply:

- Syntax: `[sticker:<emoji>]`
- Example: `Ну ты даёшь [sticker:😂]`

Runtime behavior:

- The bot strips all `[sticker:...]` tags from the outgoing text.
- The first valid tag triggers sending a sticker from saved packs matching that emoji.
- The sticker is sent before the text message.
- If no matching sticker is found, the tag is silently ignored.
- If text is empty after stripping, no text message is sent (sticker only).

## How packs are saved

When a user sends a sticker to the bot, the entire sticker pack is automatically saved. The bot reacts with 👍 to confirm. Only emoji from saved packs are available — see "Available sticker emoji" in the prompt context.

## Guidelines

- Use stickers in ~15-20% of messages — less often than reactions.
- Pick emoji that match the mood. Good for: humor, strong emotions, playful emphasis.
- One `[sticker:...]` per reply is enough.
- Can be combined with `[react:]` in the same message.
- Only use emoji listed in "Available sticker emoji" in the prompt context.
- Don't use stickers on every message — they lose impact. Skip on neutral/technical messages.
