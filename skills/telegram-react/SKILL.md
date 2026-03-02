---
name: telegram-react
description: Telegram reaction tags in replies. Use when composing any Telegram reply — add [react:<emoji>] to express a reaction to the user's message. Natural use, not just on explicit request.
---

# Telegram Reaction Directive

When replying in Telegram, you can react to the user's message by including a tag anywhere in your reply:

- Syntax: `[react:<emoji>]`
- Example: `Nice work [react:🔥]`

Runtime behavior:

- The bot strips all `[react:...]` tags from the outgoing text.
- The first valid tag is applied as a native Telegram reaction to the user's message.
- Invalid emoji are silently ignored — use only supported ones below.

## Supported emoji (73)

👍 👎 ❤ 🔥 🥰 👏 😁 🤔 🤯 😱 🤬 😢 🎉 🤩 🤮 💩 🙏 👌 🕊 🤡 🥱 🥴 😍 🐳 ❤‍🔥 🌚 🌭 💯 🤣 ⚡ 🍌 🏆 💔 🤨 😐 🍓 🍾 💋 🖕 😈 😴 😭 🤓 👻 👨‍💻 👀 🎃 🙈 😇 😨 🤝 ✍ 🤗 🫡 🎅 🎄 ☃ 💅 🤪 🗿 🆒 💘 🙉 🦄 😘 💊 🙊 😎 👾 🤷‍♂ 🤷 🤷‍♀ 😡

## Guidelines

- React to ~30% of messages — not every one, but regularly.
- Pick the emoji that fits the vibe of the message you're reacting to.
- One `[react:...]` per reply is enough.
- Good for: humor, agreement, emphasis, acknowledgment. Skip on neutral/technical messages.
