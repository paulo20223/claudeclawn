import { join } from "path";
import { mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import type { ChatNote } from "./types";

const NOTES_DIR = join(process.cwd(), ".claude", "claudeclaw", "mtcute", "notes");

function noteToMarkdown(note: ChatNote): string {
  const frontmatter = [
    "---",
    `chatId: ${note.chatId}`,
    `chatTitle: "${note.chatTitle.replace(/"/g, '\\"')}"`,
    `timestamp: "${note.timestamp}"`,
    `source: ${note.source}`,
  ];
  if (note.tags && note.tags.length > 0) {
    frontmatter.push(`tags: [${note.tags.join(", ")}]`);
  }
  frontmatter.push("---");

  return `${frontmatter.join("\n")}\n\n${note.content}\n`;
}

function parseNoteFromMarkdown(content: string): ChatNote | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2].trim();

  const chatIdMatch = frontmatter.match(/chatId:\s*(\d+)/);
  const chatTitleMatch = frontmatter.match(/chatTitle:\s*"([^"]*)"/);
  const timestampMatch = frontmatter.match(/timestamp:\s*"([^"]*)"/);
  const sourceMatch = frontmatter.match(/source:\s*(auto|manual)/);
  const tagsMatch = frontmatter.match(/tags:\s*\[([^\]]*)\]/);

  if (!chatIdMatch || !timestampMatch || !sourceMatch) return null;

  return {
    chatId: Number(chatIdMatch[1]),
    chatTitle: chatTitleMatch?.[1] ?? "",
    timestamp: timestampMatch[1],
    content: body,
    source: sourceMatch[1] as "auto" | "manual",
    tags: tagsMatch ? tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean) : undefined,
  };
}

export async function saveNote(note: ChatNote): Promise<string> {
  const chatDir = join(NOTES_DIR, String(note.chatId));
  await mkdir(chatDir, { recursive: true });

  const safeTimestamp = note.timestamp.replace(/[:.]/g, "-");
  const filename = `${safeTimestamp}.md`;
  const filePath = join(chatDir, filename);

  await Bun.write(filePath, noteToMarkdown(note));
  return filePath;
}

export async function listNotes(chatId: number): Promise<ChatNote[]> {
  const chatDir = join(NOTES_DIR, String(chatId));
  if (!existsSync(chatDir)) return [];

  const files = await readdir(chatDir);
  const notes: ChatNote[] = [];

  for (const file of files.filter((f) => f.endsWith(".md")).sort()) {
    const content = await Bun.file(join(chatDir, file)).text();
    const note = parseNoteFromMarkdown(content);
    if (note) notes.push(note);
  }

  return notes;
}

export async function listAllNotes(): Promise<ChatNote[]> {
  if (!existsSync(NOTES_DIR)) return [];

  const chatDirs = await readdir(NOTES_DIR);
  const allNotes: ChatNote[] = [];

  for (const dir of chatDirs) {
    const chatId = Number(dir);
    if (!Number.isFinite(chatId)) continue;
    const notes = await listNotes(chatId);
    allNotes.push(...notes);
  }

  return allNotes.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
