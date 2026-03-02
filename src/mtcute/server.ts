import { TelegramClient } from "@mtcute/bun";
import { join } from "path";
import { existsSync } from "fs";
import { mkdir } from "fs/promises";

const MTCUTE_DIR = join(process.cwd(), ".claude", "claudeclaw", "mtcute");

const API_ID = Number(process.env.MTCUTE_API_ID) || 0;
const API_HASH = process.env.MTCUTE_API_HASH || "";
const SESSION_NAME = process.env.MTCUTE_SESSION_NAME || "claudeclaw";
const PORT = Number(process.env.MTCUTE_PORT) || 3000;

let client: TelegramClient | null = null;
let connected = false;

async function connect() {
  await mkdir(MTCUTE_DIR, { recursive: true });
  const sessionPath = join(MTCUTE_DIR, `${SESSION_NAME}.session`);
  if (!existsSync(sessionPath)) {
    throw new Error(`No session file at ${sessionPath}. Run auth first.`);
  }

  client = new TelegramClient({
    apiId: API_ID,
    apiHash: API_HASH,
    storage: sessionPath,
  });

  await client.start();
  connected = true;
  console.log(`[${new Date().toLocaleTimeString()}] mtcute gateway: connected`);
}

function tg(): TelegramClient {
  if (!client || !connected) throw new Error("Not connected");
  return client;
}

function resolveChatType(chat: any): "user" | "group" | "supergroup" | "channel" {
  if ("chatType" in chat) {
    const ct = chat.chatType;
    if (ct === "group") return "group";
    if (ct === "supergroup" || ct === "gigagroup") return "supergroup";
    if (ct === "channel") return "channel";
  }
  return "user";
}

async function handleHistory(body: any) {
  const { chatId, limit = 100 } = body;
  const peer = await tg().resolvePeer(chatId);
  const messages: any[] = [];

  for await (const msg of tg().iterHistory(peer, { limit })) {
    messages.push({
      id: msg.id,
      date: msg.date.toISOString(),
      senderName: msg.sender?.displayName ?? "Unknown",
      text: msg.text ?? "",
      media: msg.media ? msg.media.type : undefined,
    });
    if (messages.length >= limit) break;
  }

  messages.reverse();
  return { messages };
}

async function handleDialogs(body: any) {
  const { query, limit = 20 } = body;
  const results: any[] = [];
  const lowerQuery = query.toLowerCase();

  for await (const dialog of tg().iterDialogs()) {
    const peer = dialog.peer;
    const title = peer.displayName || "";
    const username = "username" in peer ? (peer.username ?? "") : "";

    if (
      title.toLowerCase().includes(lowerQuery) ||
      username.toLowerCase().includes(lowerQuery)
    ) {
      results.push({
        id: peer.id,
        title,
        type: resolveChatType(peer),
        username: username || undefined,
      });
      if (results.length >= limit) break;
    }
  }

  return { dialogs: results };
}

async function handleChatInfo(body: any) {
  const { chatId } = body;
  const peer = await tg().resolvePeer(chatId);
  const chat = await tg().getChat(peer);

  return {
    chat: {
      id: chat.id,
      title: chat.displayName,
      type: resolveChatType(chat),
      username: "username" in chat ? chat.username ?? undefined : undefined,
    },
  };
}

async function handleSend(body: any) {
  const { chatId, text } = body;
  await tg().sendText(chatId, text);
  return { ok: true };
}

async function handleResolve(body: any) {
  const { chatId } = body;
  await tg().resolvePeer(chatId);
  return { ok: true };
}

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/health") return Response.json({ ok: true });
  if (path === "/status") return Response.json({ connected });

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await req.json();

    const handlers: Record<string, (body: any) => Promise<any>> = {
      "/history": handleHistory,
      "/dialogs": handleDialogs,
      "/chat-info": handleChatInfo,
      "/send": handleSend,
      "/resolve": handleResolve,
    };

    const handler = handlers[path];
    if (!handler) return Response.json({ error: "Not found" }, { status: 404 });

    const result = await handler(body);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${new Date().toLocaleTimeString()}] ${path}: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}

if (!API_ID || !API_HASH) {
  console.error("MTCUTE_API_ID and MTCUTE_API_HASH are required");
  process.exit(1);
}

await connect();

Bun.serve({ port: PORT, fetch: handleRequest });
console.log(`[${new Date().toLocaleTimeString()}] mtcute gateway: listening on :${PORT}`);
