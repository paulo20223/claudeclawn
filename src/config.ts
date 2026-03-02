import { join, isAbsolute } from "path";
import { mkdir, readdir } from "fs/promises";
import { existsSync } from "fs";
import { normalizeTimezoneName, resolveTimezoneOffsetMinutes } from "./timezone";

const HEARTBEAT_DIR = join(process.cwd(), ".claude", "claudeclaw");
const SETTINGS_FILE = join(HEARTBEAT_DIR, "settings.json");
const JOBS_DIR = join(HEARTBEAT_DIR, "jobs");
const LOGS_DIR = join(HEARTBEAT_DIR, "logs");

const DEFAULT_SETTINGS: Settings = {
  model: "",
  api: "",
  fallback: {
    model: "",
    api: "",
  },
  timezone: "UTC",
  timezoneOffsetMinutes: 0,
  language: "Русский",
  telegram: { token: "", allowedUserIds: [] },
  security: { level: "moderate", allowedTools: [], disallowedTools: [] },
  web: { enabled: false, port: 4632 },
  mtcute: {
    apiId: 0,
    apiHash: "",
    phoneNumber: "",
    sessionName: "claudeclaw",
    enabled: false,
    trackingInterval: 30,
    trackingEnabled: false,
    gatewayUrl: "http://tg:3000",
  },
};

export interface TelegramConfig {
  token: string;
  allowedUserIds: number[];
}

export type SecurityLevel =
  | "locked"
  | "strict"
  | "moderate"
  | "unrestricted";

export interface SecurityConfig {
  level: SecurityLevel;
  allowedTools: string[];
  disallowedTools: string[];
}

export interface MtcuteConfig {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  sessionName: string;
  enabled: boolean;
  trackingInterval: number;
  trackingEnabled: boolean;
  gatewayUrl: string;
}

export interface Settings {
  model: string;
  api: string;
  fallback: ModelConfig;
  timezone: string;
  timezoneOffsetMinutes: number;
  language: string;
  telegram: TelegramConfig;
  security: SecurityConfig;
  web: WebConfig;
  mtcute: MtcuteConfig;
}

export interface ModelConfig {
  model: string;
  api: string;
}

export interface WebConfig {
  enabled: boolean;
  host: string;
  port: number;
}

let cached: Settings | null = null;

export async function initConfig(): Promise<void> {
  await mkdir(HEARTBEAT_DIR, { recursive: true });
  await mkdir(JOBS_DIR, { recursive: true });
  await mkdir(LOGS_DIR, { recursive: true });
  await mkdir(join(HEARTBEAT_DIR, "mtcute"), { recursive: true });

  if (!existsSync(SETTINGS_FILE)) {
    await Bun.write(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2) + "\n");
  }

  await installPresetJobs(JOBS_DIR);
}

async function installPresetJobs(jobsDir: string): Promise<void> {
  const presetsDir = join(import.meta.dir, "..", "presets", "jobs");
  let presets: string[];
  try {
    presets = (await readdir(presetsDir)).filter(f => f.endsWith(".md"));
  } catch {
    console.log(`  Presets directory not found: ${presetsDir}`);
    return;
  }

  let installed = 0;
  for (const file of presets) {
    const dest = join(jobsDir, file);
    if (existsSync(dest)) continue;
    const content = await Bun.file(join(presetsDir, file)).text();
    await Bun.write(dest, content);
    installed++;
  }
  if (installed > 0) {
    console.log(`  Preset jobs installed: ${installed}`);
  }
}

const VALID_LEVELS = new Set<SecurityLevel>([
  "locked",
  "strict",
  "moderate",
  "unrestricted",
]);

