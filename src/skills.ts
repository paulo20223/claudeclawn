import { readdir } from "fs/promises";
import { join } from "path";

const SKILLS_DIR = join(process.cwd(), "skills");

export interface Skill {
  name: string;
  description: string;
}

function parseFrontmatterValue(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "");
}

function parseSkillFile(content: string): Skill | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;

  const frontmatter = match[1];
  const lines = frontmatter.split("\n");

  let name = "";
  let description = "";
  let inDescription = false;

  for (const line of lines) {
    if (line.startsWith("name:")) {
      name = parseFrontmatterValue(line.replace("name:", ""));
      inDescription = false;
    } else if (line.startsWith("description:")) {
      const rest = line.replace("description:", "").trim();
      if (rest === ">" || rest === "|") {
        inDescription = true;
        description = "";
      } else {
        description = parseFrontmatterValue(rest);
        inDescription = false;
      }
    } else if (inDescription && (line.startsWith("  ") || line.startsWith("\t"))) {
      description += (description ? " " : "") + line.trim();
    } else {
      inDescription = false;
    }
  }

  if (!name) return null;
  return { name, description };
}

export async function loadSkills(): Promise<Skill[]> {
  let dirs: string[];
  try {
    dirs = await readdir(SKILLS_DIR);
  } catch {
    return [];
  }

  const skills: Skill[] = [];
  for (const dir of dirs) {
    const path = join(SKILLS_DIR, dir, "SKILL.md");
    try {
      const content = await Bun.file(path).text();
      const skill = parseSkillFile(content);
      if (skill) skills.push(skill);
    } catch {
      // no SKILL.md — skip
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}
