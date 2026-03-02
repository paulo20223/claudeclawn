import type { InlineButton } from "./types";
import { pendingAsks, incrementAskCounter } from "./state";
import { markdownToTelegramHtml, stripMarkdown } from "./format";
import { normalizeTelegramText } from "./utils";

export const API_BASE = "https://api.telegram.org/bot";
export const FILE_API_BASE = "https://api.telegram.org/file/bot";

export async function callApi<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Telegram API ${method}: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  buttons?: InlineButton[][],
  format?: "plain" | "html" | "markdown"
): Promise<void> {
  const normalized = normalizeTelegramText(text)
    .replace(/\[react:[^\]\r\n]+\]/gi, "")
    .replace(/\[sticker:[^\]\r\n]+\]/gi, "");
  const CHUNK_LEN = 3000;
  const MAX_LEN = 4096;
  const chunks: string[] = [];
  for (let i = 0; i < normalized.length; i += CHUNK_LEN) {
    chunks.push(normalized.slice(i, i + CHUNK_LEN));
  }
  if (chunks.length === 0) chunks.push(normalized);
  const fmt = format ?? "plain";
  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const chunkButtons = isLast ? buttons : undefined;
    if (chunkButtons && chunkButtons.length > 0) {
      await sendMessageWithButtons(token, chatId, chunks[i], chunkButtons, fmt);
    } else if (fmt === "plain") {
      await callApi(token, "sendMessage", {
        chat_id: chatId,
        text: stripMarkdown(chunks[i]),
      });
    } else if (fmt === "markdown") {
      await callApi(token, "sendMessage", {
        chat_id: chatId,
        text: chunks[i],
        parse_mode: "Markdown",
      });
    } else {
      const html = markdownToTelegramHtml(chunks[i]);
      try {
        if (html.length <= MAX_LEN) {
          await callApi(token, "sendMessage", {
            chat_id: chatId,
            text: html,
            parse_mode: "HTML",
          });
        } else {
          await callApi(token, "sendMessage", {
            chat_id: chatId,
            text: stripMarkdown(chunks[i]),
          });
        }
      } catch {
        await callApi(token, "sendMessage", {
          chat_id: chatId,
          text: stripMarkdown(chunks[i]),
        });
      }
    }
  }
}

export async function sendMessageWithButtons(
  token: string,
  chatId: number,
  text: string,
  buttons?: InlineButton[][],
  format?: "plain" | "html" | "markdown"
): Promise<void> {
  const fmt = format ?? "plain";
  const body: Record<string, unknown> = { chat_id: chatId };
  if (buttons && buttons.length > 0) {
    body.reply_markup = { inline_keyboard: buttons };
  }
  if (fmt === "html") {
    body.text = markdownToTelegramHtml(text);
    body.parse_mode = "HTML";
  } else if (fmt === "markdown") {
    body.text = text;
    body.parse_mode = "Markdown";
  } else {
    body.text = stripMarkdown(text);
  }
  try {
    await callApi(token, "sendMessage", body);
  } catch {
    body.text = stripMarkdown(text);
    delete body.parse_mode;
    await callApi(token, "sendMessage", body);
  }
}

export async function editMessageWithButtons(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  buttons?: InlineButton[][]
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };
  if (buttons && buttons.length > 0) {
    body.reply_markup = { inline_keyboard: buttons };
  } else {
    body.reply_markup = { inline_keyboard: [] };
  }
  try {
    await callApi(token, "editMessageText", body);
  } catch {
    delete body.parse_mode;
    await callApi(token, "editMessageText", body).catch(() => {});
  }
}

export async function sendTyping(token: string, chatId: number): Promise<void> {
  await callApi(token, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

export function extractReactionDirective(text: string): { cleanedText: string; reactionEmoji: string | null } {
  let reactionEmoji: string | null = null;
  const cleanedText = text
    .replace(/\[react:([^\]\r\n]+)\]/gi, (_match, raw) => {
      const candidate = String(raw).trim();
      if (!reactionEmoji && candidate) reactionEmoji = candidate;
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { cleanedText, reactionEmoji };
}

export function extractButtonsDirective(
  text: string,
  chatId: number
): { cleanedText: string; buttons: InlineButton[][] | null } {
  const match = text.match(/\[buttons\]\n([\s\S]*?)\n?\[\/buttons\]/i);
  if (!match) return { cleanedText: text, buttons: null };

  const counter = incrementAskCounter();
  const key = `${chatId}:${counter}`;
  const lines = match[1].split("\n").filter((l) => l.trim());
  const options: string[] = [];
  const keyboard: InlineButton[][] = [];

  for (const line of lines) {
    const row: InlineButton[] = [];
    for (const label of line.split("|").map((s) => s.trim()).filter(Boolean)) {
      const idx = options.length;
      options.push(label);
      row.push({ text: label, callback_data: `ask:${counter}:${idx}` });
    }
    if (row.length) keyboard.push(row);
  }

  keyboard.push([{ text: "Другое...", callback_data: `ask:${counter}:other` }]);

  pendingAsks.set(key, { options, createdAt: Date.now() });

  const cleanedText = text
    .replace(/\[buttons\]\n[\s\S]*?\n?\[\/buttons\]/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleanedText, buttons: keyboard };
}

export async function sendSticker(token: string, chatId: number, fileId: string): Promise<void> {
  await callApi(token, "sendSticker", { chat_id: chatId, sticker: fileId });
}

export async function sendReaction(token: string, chatId: number, messageId: number, emoji: string): Promise<void> {
  await callApi(token, "setMessageReaction", {
    chat_id: chatId,
    message_id: messageId,
    reaction: [{ type: "emoji", emoji }],
  });
}
