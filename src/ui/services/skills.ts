import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";

const SKILLS_DIR = join(process.cwd(), "skills");

export interface CreateSkillInput {
  name?: unknown;
  description?: unknown;
  content?: unknown;
}

export async function createSkill(input: CreateSkillInput): Promise<{ name: string }> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const content = typeof input.content === "string" ? input.content.trim() : "";

  if (!name) throw new Error("Name is required.");
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error("Name must be alphanumeric with hyphens/underscores.");
  if (!description) throw new Error("Description is required.");

  const dir = join(SKILLS_DIR, name);
  const path = join(dir, "SKILL.md");

  await mkdir(dir, { recursive: true });

  const body = content ? `\n${content}\n` : "\n";
  const fileContent = `---\nname: ${name}\ndescription: ${description}\n---${body}`;

  await writeFile(path, fileContent, "utf-8");
  return { name };
}

export async function deleteSkill(name: string): Promise<void> {
  const skillName = String(name || "").trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(skillName)) {
    throw new Error("Invalid skill name.");
  }
  const dir = join(SKILLS_DIR, skillName);
  await rm(dir, { recursive: true, force: true });
}
