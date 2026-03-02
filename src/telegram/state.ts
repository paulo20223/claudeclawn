import type { TelegramContext, PendingAsk, PendingRequest } from "./types";

export let askCounter = 0;
export const pendingAsks = new Map<string, PendingAsk>();
export const pendingRequests = new Map<number, PendingRequest>();

export let telegramDebug = false;
export let telegramContext: TelegramContext | null = null;
export let botUsername: string | null = null;
export let botId: number | null = null;
export let running = true;

export function setTelegramDebug(v: boolean) { telegramDebug = v; }
export function setTelegramContext(v: TelegramContext | null) { telegramContext = v; }
export function setBotUsername(v: string | null) { botUsername = v; }
export function setBotId(v: number | null) { botId = v; }
export function setRunning(v: boolean) { running = v; }
export function incrementAskCounter(): number { return ++askCounter; }
