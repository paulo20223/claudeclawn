import { readFile, writeFile } from "fs/promises";
import { SETTINGS_FILE } from "../constants";

export async function updateSettings(patch: Record<string, unknown>): Promise<void> {
  const raw = await readFile(SETTINGS_FILE, "utf-8");
  const data = JSON.parse(raw) as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value)) {
      const existing = data[key];
      if (existing && typeof existing === "object" && !Array.isArray(existing)) {
        data[key] = { ...(existing as Record<string, unknown>), ...(value as Record<string, unknown>) };
      } else {
        data[key] = value;
      }
    } else {
      data[key] = value;
    }
  }
  await writeFile(SETTINGS_FILE, JSON.stringify(data, null, 2) + "\n");
}