function parseSettings(raw: Record<string, any>): Settings {
  const rawLevel = raw.security?.level;
  const level: SecurityLevel =
    typeof rawLevel === "string" && VALID_LEVELS.has(rawLevel as SecurityLevel)
      ? (rawLevel as SecurityLevel)
      : "moderate";

  const parsedTimezone = parseTimezone(raw.timezone);

  return {
    model: typeof raw.model === "string" ? raw.model.trim() : "",
    api: typeof raw.api === "string" ? raw.api.trim() : "",
    fallback: {
      model: typeof raw.fallback?.model === "string" ? raw.fallback.model.trim() : "",
      api: typeof raw.fallback?.api === "string" ? raw.fallback.api.trim() : "",
    },
    timezone: parsedTimezone,
    timezoneOffsetMinutes: parseTimezoneOffsetMinutes(raw.timezoneOffsetMinutes, parsedTimezone),
    language: typeof raw.language === "string" ? raw.language.trim() : "Русский",
    telegram: {
      token: raw.telegram?.token ?? "",
      allowedUserIds: raw.telegram?.allowedUserIds ?? [],
    },
    security: {
      level,
      allowedTools: Array.isArray(raw.security?.allowedTools)
        ? raw.security.allowedTools
        : [],
      disallowedTools: Array.isArray(raw.security?.disallowedTools)
        ? raw.security.disallowedTools
        : [],
    },
    web: {
      enabled: raw.web?.enabled ?? false,
      host: process.env.CLAUDECLAW_WEB_HOST ?? raw.web?.host ?? "127.0.0.1",
      port: Number.isFinite(raw.web?.port) ? Number(raw.web.port) : 4632,
    },
    mtcute: {
      apiId: Number.isFinite(raw.mtcute?.apiId) ? Number(raw.mtcute.apiId) : 0,
      apiHash: typeof raw.mtcute?.apiHash === "string" ? raw.mtcute.apiHash.trim() : "",
      phoneNumber: typeof raw.mtcute?.phoneNumber === "string" ? raw.mtcute.phoneNumber.trim() : "",
      sessionName: typeof raw.mtcute?.sessionName === "string" && raw.mtcute.sessionName.trim()
        ? raw.mtcute.sessionName.trim()
        : "claudeclaw",
      enabled: raw.mtcute?.enabled ?? false,
      trackingInterval: Number.isFinite(raw.mtcute?.trackingInterval)
        ? Math.max(1, Number(raw.mtcute.trackingInterval))
        : 30,
      trackingEnabled: raw.mtcute?.trackingEnabled ?? false,
      gatewayUrl: typeof raw.mtcute?.gatewayUrl === "string" && raw.mtcute.gatewayUrl.trim()
        ? raw.mtcute.gatewayUrl.trim()
        : (process.env.MTCUTE_URL || "http://tg:3000"),
    },
  };
}

function parseTimezone(value: unknown): string {
  return normalizeTimezoneName(value);
}

function parseTimezoneOffsetMinutes(value: unknown, timezoneFallback?: string): number {
  return resolveTimezoneOffsetMinutes(value, timezoneFallback);
}

export async function loadSettings(): Promise<Settings> {
  if (cached) return cached;
  const raw = await Bun.file(SETTINGS_FILE).json();
  cached = parseSettings(raw);
  return cached;
}

/** Re-read settings from disk, bypassing cache. */
export async function reloadSettings(): Promise<Settings> {
  const raw = await Bun.file(SETTINGS_FILE).json();
  cached = parseSettings(raw);
  return cached;
}


export function getSettings(): Settings {
  if (!cached) throw new Error("Settings not loaded. Call loadSettings() first.");
  return cached;
}

const PROMPT_EXTENSIONS = [".md", ".txt", ".prompt"];

/**
 * If the prompt string looks like a file path (ends with .md, .txt, or .prompt),
 * read and return the file contents. Otherwise return the string as-is.
 * Relative paths are resolved from the project root (cwd).
 */
export async function resolvePrompt(prompt: string): Promise<string> {
  const trimmed = prompt.trim();
  if (!trimmed) return trimmed;

  const isPath = PROMPT_EXTENSIONS.some((ext) => trimmed.endsWith(ext));
  if (!isPath) return trimmed;

  const resolved = isAbsolute(trimmed) ? trimmed : join(process.cwd(), trimmed);
  try {
    const content = await Bun.file(resolved).text();
    return content.trim();
  } catch {
    console.warn(`[config] Prompt path "${trimmed}" not found, using as literal string`);
    return trimmed;
  }
}
