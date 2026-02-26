import { run, type RunResult } from "../runner";
import { fetchHistory, formatMessagesForPrompt } from "./history";
import { getTargetChat, updateTargetChat } from "./chats";

export async function generateChatSummary(chatId: number, limit = 100): Promise<RunResult> {
  const chat = await getTargetChat(chatId);
  const chatTitle = chat?.title ?? String(chatId);

  const messages = await fetchHistory(chatId, limit);
  const formatted = formatMessagesForPrompt(messages, chatTitle);

  const prompt = [
    "You are analyzing a Telegram chat history. Provide a concise summary.",
    "",
    "Instructions:",
    "- Identify the main topics discussed",
    "- Note any decisions made or action items",
    "- Highlight any important information or changes",
    "- Keep the summary brief but informative",
    "- Write in the same language as the chat messages",
    "",
    formatted,
  ].join("\n");

  const result = await run("mtcute-summary", prompt);

  if (chat) {
    await updateTargetChat(chatId, { lastSummaryAt: new Date().toISOString() });
  }

  return result;
}
