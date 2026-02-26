import { TelegramClient } from "@mtcute/bun";
import { join } from "path";
import { existsSync } from "fs";
import type { MtcuteConfig } from "../config";

const MTCUTE_DIR = join(process.cwd(), ".claude", "claudeclaw", "mtcute");

let client: TelegramClient | null = null;
let connected = false;
let sessionPath: string | null = null;

export function initClient(config: MtcuteConfig): TelegramClient {
  if (client) return client;

  sessionPath = join(MTCUTE_DIR, `${config.sessionName}.session`);

  client = new TelegramClient({
    apiId: config.apiId,
    apiHash: config.apiHash,
    storage: sessionPath,
  });

  return client;
}

export async function connectClient(): Promise<void> {
  if (!client) throw new Error("Client not initialized. Call initClient() first.");
  if (connected) return;

  if (sessionPath && !existsSync(sessionPath)) {
    throw new Error("No mtcute session found. Run 'task mtcute:auth' first.");
  }

  await client.start();
  connected = true;
  console.log(`[${new Date().toLocaleTimeString()}] mtcute: connected`);
}

export async function disconnectClient(): Promise<void> {
  if (!client || !connected) return;
  try {
    await client.disconnect();
  } catch {
    // ignore close errors
  }
  connected = false;
  console.log(`[${new Date().toLocaleTimeString()}] mtcute: disconnected`);
}

export function getClient(): TelegramClient {
  if (!client || !connected) throw new Error("mtcute client not connected.");
  return client;
}

export function isConnected(): boolean {
  return connected;
}
