import { join } from "path";
import { existsSync } from "fs";
import { getClient } from "./client";
import type { TargetChat, TargetChatsStore } from "./types";

const STORE_FILE = join(process.cwd(), ".claude", "claudeclaw", "mtcute", "target-chats.json");

export async function loadTargetChats(): Promise<TargetChatsStore> {
  if (!existsSync(STORE_FILE)) {
    return { chats: [], updatedAt: new Date().toISOString() };
  }
  try {
    return await Bun.file(STORE_FILE).json();
  } catch {
    return { chats: [], updatedAt: new Date().toISOString() };
  }
}

export async function saveTargetChats(store: TargetChatsStore): Promise<void> {
  store.updatedAt = new Date().toISOString();
  await Bun.write(STORE_FILE, JSON.stringify(store, null, 2) + "\n");
}

export async function searchDialogs(query: string, limit = 20): Promise<TargetChat[]> {
  const tg = getClient();
  const results: TargetChat[] = [];
  const lowerQuery = query.toLowerCase();

  for await (const dialog of tg.iterDialogs()) {
    const peer = dialog.peer;
    const title = peer.displayName || "";
    const username = "username" in peer ? (peer.username ?? "") : "";

    if (
      title.toLowerCase().includes(lowerQuery) ||
      username.toLowerCase().includes(lowerQuery)
    ) {
      let type: TargetChat["type"] = "user";
      if ("chatType" in peer) {
        const ct = peer.chatType;
        if (ct === "group") type = "group";
        else if (ct === "supergroup" || ct === "gigagroup") type = "supergroup";
        else if (ct === "channel") type = "channel";
      }

      results.push({
        id: peer.id,
        title,
        type,
        username: username || undefined,
        addedAt: "",
        trackingEnabled: false,
      });

      if (results.length >= limit) break;
    }
  }

  return results;
}

export async function addTargetChat(chat: Omit<TargetChat, "addedAt" | "trackingEnabled">): Promise<boolean> {
  const store = await loadTargetChats();

  if (store.chats.some((c) => c.id === chat.id)) {
    return false; // duplicate
  }

  store.chats.push({
    ...chat,
    addedAt: new Date().toISOString(),
    trackingEnabled: false,
  });

  await saveTargetChats(store);
  return true;
}

export async function removeTargetChat(chatId: number): Promise<boolean> {
  const store = await loadTargetChats();
  const before = store.chats.length;
  store.chats = store.chats.filter((c) => c.id !== chatId);

  if (store.chats.length === before) return false;

  await saveTargetChats(store);
  return true;
}

export async function listTargetChats(): Promise<TargetChat[]> {
  const store = await loadTargetChats();
  return store.chats;
}

export async function getTargetChat(chatId: number): Promise<TargetChat | undefined> {
  const store = await loadTargetChats();
  return store.chats.find((c) => c.id === chatId);
}

export async function updateTargetChat(chatId: number, patch: Partial<TargetChat>): Promise<boolean> {
  const store = await loadTargetChats();
  const chat = store.chats.find((c) => c.id === chatId);
  if (!chat) return false;

  Object.assign(chat, patch);
  await saveTargetChats(store);
  return true;
}
