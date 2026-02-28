import { readdir } from "fs/promises";
import { join } from "path";
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
  { command: "today_tasks", description: "Задачи на сегодня" },
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
        { text: "Skills", callback_data: "skills" },
      ],
      [
        { text: "Session", callback_data: "session" },
        { text: "Clear", callback_data: "clear" },
      ],
    ],
  };
}

const BACK_BUTTON = [{ text: "« Back", callback_data: "menu" }];

// --- /today-tasks ---

const PLANNER_DIR = join(process.cwd(), ".claude", "claudeclaw", "planner");

interface PlannerTask {
  id: string;
  text: string;
  priority: "must" | "should" | "could";
  status: string;
  carried: number;
  friction: boolean;
}

function parseYamlList(content: string): PlannerTask[] {
  const tasks: PlannerTask[] = [];
  const blocks = content.split(/\n(?=\s*- id:)/);
  for (const block of blocks) {
    const idMatch = block.match(/id:\s*(\S+)/);
    const textMatch = block.match(/text:\s*["']?(.*?)["']?\s*$/m);
    const priorityMatch = block.match(/priority:\s*(\S+)/);
    const statusMatch = block.match(/status:\s*(\S+)/);
    const carriedMatch = block.match(/carried:\s*(\d+)/);
    const frictionMatch = block.match(/friction:\s*(true|false)/);
    if (!idMatch || !textMatch) continue;
    const priority = (priorityMatch?.[1] || "should") as PlannerTask["priority"];
    if (!["must", "should", "could"].includes(priority)) continue;
    tasks.push({
      id: idMatch[1],
      text: textMatch[1],
      priority,
      status: statusMatch?.[1] || "active",
      carried: parseInt(carriedMatch?.[1] || "0", 10),
      friction: frictionMatch?.[1] === "true",
    });
  }
  return tasks;
}

function parseFrontmatterList(line: string): string[] {
  const match = line.match(/\[([^\]]*)\]/);
  if (!match) return [];
  return match[1].split(",").map((s) => s.trim()).filter(Boolean);
}

function formatTaskLine(task: PlannerTask, done: boolean): string {
  const check = done ? "☑" : "☐";
  const friction = task.friction || task.carried >= 3 ? " ⚠️" : "";
  const carry = task.carried > 0 ? ` (carry x${task.carried})` : "";
  return `${check} ${task.text} (${task.id})${carry}${friction}`;
}

export async function handleTodayTasks(): Promise<CommandResult> {
  // Check if planner exists
  try {
    await readdir(PLANNER_DIR);
  } catch {
    return { text: "Планер не настроен." };
  }

  // Load index.yaml
  let indexContent: string;
  try {
    indexContent = await Bun.file(join(PLANNER_DIR, "index.yaml")).text();
  } catch {
    return { text: "Планер не настроен (нет index.yaml)." };
  }

  const allTasks = parseYamlList(indexContent);
  const activeTasks = allTasks.filter((t) => t.status === "active");

  // Check for today's day file
  const today = new Date().toISOString().slice(0, 10);
  const dayPath = join(PLANNER_DIR, "days", `${today}.md`);
  let dayContent: string | null = null;
  try {
    dayContent = await Bun.file(dayPath).text();
  } catch {
    // no day file
  }

  if (dayContent) {
    // Parse frontmatter
    const fmMatch = dayContent.match(/^---\s*\n([\s\S]*?)\n---/);
    let planned: string[] = [];
    let completed: string[] = [];
    if (fmMatch) {
      const fmLines = fmMatch[1].split("\n");
      for (const l of fmLines) {
        if (l.startsWith("planned:")) planned = parseFrontmatterList(l);
        if (l.startsWith("completed:")) completed = parseFrontmatterList(l);
      }
    }

    const completedSet = new Set(completed);
    const plannedTasks = planned
      .map((id) => allTasks.find((t) => t.id === id))
      .filter((t): t is PlannerTask => !!t);

    if (plannedTasks.length === 0) {
      return { text: `📋 ${today}\n\nНа сегодня нет запланированных задач.` };
    }

    const groups: Record<string, string[]> = { must: [], should: [], could: [] };
    for (const task of plannedTasks) {
      const done = completedSet.has(task.id) || task.status === "done";
      groups[task.priority]?.push(formatTaskLine(task, done));
    }

    const lines: string[] = [`📋 ${today}`];
    if (groups.must.length) lines.push("", "<b>Must:</b>", ...groups.must);
    if (groups.should.length) lines.push("", "<b>Should:</b>", ...groups.should);
    if (groups.could.length) lines.push("", "<b>Could:</b>", ...groups.could);

    const doneCount = plannedTasks.filter((t) => completedSet.has(t.id) || t.status === "done").length;
    lines.push("", `${doneCount}/${plannedTasks.length} выполнено`);

    return { text: lines.join("\n") };
  }

  // No day file — show all active tasks
  if (activeTasks.length === 0) {
    return { text: "Нет активных задач." };
  }

  const groups: Record<string, string[]> = { must: [], should: [], could: [] };
  for (const task of activeTasks) {
    groups[task.priority]?.push(formatTaskLine(task, false));
  }

  const lines: string[] = [`📋 Активные задачи (${activeTasks.length}):`];
  if (groups.must.length) lines.push("", "<b>Must:</b>", ...groups.must);
  if (groups.should.length) lines.push("", "<b>Should:</b>", ...groups.should);
  if (groups.could.length) lines.push("", "<b>Could:</b>", ...groups.could);

  return { text: lines.join("\n") };
}

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

  // --- Skills ---
  const SKILLS_PER_PAGE = 5;

  if (data === "skills" || data.startsWith("skills:")) {
    const sub = data === "skills" ? "0" : data.slice(7);

    if (sub === "add") {
      return {
        text: "🔧 Библиотека навыков пока в разработке.\n\nСледи за обновлениями!",
        buttons: [[{ text: "« Skills", callback_data: "skills" }]],
      };
    }

    if (sub === "create") {
      return {
        text: [
          "📝 Создай <code>skills/my-skill/SKILL.md</code>:",
          "",
          "<pre>---",
          "name: my-skill",
          'description: "Когда вызывать навык"',
          "---",
          "",
          "# Инструкции для Claude</pre>",
          "",
          "<b>description</b> — когда вызывать навык (Claude читает его при выборе).",
          "Тело — инструкции, которые Claude получит при вызове.",
          "",
          "Навык подхватится автоматически через ~30 сек.",
        ].join("\n"),
        buttons: [[{ text: "« Skills", callback_data: "skills" }]],
      };
    }

    // Page number
    const page = Math.max(0, parseInt(sub, 10) || 0);
    const snap = context.getSnapshot();
    const allSkills = snap.skills;

    if (allSkills.length === 0) {
      return {
        text: "Навыки не найдены.",
        buttons: [
          [
            { text: "+ Из библиотеки", callback_data: "skills:add" },
            { text: "+ Создать", callback_data: "skills:create" },
          ],
          BACK_BUTTON,
        ],
      };
    }

    const totalPages = Math.ceil(allSkills.length / SKILLS_PER_PAGE);
    const pageSkills = allSkills.slice(page * SKILLS_PER_PAGE, (page + 1) * SKILLS_PER_PAGE);

    const buttons: { text: string; callback_data: string }[][] = [];

    // Skill buttons in pairs
    for (let i = 0; i < pageSkills.length; i += 2) {
      const row: { text: string; callback_data: string }[] = [
        { text: pageSkills[i].name, callback_data: `skill:${pageSkills[i].name}` },
      ];
      if (pageSkills[i + 1]) {
        row.push({ text: pageSkills[i + 1].name, callback_data: `skill:${pageSkills[i + 1].name}` });
      }
      buttons.push(row);
    }

    // Pagination
    if (totalPages > 1) {
      const nav: { text: string; callback_data: string }[] = [];
      if (page > 0) nav.push({ text: "< Назад", callback_data: `skills:${page - 1}` });
      if (page < totalPages - 1) nav.push({ text: "Далее >", callback_data: `skills:${page + 1}` });
      buttons.push(nav);
    }

    buttons.push([
      { text: "+ Из библиотеки", callback_data: "skills:add" },
      { text: "+ Создать", callback_data: "skills:create" },
    ]);
    buttons.push(BACK_BUTTON);

    return {
      text: `Skills (${allSkills.length}) — стр. ${page + 1}/${totalPages}`,
      buttons,
    };
  }

  if (data.startsWith("skill:")) {
    const skillName = data.slice(6);
    const snap = context.getSnapshot();
    const skill = snap.skills.find((s) => s.name === skillName);

    if (!skill) {
      return {
        text: `Навык «${skillName}» не найден.`,
        buttons: [[{ text: "« Skills", callback_data: "skills" }]],
      };
    }

    return {
      text: `🔹 ${skill.name}\n\n${skill.description || "Нет описания."}`,
      buttons: [[{ text: "« Skills", callback_data: "skills" }]],
    };
  }

  return { text: "Unknown action.", buttons: [BACK_BUTTON] };
}
