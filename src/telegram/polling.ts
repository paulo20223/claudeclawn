import type { TelegramContext, TelegramMe, TelegramMessage, TelegramUpdate } from "./types";
import {
  pendingAsks,
  pendingRequests,
  running,
  setBotId,
  setBotUsername,
  setRunning,
  setTelegramContext,
  setTelegramDebug,
  telegramContext,
  telegramDebug,
} from "./state";
import { getSettings, loadSettings } from "../config";
import { ensureProjectClaudeMd } from "../runner";
import { callApi, editMessageWithButtons, sendMessage } from "./api";
import { debugLog } from "./utils";
import { handleMessage } from "./handler";
import { handleMyChatMember } from "./groups";
import { handleAskCallback } from "./ask";
import { handleCallback } from "./callbacks";
import { COMMAND_MENU } from "./commands";

async function poll(): Promise<void> {
  const config = getSettings().telegram;
  let offset = 0;
  try {
    const me = await callApi<{ ok: boolean; result: TelegramMe }>(config.token, "getMe");
    if (me.ok) {
      setBotUsername(me.result.username ?? null);
      setBotId(me.result.id);
      console.log(`  Bot: ${me.result.username ? `@${me.result.username}` : me.result.id}`);
      console.log(`  Group privacy: ${me.result.can_read_all_group_messages ? "disabled (reads all messages)" : "enabled (commands & mentions only)"}`);
    }
  } catch (err) {
    console.error(`[Telegram] getMe failed: ${err instanceof Error ? err.message : err}`);
  }

  try {
    await callApi(config.token, "setMyCommands", { commands: COMMAND_MENU });
  } catch (err) {
    console.error(`[Telegram] setMyCommands failed: ${err instanceof Error ? err.message : err}`);
  }

  console.log("Telegram bot started (long polling)");
  console.log(`  Allowed users: ${config.allowedUserIds.length === 0 ? "all" : config.allowedUserIds.join(", ")}`);
  if (telegramDebug) console.log("  Debug: enabled");

  while (running) {
    try {
      const data = await callApi<{ ok: boolean; result: TelegramUpdate[] }>(
        config.token,
        "getUpdates",
        { offset, timeout: 30, allowed_updates: ["message", "my_chat_member", "callback_query"] }
      );

      if (!data.ok || !data.result.length) continue;

      for (const update of data.result) {
        debugLog(
          `Update ${update.update_id} keys=${Object.keys(update).join(",")}`
        );
        offset = update.update_id + 1;
        const incomingMessages = [
          update.message,
          update.edited_message,
          update.channel_post,
          update.edited_channel_post,
        ].filter((m): m is TelegramMessage => Boolean(m));
        for (const incoming of incomingMessages) {
          handleMessage(incoming).catch((err) => {
            console.error(`[Telegram] Unhandled: ${err}`);
          });
        }
        if (update.my_chat_member) {
          handleMyChatMember(update.my_chat_member).catch((err) => {
            console.error(`[Telegram] my_chat_member unhandled: ${err}`);
          });
        }
        if (update.callback_query) {
          const cb = update.callback_query;
          callApi(config.token, "answerCallbackQuery", { callback_query_id: cb.id }).catch(() => {});
          if (cb.data && cb.message) {
            const cbChatId = cb.message.chat.id;
            const cbMsgId = cb.message.message_id;
            if (cb.data.startsWith("cancel:")) {
              const pending = pendingRequests.get(cbChatId);
              if (pending) {
                pending.controller.abort();
                pendingRequests.delete(cbChatId);
                editMessageWithButtons(config.token, cbChatId, cbMsgId, "❌ Отменено").catch(() => {});
              }
            } else if (cb.data.startsWith("ask:")) {
              handleAskCallback(config.token, cbChatId, cbMsgId, cb.data, cb.from, cb.message.text).catch((err) => {
                console.error(`[Telegram] ask callback error: ${err instanceof Error ? err.message : err}`);
              });
            } else {
              const cbContext: TelegramContext = {
                ...telegramContext!,
                sendMessage: (text) => sendMessage(config.token, cbChatId, text),
              };
              handleCallback(cb.data, cbContext)
                .then((result) => editMessageWithButtons(config.token, cbChatId, cbMsgId, result.text, result.buttons))
                .catch((err) => {
                  console.error(`[Telegram] callback error: ${err instanceof Error ? err.message : err}`);
                });
            }
          }
        }

        // Cleanup expired pendingAsks (TTL 1 hour)
        const now = Date.now();
        for (const [k, v] of Array.from(pendingAsks.entries())) {
          if (now - v.createdAt > 3600_000) pendingAsks.delete(k);
        }
      }
    } catch (err) {
      if (!running) break;
      console.error(`[Telegram] Poll error: ${err instanceof Error ? err.message : err}`);
      await Bun.sleep(5000);
    }
  }
}

process.on("SIGTERM", () => { setRunning(false); });
process.on("SIGINT", () => { setRunning(false); });

/** Start polling in-process (called by start.ts when token is configured) */
export function startPolling(debug = false, context?: TelegramContext): void {
  setTelegramDebug(debug);
  setTelegramContext(context ?? null);
  (async () => {
    await ensureProjectClaudeMd();
    await poll();
  })().catch((err) => {
    console.error(`[Telegram] Fatal: ${err}`);
  });
}

/** Standalone entry point (bun run src/index.ts telegram) */
export async function telegram() {
  await loadSettings();
  await ensureProjectClaudeMd();
  await poll();
}
