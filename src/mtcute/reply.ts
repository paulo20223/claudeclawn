import { run, type RunResult } from "../runner";
import { getClient } from "./client";
import { fetchHistory, formatMessagesForPrompt } from "./history";
import { getTargetChat } from "./chats";

export interface ReplyResult {
  runResult: RunResult;
  suggestedReply: string;
  sent: boolean;
}

export async function generateReply(
  chatId: number,
  contextMessages = 30,
  autoSend = false,
): Promise<ReplyResult> {
  const chat = await getTargetChat(chatId);
  const chatTitle = chat?.title ?? String(chatId);

  const messages = await fetchHistory(chatId, contextMessages);
  const formatted = formatMessagesForPrompt(messages, chatTitle);

  const prompt = [
    "You are drafting a reply for a Telegram chat. Generate a natural response.",
    "",
    "Instructions:",
    "- Match the conversation tone and language",
    "- Be concise and relevant to the latest messages",
    "- Output ONLY the reply text, no explanations or metadata",
    "- Write in the same language as the chat messages",
    "",
    formatted,
  ].join("\n");

  const runResult = await run("mtcute-reply", prompt);
  const suggestedReply = runResult.stdout.trim();
  let sent = false;

  if (autoSend && runResult.exitCode === 0 && suggestedReply) {
    const tg = getClient();
    await tg.sendText(chatId, suggestedReply);
    sent = true;
    console.log(`[${new Date().toLocaleTimeString()}] mtcute: reply sent to ${chatTitle}`);
  }

  return { runResult, suggestedReply, sent };
}
