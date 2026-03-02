import type { TelegramUser } from "./types";
import { pendingAsks } from "./state";
import { callApi, editMessageWithButtons, extractButtonsDirective, extractReactionDirective, sendMessage, sendReaction, sendTyping } from "./api";
import { runUserMessage } from "../runner";

export async function handleAskCallback(
  token: string,
  chatId: number,
  messageId: number,
  data: string,
  from: TelegramUser,
  originalText?: string
): Promise<void> {
  const parts = data.split(":");
  const counter = parts[1];
  const choice = parts[2];
  const key = `${chatId}:${counter}`;
  const pending = pendingAsks.get(key);

  if (!pending) {
    if (originalText) {
      await editMessageWithButtons(token, chatId, messageId, originalText);
    }
    return;
  }

  if (choice === "other") {
    const updatedText = (originalText ?? "") + "\n\n<i>Напишите свой вариант...</i>";
    await editMessageWithButtons(token, chatId, messageId, updatedText);
    pendingAsks.delete(key);
    return;
  }

  const idx = parseInt(choice, 10);
  const selected = pending.options[idx];
  if (!selected) {
    if (originalText) {
      await editMessageWithButtons(token, chatId, messageId, originalText);
    }
    pendingAsks.delete(key);
    return;
  }

  const updatedText = (originalText ?? "") + `\n\n→ <b>${selected}</b>`;
  await editMessageWithButtons(token, chatId, messageId, updatedText);
  pendingAsks.delete(key);

  const typingInterval = setInterval(() => sendTyping(token, chatId), 4000);
  try {
    await sendTyping(token, chatId);
    const label = from.username ?? String(from.id);
    const prompt = `[Telegram from ${label}]\nMessage: ${selected}`;
    const result = await runUserMessage("telegram", prompt);

    if (result.exitCode !== 0) {
      await sendMessage(token, chatId, `Error (exit ${result.exitCode}): ${result.stderr || "Unknown error"}`);
    } else {
      const { cleanedText: afterReact, reactionEmoji } = extractReactionDirective(result.stdout || "");
      if (reactionEmoji) {
        await sendReaction(token, chatId, messageId, reactionEmoji).catch(() => {});
      }
      const { cleanedText, buttons } = extractButtonsDirective(afterReact, chatId);
      await sendMessage(token, chatId, cleanedText || "(empty response)", buttons ?? undefined);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Telegram] Ask callback error: ${errMsg}`);
    await sendMessage(token, chatId, `Error: ${errMsg}`);
  } finally {
    clearInterval(typingInterval);
  }
}
