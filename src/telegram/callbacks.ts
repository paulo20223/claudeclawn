import type { TelegramContext, CommandResult } from "./types";
import { BACK_BUTTON, menuResult } from "./shared";
import { handleJobsCallback, handleRunCallback } from "./jobs";
import { handleSkillsCallback, handleSkillDetailCallback } from "./skills";
import { handleTodayTasks } from "./planner";
import { resetSession, peekSession } from "../sessions";

export async function handleCallback(
  data: string,
  context: TelegramContext | null
): Promise<CommandResult> {
  if (!context) {
    return { text: "Unavailable in standalone mode.", buttons: [] };
  }

  if (data === "menu") {
    return menuResult();
  }

  if (data === "jobs" || data.startsWith("jobs:")) {
    return handleJobsCallback(data, context);
  }

  if (data.startsWith("run:")) {
    return handleRunCallback(data, context);
  }

  if (data === "session") {
    const session = await peekSession();
    if (!session) {
      return {
        text: "No active session.",
        buttons: [BACK_BUTTON],
      };
    }
    const lines = [
      `ID: ${session.sessionId}`,
      `Created: ${session.createdAt}`,
      `Last used: ${session.lastUsedAt}`,
    ];
    return {
      text: lines.join("\n"),
      buttons: [
        [{ text: "Clear", callback_data: "clear" }, ...BACK_BUTTON],
      ],
    };
  }

  if (data === "clear") {
    await resetSession();
    return {
      text: "Session cleared.",
      buttons: [BACK_BUTTON],
    };
  }

  if (data.startsWith("planner:")) {
    return handleTodayTasks(data.slice("planner:".length));
  }

  if (data === "skills" || data.startsWith("skills:")) {
    return handleSkillsCallback(data, context);
  }

  if (data.startsWith("skill:")) {
    return handleSkillDetailCallback(data, context);
  }

  return { text: "Unknown action.", buttons: [BACK_BUTTON] };
}
