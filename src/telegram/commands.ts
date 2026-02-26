import type { WebSnapshot } from "../ui/types";
import { resetSession, peekSession } from "../sessions";
import { nextCronMatch } from "../cron";

export interface TelegramContext {
  getSnapshot: () => WebSnapshot;
  runJob: (jobName: string) => Promise<void>;
}

export interface CommandResult {
  text: string;
  buttons?: { text: string; callback_data: string }[][];
}

export const COMMAND_MENU = [
  { command: "menu", description: "Быстрые действия" },
  { command: "clear", description: "Сброс сессии" },
];

function formatCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s % 60}s`;
}

function menuResult(): CommandResult {
  return {
    text: "Menu",
    buttons: [
      [
        { text: "Jobs", callback_data: "jobs" },
        { text: "Session", callback_data: "session" },
      ],
      [{ text: "Clear", callback_data: "clear" }],
    ],
  };
}

const BACK_BUTTON = [{ text: "« Back", callback_data: "menu" }];

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

  if (data === "jobs") {
    const snap = context.getSnapshot();
    const now = new Date();
    if (snap.jobs.length === 0) {
      return {
        text: "No jobs configured.",
        buttons: [BACK_BUTTON],
      };
    }
    const lines: string[] = [];
    const buttons: { text: string; callback_data: string }[][] = [];
    for (const job of snap.jobs) {
      const nextAt = nextCronMatch(job.schedule, now, snap.settings.timezoneOffsetMinutes);
      const cd = formatCountdown(nextAt.getTime() - now.getTime());
      lines.push(`${job.name} — ${cd}`);
      buttons.push([{ text: `▶ ${job.name}`, callback_data: `run:${job.name}` }]);
    }
    buttons.push(BACK_BUTTON);
    return { text: lines.join("\n"), buttons };
  }

  if (data.startsWith("run:")) {
    const jobName = data.slice(4);
    try {
      context.runJob(jobName).catch((err) => {
        console.error(`[Telegram] Job run error (${jobName}): ${err instanceof Error ? err.message : err}`);
      });
      return {
        text: `Triggered: ${jobName}`,
        buttons: [BACK_BUTTON],
      };
    } catch (err) {
      return {
        text: `Failed: ${err instanceof Error ? err.message : err}`,
        buttons: [BACK_BUTTON],
      };
    }
  }

  if (data === "session") {
    const session = await peekSession();
    if (!session) {
      return {
        text: "No active session.",
        buttons: [
          BACK_BUTTON,
        ],
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

  return { text: "Unknown action.", buttons: [BACK_BUTTON] };
}
