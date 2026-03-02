import type { TelegramContext, CommandResult } from "./types";
import { BACK_BUTTON, PAGE_SIZE, paginationRow } from "./shared";
import { nextCronMatch } from "../cron";
import { formatCountdown } from "../utils";

export async function handleJobsCallback(
  data: string,
  context: TelegramContext
): Promise<CommandResult> {
  const page = data === "jobs" ? 0 : Math.max(0, parseInt(data.slice(5), 10) || 0);
  const snap = context.getSnapshot();
  const now = new Date();
  if (snap.jobs.length === 0) {
    return {
      text: "No jobs configured.",
      buttons: [BACK_BUTTON],
    };
  }

  const totalPages = Math.ceil(snap.jobs.length / PAGE_SIZE);
  const pageJobs = snap.jobs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const lines: string[] = [];
  const buttons: { text: string; callback_data: string }[][] = [];
  for (const job of pageJobs) {
    const nextAt = nextCronMatch(job.schedule, now, snap.settings.timezoneOffsetMinutes);
    const cd = formatCountdown(nextAt.getTime() - now.getTime());
    const desc = (job.prompt || "").split("\n").find((l) => l.trim())?.trim() || "";
    const short = desc.length > 80 ? desc.slice(0, 80) + "…" : desc;
    lines.push(`<b>${job.name}</b> — ${cd}`);
    if (short) lines.push(short);
    lines.push("");
    buttons.push([{ text: `▶ ${job.name}`, callback_data: `run:${job.name}` }]);
  }

  const nav = paginationRow(page, totalPages, "jobs");
  if (nav) buttons.push(nav);

  buttons.push(BACK_BUTTON);
  return { text: lines.join("\n").trim(), buttons };
}

export async function handleRunCallback(
  data: string,
  context: TelegramContext
): Promise<CommandResult> {
  const jobName = data.slice(4);
  try {
    await context.sendMessage("Работаю над задачей");
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
