import { getClient } from "./client";
import type { FormattedMessage } from "./types";

export async function fetchHistory(chatId: number, limit = 100): Promise<FormattedMessage[]> {
  const tg = getClient();
  const peer = await tg.resolvePeer(chatId);
  const messages: FormattedMessage[] = [];

  for await (const msg of tg.iterHistory(peer, { limit })) {
    const senderName = msg.sender?.displayName ?? "Unknown";
    const text = msg.text ?? "";
    const media = msg.media ? msg.media.type : undefined;

    messages.push({
      date: msg.date,
      senderName,
      text,
      media,
    });

    if (messages.length >= limit) break;
  }

  // Reverse to chronological order (iterHistory returns newest first)
  return messages.reverse();
}

export function formatMessagesForPrompt(messages: FormattedMessage[], chatTitle: string): string {
  if (messages.length === 0) return `Chat: ${chatTitle}\nMessages: 0\n\nNo messages found.`;

  const first = messages[0];
  const last = messages[messages.length - 1];

  const header = [
    `Chat: ${chatTitle}`,
    `Messages: ${messages.length}`,
    `Period: ${first.date.toISOString()} to ${last.date.toISOString()}`,
  ].join("\n");

  const body = messages.map((m) => {
    const time = m.date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const mediaPart = m.media ? ` [${m.media}]` : "";
    const textPart = m.text || "(no text)";
    return `[${time}] ${m.senderName}${mediaPart}: ${textPart}`;
  }).join("\n");

  return `${header}\n\n--- Messages ---\n${body}`;
}
