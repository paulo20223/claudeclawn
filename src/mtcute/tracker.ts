import { join } from "path";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import { run } from "../runner";
import { getClient } from "./client";
import { loadTargetChats } from "./chats";
import { saveNote } from "./notes";
import { fetchHistory, formatMessagesForPrompt } from "./history";
import type { ChatNote } from "./types";

const CACHE_DIR = join(process.cwd(), ".claude", "claudeclaw", "mtcute", "cache");

interface ChatCache {
  lastSeenMessageId: number;
  updatedAt: string;
}

async function loadCache(chatId: number): Promise<ChatCache | null> {
  const file = join(CACHE_DIR, `${chatId}.json`);
  if (!existsSync(file)) return null;
  try {
    return await Bun.file(file).json();
  } catch {
    return null;
  }
}

async function saveCache(chatId: number, cache: ChatCache): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await Bun.write(join(CACHE_DIR, `${chatId}.json`), JSON.stringify(cache, null, 2) + "\n");
}

export async function checkChat(chatId: number): Promise<void> {
  const tg = getClient();
  const cache = await loadCache(chatId);
  const lastSeenId = cache?.lastSeenMessageId ?? 0;

  const peer = await tg.resolvePeer(chatId);
  const newMessages: Array<{ id: number; senderName: string; text: string; date: Date }> = [];

  for await (const msg of tg.iterHistory(peer, { limit: 50 })) {
    if (msg.id <= lastSeenId) break;
    newMessages.push({
      id: msg.id,
      senderName: msg.sender?.displayName ?? "Unknown",
      text: msg.text ?? "",
      date: msg.date,
    });
  }

  if (newMessages.length === 0) return;

  // Update cache with the latest message ID
  const maxId = Math.max(...newMessages.map((m) => m.id));
  await saveCache(chatId, { lastSeenMessageId: maxId, updatedAt: new Date().toISOString() });

  // Only analyze if there are enough new messages
  if (newMessages.length < 5) return;

  const store = await loadTargetChats();
  const chat = store.chats.find((c) => c.id === chatId);
  const chatTitle = chat?.title ?? String(chatId);

  // Reverse to chronological order
  newMessages.reverse();

  const formatted = newMessages
    .map((m) => {
      const time = m.date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      return `[${time}] ${m.senderName}: ${m.text || "(no text)"}`;
    })
    .join("\n");

  const prompt = [
    `You are monitoring the Telegram chat "${chatTitle}" for notable events.`,
    `${newMessages.length} new messages since last check.`,
    "",
    "Instructions:",
    '- If nothing notable happened, respond with exactly: NOTHING_NOTABLE',
    "- If something noteworthy occurred (decisions, important info, action items, conflicts),",
    "  write a brief note summarizing what happened",
    "- Write in the same language as the messages",
    "- Be concise — 2-5 sentences max",
    "",
    "--- New Messages ---",
    formatted,
  ].join("\n");

  const result = await run("mtcute-track", prompt);

  if (result.exitCode !== 0) return;

  const output = result.stdout.trim();
  if (output === "NOTHING_NOTABLE" || !output) return;

  const note: ChatNote = {
    chatId,
    chatTitle,
    timestamp: new Date().toISOString(),
    content: output,
    source: "auto",
  };

  await saveNote(note);
  console.log(`[${new Date().toLocaleTimeString()}] mtcute: note saved for ${chatTitle}`);
}

export async function checkAllTrackedChats(): Promise<void> {
  const store = await loadTargetChats();
  const tracked = store.chats.filter((c) => c.trackingEnabled);

  if (tracked.length === 0) return;

  console.log(`[${new Date().toLocaleTimeString()}] mtcute: checking ${tracked.length} tracked chat(s)...`);

  for (const chat of tracked) {
    try {
      await checkChat(chat.id);
    } catch (err) {
      console.error(
        `[${new Date().toLocaleTimeString()}] mtcute: error checking ${chat.title}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
