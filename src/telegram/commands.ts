import { resetSession } from "../sessions";
import type { TelegramContext, CommandResult } from "./types";
import { menuResult } from "./shared";

export * from "./types";
export { handleCallback } from "./callbacks";
export { handleTodayTasks, handleProjects } from "./planner";

export function handleCommand(command: string, context: TelegramContext | null): CommandResult | null {
  if (command === "/menu") {
    if (!context) return { text: "Menu unavailable in standalone mode." };
    return menuResult();
  }
  return null;
}

export async function handleClearCommand(): Promise<CommandResult> {
  await resetSession();
  return { text: "Session cleared. Next message starts fresh." };
}
