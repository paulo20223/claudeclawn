import { join } from "path";
import { existsSync, readFileSync } from "fs";
import { callApi } from "./api";

const STICKERS_FILE = join(process.cwd(), ".claude", "claudeclaw", "stickers.json");

interface StickerEntry {
  file_id: string;
  emoji: string;
}

interface StickerPack {
  title: string;
  addedAt: string;
  stickers: StickerEntry[];
}

interface StickersData {
  packs: Record<string, StickerPack>;
}

function loadData(): StickersData {
  try {
    if (!existsSync(STICKERS_FILE)) return { packs: {} };
    const raw = readFileSync(STICKERS_FILE, "utf-8");
    return JSON.parse(raw) as StickersData;
  } catch {
    return { packs: {} };
  }
}

async function saveData(data: StickersData): Promise<void> {
  await Bun.write(STICKERS_FILE, JSON.stringify(data, null, 2));
}

export async function learnStickerPack(
  token: string,
  setName: string
): Promise<{ title: string; count: number }> {
  const res = await callApi<{
    ok: boolean;
    result: {
      name: string;
      title: string;
      stickers: Array<{ file_id: string; emoji?: string }>;
    };
  }>(token, "getStickerSet", { name: setName });

  const pack: StickerPack = {
    title: res.result.title,
    addedAt: new Date().toISOString(),
    stickers: res.result.stickers
      .filter((s) => s.emoji)
      .map((s) => ({ file_id: s.file_id, emoji: s.emoji! })),
  };

  const data = loadData();
  data.packs[setName] = pack;
  await saveData(data);

  return { title: pack.title, count: pack.stickers.length };
}

export function findStickerByEmoji(emoji: string): string | null {
  const data = loadData();
  const packs = Object.values(data.packs);
  if (packs.length === 0) return null;

  // Приоритет: последний добавленный пак
  const sorted = packs.sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  );

  for (const pack of sorted) {
    const matches = pack.stickers.filter((s) => s.emoji === emoji);
    if (matches.length > 0) {
      return matches[Math.floor(Math.random() * matches.length)].file_id;
    }
  }

  return null;
}

export function extractStickerDirective(
  text: string
): { cleanedText: string; stickerEmoji: string | null } {
  let stickerEmoji: string | null = null;
  const cleanedText = text
    .replace(/\[sticker:([^\]\r\n]+)\]/gi, (_match, raw) => {
      const candidate = String(raw).trim();
      if (!stickerEmoji && candidate) stickerEmoji = candidate;
      return "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { cleanedText, stickerEmoji };
}

export function getAvailableEmoji(): string[] {
  const data = loadData();
  const emojiSet = new Set<string>();
  for (const pack of Object.values(data.packs)) {
    for (const s of pack.stickers) {
      emojiSet.add(s.emoji);
    }
  }
  return [...emojiSet];
}
