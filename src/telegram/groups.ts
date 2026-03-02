import type { TelegramMessage, TelegramMyChatMemberUpdate } from "./types";
import { botId, botUsername, setBotId, setBotUsername } from "./state";
import { getSettings } from "../config";
import { run } from "../runner";
import { sendMessage } from "./api";
import { getMessageTextAndEntities } from "./utils";

export function groupTriggerReason(message: TelegramMessage): string | null {
  if (botId && message.reply_to_message?.from?.id === botId) return "reply_to_bot";
  const { text, entities } = getMessageTextAndEntities(message);
  if (!text) return null;
  const lowerText = text.toLowerCase();
  if (botUsername && lowerText.includes(`@${botUsername.toLowerCase()}`)) return "text_contains_mention";

  for (const entity of entities ?? []) {
    const value = text.slice(entity.offset, entity.offset + entity.length);
    if (entity.type === "mention" && botUsername && value.toLowerCase() === `@${botUsername.toLowerCase()}`) {
      return "mention_entity_matches_bot";
    }
    if (entity.type === "mention" && !botUsername) return "mention_entity_before_botname_loaded";
    if (entity.type === "bot_command") {
      if (!value.includes("@")) return "bare_bot_command";
      if (!botUsername) return "scoped_command_before_botname_loaded";
      if (botUsername && value.toLowerCase().endsWith(`@${botUsername.toLowerCase()}`)) return "scoped_command_matches_bot";
    }
  }

  return null;
}

export async function handleMyChatMember(update: TelegramMyChatMemberUpdate): Promise<void> {
  const config = getSettings().telegram;
  const chat = update.chat;
  if (!botUsername && update.new_chat_member.user.username) setBotUsername(update.new_chat_member.user.username);
  if (!botId) setBotId(update.new_chat_member.user.id);
  const oldStatus = update.old_chat_member.status;
  const newStatus = update.new_chat_member.status;
  const isGroup = chat.type === "group" || chat.type === "supergroup";
  const wasOut = oldStatus === "left" || oldStatus === "kicked";
  const isIn = newStatus === "member" || newStatus === "administrator";

  if (!isGroup || !wasOut || !isIn) return;

  const chatName = chat.title ?? String(chat.id);
  console.log(`[Telegram] Added to ${chat.type}: ${chatName} (${chat.id}) by ${update.from.id}`);

  const addedBy = update.from.username ?? `${update.from.first_name} (${update.from.id})`;
  const eventPrompt =
    `[Telegram system event] I was added to a ${chat.type}.\n` +
    `Group title: ${chatName}\n` +
    `Group id: ${chat.id}\n` +
    `Added by: ${addedBy}\n` +
    "Write a short first message for the group. It should confirm I was added and explain how to trigger me.";

  try {
    const result = await run("telegram", eventPrompt);
    if (result.exitCode !== 0) {
      await sendMessage(config.token, chat.id, "I was added to this group. Mention me with a command to start.");
      return;
    }
    await sendMessage(config.token, chat.id, result.stdout || "I was added to this group.");
  } catch (err) {
    console.error(`[Telegram] group-added event error: ${err instanceof Error ? err.message : err}`);
    await sendMessage(config.token, chat.id, "I was added to this group. Mention me with a command to start.");
  }
}
