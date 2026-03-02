import type { TelegramMessage } from "./types";
import { pendingRequests, telegramContext } from "./state";
import { getSettings } from "../config";
import { runUserMessage } from "../runner";
import {
  callApi,
  extractButtonsDirective,
  extractReactionDirective,
  sendMessage,
  sendMessageWithButtons,
  sendReaction,
  sendSticker,
  sendTyping,
} from "./api";
import { extractStickerDirective, findStickerByEmoji, getAvailableEmoji, learnStickerPack } from "./stickers";
import { downloadDocumentFromMessage, downloadImageFromMessage, downloadVoiceFromMessage, transcribeVoice } from "./media";
import { debugLog, extractTelegramCommand, getMessageTextAndEntities, isAudioDocument, isGenericDocument, isImageDocument } from "./utils";
import { groupTriggerReason } from "./groups";
import { handleClearCommand, handleCommand, handleTodayTasks } from "./commands";

export async function handleMessage(message: TelegramMessage): Promise<void> {
  const config = getSettings().telegram;
  const userId = message.from?.id;
  const chatId = message.chat.id;
  const { text } = getMessageTextAndEntities(message);
  const chatType = message.chat.type;
  const isPrivate = chatType === "private";
  const isGroup = chatType === "group" || chatType === "supergroup";
  const hasImage = Boolean((message.photo && message.photo.length > 0) || isImageDocument(message.document));
  const hasVoice = Boolean(message.voice || message.audio || isAudioDocument(message.document));
  const hasDocument = Boolean(isGenericDocument(message.document));
  const hasSticker = Boolean(message.sticker);

  if (!isPrivate && !isGroup) return;

  const triggerReason = isGroup ? groupTriggerReason(message) : "private_chat";
  if (isGroup && !triggerReason) {
    debugLog(
      `Skip group message chat=${chatId} from=${userId ?? "unknown"} reason=no_trigger text="${(text ?? "").slice(0, 80)}"`
    );
    return;
  }
  debugLog(
    `Handle message chat=${chatId} type=${chatType} from=${userId ?? "unknown"} reason=${triggerReason} text="${(text ?? "").slice(0, 80)}"`
  );

  if (userId && config.allowedUserIds.length > 0 && !config.allowedUserIds.includes(userId)) {
    if (isPrivate) {
      await sendMessage(config.token, chatId, "Unauthorized.");
    } else {
      console.log(`[Telegram] Ignored group message from unauthorized user ${userId} in chat ${chatId}`);
      debugLog(`Skip group message chat=${chatId} from=${userId} reason=unauthorized_user`);
    }
    return;
  }

  if (hasSticker && message.sticker?.set_name) {
    try {
      const { title, count } = await learnStickerPack(config.token, message.sticker.set_name);
      console.log(`[Telegram] Learned sticker pack "${title}" (${count} stickers)`);
      await sendReaction(config.token, chatId, message.message_id, "👍").catch(() => {});
    } catch (err) {
      console.error(`[Telegram] Failed to learn sticker pack: ${err instanceof Error ? err.message : err}`);
    }
    if (!text.trim()) return;
  }

  if (!text.trim() && !hasImage && !hasVoice && !hasDocument) {
    debugLog(`Skip message chat=${chatId} from=${userId ?? "unknown"} reason=empty_text`);
    return;
  }

  const command = text ? extractTelegramCommand(text) : null;
  if (command === "/start") {
    const settings = getSettings();
    let msg = "Hello! Send me a message and I'll respond using Claude.\nUse /reset to start a fresh session.";
    if (settings.web.enabled) {
      const host = settings.web.host === "0.0.0.0" ? "your-server" : settings.web.host;
      msg += `\n\nWeb dashboard: http://${host}:${settings.web.port}`;
    }
    await sendMessage(config.token, chatId, msg);
    return;
  }

  if (command === "/menu") {
    const result = handleCommand("/menu", telegramContext);
    if (result) {
      await sendMessageWithButtons(config.token, chatId, result.text, result.buttons);
    }
    return;
  }

  if (command === "/clear" || command === "/reset") {
    const result = await handleClearCommand();
    await sendMessage(config.token, chatId, result.text);
    return;
  }

  if (command === "/today_tasks" || command === "/today-tasks") {
    const result = await handleTodayTasks();
    await sendMessage(config.token, chatId, result.text, result.buttons);
    return;
  }

  const label = message.from?.username ?? String(userId ?? "unknown");
  const mediaParts = [hasImage ? "image" : "", hasVoice ? "voice" : "", hasDocument ? "file" : ""].filter(Boolean);
  const mediaSuffix = mediaParts.length > 0 ? ` [${mediaParts.join("+")}]` : "";
  console.log(
    `[${new Date().toLocaleTimeString()}] Telegram ${label}${mediaSuffix}: "${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"`
  );

  const typingInterval = setInterval(() => sendTyping(config.token, chatId), 4000);
  const controller = new AbortController();

  let statusMessageId: number | null = null;
  try {
    const statusRes = await callApi<{ ok: boolean; result: { message_id: number } }>(
      config.token, "sendMessage", {
        chat_id: chatId,
        text: "⏳",
        reply_markup: {
          inline_keyboard: [[{ text: "❌ Отмена", callback_data: `cancel:${chatId}` }]],
        },
      }
    );
    if (statusRes.ok) statusMessageId = statusRes.result.message_id;
  } catch {}

  pendingRequests.set(chatId, { messageId: statusMessageId!, controller });

  try {
    await sendTyping(config.token, chatId);
    let imagePath: string | null = null;
    let voicePath: string | null = null;
    let voiceTranscript: string | null = null;
    if (hasImage) {
      try {
        imagePath = await downloadImageFromMessage(config.token, message);
      } catch (err) {
        console.error(`[Telegram] Failed to download image for ${label}: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (hasVoice) {
      try {
        voicePath = await downloadVoiceFromMessage(config.token, message);
      } catch (err) {
        console.error(`[Telegram] Failed to download voice for ${label}: ${err instanceof Error ? err.message : err}`);
      }

      if (voicePath) {
        try {
          debugLog(`Voice file saved: path=${voicePath}`);
          voiceTranscript = await transcribeVoice(voicePath);
        } catch (err) {
          console.error(`[Telegram] Failed to transcribe voice for ${label}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    let documentPath: string | null = null;
    let documentContent: string | null = null;
    if (hasDocument) {
      try {
        documentPath = await downloadDocumentFromMessage(config.token, message);
      } catch (err) {
        console.error(`[Telegram] Failed to download document for ${label}: ${err instanceof Error ? err.message : err}`);
      }

      if (documentPath) {
        try {
          const file = Bun.file(documentPath);
          const size = file.size;
          const MAX_FILE_SIZE = 256 * 1024;
          if (size <= MAX_FILE_SIZE) {
            documentContent = await file.text();
          }
        } catch {
          // binary or unreadable — will pass path only
        }
      }
    }

    const promptParts = [`[Telegram from ${label}]`];
    if (text.trim()) promptParts.push(`Message: ${text}`);
    if (imagePath) {
      promptParts.push(`Image path: ${imagePath}`);
      promptParts.push("The user attached an image. Inspect this image file directly before answering.");
    } else if (hasImage) {
      promptParts.push("The user attached an image, but downloading it failed. Respond and ask them to resend.");
    }
    if (voiceTranscript) {
      promptParts.push(`Voice transcript: ${voiceTranscript}`);
      promptParts.push("The user attached voice audio. Use the transcript as their spoken message.");
    } else if (hasVoice) {
      promptParts.push(
        "The user attached voice audio, but it could not be transcribed. Respond and ask them to resend a clearer clip."
      );
    }
    if (documentPath && documentContent) {
      const docName = message.document?.file_name ?? "file";
      promptParts.push(`File "${docName}" content:\n\`\`\`\n${documentContent}\n\`\`\``);
    } else if (documentPath) {
      const docName = message.document?.file_name ?? "file";
      promptParts.push(`File path: ${documentPath}`);
      promptParts.push(`The user attached a file "${docName}". Inspect this file directly before answering.`);
    } else if (hasDocument) {
      promptParts.push("The user attached a file, but downloading it failed. Ask them to resend.");
    }
    const availableEmoji = getAvailableEmoji();
    if (availableEmoji.length > 0) {
      promptParts.push(`Available sticker emoji: ${availableEmoji.join(" ")}`);
    }
    const prefixedPrompt = promptParts.join("\n");
    const result = await runUserMessage("telegram", prefixedPrompt, controller.signal);

    if (controller.signal.aborted) {
      // Cancelled — don't send response
    } else if (result.exitCode !== 0) {
      await sendMessage(config.token, chatId, `Error (exit ${result.exitCode}): ${result.stderr || "Unknown error"}`);
    } else {
      const { cleanedText: afterReact, reactionEmoji } = extractReactionDirective(result.stdout || "");
      if (reactionEmoji) {
        await sendReaction(config.token, chatId, message.message_id, reactionEmoji).catch((err) => {
          console.error(`[Telegram] Failed to send reaction for ${label}: ${err instanceof Error ? err.message : err}`);
        });
      }
      const { cleanedText: afterSticker, stickerEmoji } = extractStickerDirective(afterReact);
      if (stickerEmoji) {
        const fileId = findStickerByEmoji(stickerEmoji);
        if (fileId) {
          await sendSticker(config.token, chatId, fileId).catch((err) => {
            console.error(`[Telegram] Failed to send sticker for ${label}: ${err instanceof Error ? err.message : err}`);
          });
        }
      }
      const { cleanedText, buttons } = extractButtonsDirective(afterSticker, chatId);
      if (cleanedText || buttons) {
        await sendMessage(config.token, chatId, cleanedText || "(empty response)", buttons ?? undefined);
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Telegram] Error for ${label}: ${errMsg}`);
    await sendMessage(config.token, chatId, `Error: ${errMsg}`);
  } finally {
    clearInterval(typingInterval);
    pendingRequests.delete(chatId);
    if (statusMessageId) {
      callApi(config.token, "deleteMessage", {
        chat_id: chatId,
        message_id: statusMessageId,
      }).catch(() => {});
    }
  }
}
