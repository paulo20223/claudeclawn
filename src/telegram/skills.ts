import type { TelegramContext, CommandResult } from "./types";
import { BACK_BUTTON, PAGE_SIZE, paginationRow } from "./shared";

export async function handleSkillsCallback(
  data: string,
  context: TelegramContext
): Promise<CommandResult> {
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
        "✏️ Создание навыка",
        "",
        "Навык — это инструкция для Claude, которая вызывается автоматически когда нужно.",
        "",
        "Отправь сюда описание навыка — что он должен делать, когда вызываться, какие инструкции дать Claude.",
        "",
        "Я создам файл за тебя.",
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

  const totalPages = Math.ceil(allSkills.length / PAGE_SIZE);
  const pageSkills = allSkills.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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

  const nav = paginationRow(page, totalPages, "skills");
  if (nav) buttons.push(nav);

  buttons.push([
    { text: "+ Из библиотеки", callback_data: "skills:add" },
    { text: "+ Создать", callback_data: "skills:create" },
  ]);
  buttons.push(BACK_BUTTON);

  const skillLines: string[] = [`Skills (${allSkills.length}) — стр. ${page + 1}/${totalPages}`, ""];
  for (const sk of pageSkills) {
    const desc = sk.description || "";
    const short = desc.length > 50 ? desc.slice(0, 50) + "…" : desc;
    skillLines.push(short ? `${sk.name} — ${short}` : sk.name);
  }

  return {
    text: skillLines.join("\n"),
    buttons,
  };
}

export async function handleSkillDetailCallback(
  data: string,
  context: TelegramContext
): Promise<CommandResult> {
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
