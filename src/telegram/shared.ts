import type { CommandResult } from "./types";

export const BACK_BUTTON = [{ text: "« Назад", callback_data: "menu" }];

export const PAGE_SIZE = 5;

export function paginationRow(page: number, totalPages: number, prefix: string) {
  if (totalPages <= 1) return null;
  const nav: { text: string; callback_data: string }[] = [];
  if (page > 0) nav.push({ text: "< Назад", callback_data: `${prefix}:${page - 1}` });
  if (page < totalPages - 1) nav.push({ text: "Далее >", callback_data: `${prefix}:${page + 1}` });
  return nav;
}

export function menuResult(): CommandResult {
  return {
    text: "Menu",
    buttons: [
      [
        { text: "Jobs", callback_data: "jobs" },
        { text: "Skills", callback_data: "skills" },
      ],
    ],
  };
}
