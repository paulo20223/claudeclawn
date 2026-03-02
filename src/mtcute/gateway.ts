import type { FormattedMessage, TargetChat } from "./types";

const GATEWAY_URL = process.env.MTCUTE_URL || "http://tg:3000";

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function fetchHistoryViaGateway(chatId: number, limit?: number): Promise<FormattedMessage[]> {
  const data = await post<{ messages: any[] }>("/history", { chatId, limit });
  return data.messages.map((m) => ({
    id: m.id,
    date: new Date(m.date),
    senderName: m.senderName,
    text: m.text,
    media: m.media,
  }));
}

export async function searchDialogsViaGateway(query: string, limit?: number): Promise<TargetChat[]> {
  const data = await post<{ dialogs: any[] }>("/dialogs", { query, limit });
  return data.dialogs.map((d) => ({
    ...d,
    addedAt: "",
    trackingEnabled: false,
  }));
}

export async function getChatInfoViaGateway(
  chatId: number,
): Promise<{ id: number; title: string; type: string; username?: string }> {
  const data = await post<{ chat: any }>("/chat-info", { chatId });
  return data.chat;
}

export async function sendTextViaGateway(chatId: number, text: string): Promise<void> {
  await post("/send", { chatId, text });
}

export async function isGatewayConnected(): Promise<boolean> {
  try {
    const data = await get<{ connected: boolean }>("/status");
    return data.connected;
  } catch {
    return false;
  }
}
