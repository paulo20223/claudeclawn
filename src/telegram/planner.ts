import { join } from "path";
import type { CommandResult } from "./types";

const PLANNER_DIR = join(process.cwd(), ".claude", "claudeclaw", "planner");

interface PlannerTask {
  id: string;
  text: string;
  status: string;
  carried: number;
  friction: boolean;
  project: string;
  due: string;
}

const DAY_NAMES = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTH_NAMES = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function parseYamlList(content: string): PlannerTask[] {
  const tasks: PlannerTask[] = [];
  const blocks = content.split(/\n(?=\s*- id:)/);
  for (const block of blocks) {
    const idMatch = block.match(/id:\s*(\S+)/);
    const textMatch = block.match(/text:\s*["']?(.*?)["']?\s*$/m);
    const statusMatch = block.match(/status:\s*(\S+)/);
    const carriedMatch = block.match(/carried:\s*(\d+)/);
    const frictionMatch = block.match(/friction:\s*(true|false)/);
    const projectMatch = block.match(/project:\s*["']?(.*?)["']?\s*$/m);
    const dueMatch = block.match(/due:\s*["']?([\d-]+)["']?/);
    if (!idMatch || !textMatch) continue;
    tasks.push({
      id: idMatch[1],
      text: textMatch[1],
      status: statusMatch?.[1] || "active",
      carried: parseInt(carriedMatch?.[1] || "0", 10),
      friction: frictionMatch?.[1] === "true",
      project: projectMatch?.[1]?.trim() || "",
      due: dueMatch?.[1] || "",
    });
  }
  return tasks;
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function formatHeader(target: Date, today: Date): string {
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  const dd = target.getDate();
  const mmm = MONTH_NAMES[target.getMonth()];
  if (diff === -1) return `Вчера (${dd} ${mmm})`;
  if (diff === 0) return `Сегодня (${dd} ${mmm})`;
  if (diff === 1) return `Завтра (${dd} ${mmm})`;
  const day = DAY_NAMES[target.getDay()];
  return `${dd} ${mmm}, ${day}`;
}

function formatDue(due: string, today: string): string {
  if (!due || due === today) return "";
  const d = new Date(due + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  const day = DAY_NAMES[d.getDay()];
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return ` (${day}, ${dd}.${mm})`;
}

interface Project {
  name: string;
  status: string;
  focus: string;
  deadline: string;
  notes: string;
}

function parseProjectsYaml(content: string): Project[] {
  const projects: Project[] = [];
  const blocks = content.split(/\n(?=\s*- name:)/);
  for (const block of blocks) {
    const nameMatch = block.match(/name:\s*["']?(.*?)["']?\s*$/m);
    if (!nameMatch) continue;
    const statusMatch = block.match(/status:\s*["']?(.*?)["']?\s*$/m);
    const focusMatch = block.match(/focus:\s*["']?(.*?)["']?\s*$/m);
    const deadlineMatch = block.match(/deadline:\s*["']?(.*?)["']?\s*$/m);
    const notesMatch = block.match(/notes:\s*["']?(.*?)["']?\s*$/m);
    projects.push({
      name: nameMatch[1].trim(),
      status: statusMatch?.[1]?.trim() || "active",
      focus: focusMatch?.[1]?.trim() || "",
      deadline: deadlineMatch?.[1]?.trim() || "",
      notes: notesMatch?.[1]?.trim() || "",
    });
  }
  return projects;
}

export async function handleProjects(): Promise<CommandResult> {
  let content: string;
  try {
    content = await Bun.file(join(PLANNER_DIR, "context", "projects.yaml")).text();
  } catch {
    return { text: "Проекты не настроены." };
  }

  const projects = parseProjectsYaml(content);
  if (projects.length === 0) return { text: "Проекты не настроены." };

  const lines: string[] = ["📋 Проекты", ""];

  for (const p of projects) {
    lines.push(`${p.name} — ${p.status || "active"}`);
    if (p.focus) lines.push(`↳ ${p.focus}`);
    if (p.deadline) lines.push(`⏰ дедлайн: ${p.deadline}`);
    if (p.notes) lines.push(`📝 ${p.notes}`);
    lines.push("");
  }

  return { text: lines.join("\n").trimEnd() };
}

export async function handleTodayTasks(targetDateStr?: string): Promise<CommandResult> {
  let indexContent: string;
  try {
    indexContent = await Bun.file(join(PLANNER_DIR, "index.yaml")).text();
  } catch {
    return { text: "Планер не настроен." };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = targetDateStr ? new Date(targetDateStr + "T00:00:00") : today;
  const targetStr = dateStr(target);
  const todayS = dateStr(today);

  const allTasks = parseYamlList(indexContent);

  // Filter: active/done + due <= target date
  const tasks = allTasks.filter(
    (t) =>
      (t.status === "active" || t.status === "done") &&
      t.due !== "" &&
      t.due <= targetStr,
  );

  const header = formatHeader(target, today);

  const prevDate = dateStr(addDays(target, -1));
  const nextDate = dateStr(addDays(target, 1));
  const buttons = [
    [
      { text: "« Назад", callback_data: `planner:${prevDate}` },
      { text: "Вперёд »", callback_data: `planner:${nextDate}` },
    ],
  ];

  if (tasks.length === 0) {
    return { text: `${header}\n\nНичего не запланировано 🎉`, buttons };
  }

  // Group by project
  const groups = new Map<string, PlannerTask[]>();
  for (const t of tasks) {
    const key = t.project || "Разное";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  // Sort: projects with active tasks first, then all-done projects
  const entries = [...groups.entries()].sort((a, b) => {
    const aHasActive = a[1].some((t) => t.status === "active");
    const bHasActive = b[1].some((t) => t.status === "active");
    if (aHasActive && !bHasActive) return -1;
    if (!aHasActive && bHasActive) return 1;
    return 0;
  });

  const lines: string[] = [header, ""];

  for (const [project, projectTasks] of entries) {
    const allDone = projectTasks.every((t) => t.status === "done");

    if (allDone) {
      lines.push(`${project} — выполнено ✓`);
    } else {
      lines.push(project);
      for (const t of projectTasks) {
        const check = t.status === "done" ? "x" : " ";
        const due = formatDue(t.due, todayS);
        lines.push(`• [${check}] ${t.text}${due}`);
      }
    }
  }

  return { text: lines.join("\n"), buttons };
}
