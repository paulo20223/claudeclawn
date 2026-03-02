import { writeFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { run, runUserMessage, bootstrap, ensureProjectClaudeMd } from "../runner";
import { writeState, type StateData } from "../statusline";
import { cronMatches, nextCronMatch } from "../cron";
import { clearJobSchedule, loadJobs } from "../jobs";
import { loadSkills } from "../skills";
import { writePidFile, cleanupPidFile, checkExistingDaemon } from "../pid";
import { initConfig, loadSettings, reloadSettings, resolvePrompt, type Settings, type MtcuteConfig } from "../config";
import { startWebUi, type WebServerHandle } from "../web";
import type { Job } from "../jobs";

const CLAUDE_DIR = join(process.cwd(), ".claude");
const HEARTBEAT_DIR = join(CLAUDE_DIR, "claudeclaw");
const STATUSLINE_FILE = join(CLAUDE_DIR, "statusline.cjs");
const CLAUDE_SETTINGS_FILE = join(CLAUDE_DIR, "settings.json");
const PREFLIGHT_SCRIPT = fileURLToPath(new URL("../preflight.ts", import.meta.url));

// --- Statusline setup/teardown ---

const STATUSLINE_SCRIPT = `#!/usr/bin/env node
const { readFileSync } = require("fs");
const { join } = require("path");

const DIR = join(__dirname, "claudeclaw");
const STATE_FILE = join(DIR, "state.json");
const PID_FILE = join(DIR, "daemon.pid");

const R = "\\x1b[0m";
const DIM = "\\x1b[2m";
const RED = "\\x1b[31m";
const GREEN = "\\x1b[32m";

function fmt(ms) {
  if (ms <= 0) return GREEN + "now!" + R;
  var s = Math.floor(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  if (h > 0) return h + "h " + m + "m";
  if (m > 0) return m + "m";
  return (s % 60) + "s";
}

function alive() {
  try {
    var pid = readFileSync(PID_FILE, "utf-8").trim();
    process.kill(Number(pid), 0);
    return true;
  } catch { return false; }
}

var B = DIM + "\\u2502" + R;
var TL = DIM + "\\u256d" + R;
var TR = DIM + "\\u256e" + R;
var BL = DIM + "\\u2570" + R;
var BR = DIM + "\\u256f" + R;
var H = DIM + "\\u2500" + R;
var HEADER = TL + H.repeat(6) + " \\ud83e\\udd9e ClaudeClaw \\ud83e\\udd9e " + H.repeat(6) + TR;
var FOOTER = BL + H.repeat(30) + BR;

if (!alive()) {
  process.stdout.write(
    HEADER + "\\n" +
    B + "        " + RED + "\\u25cb offline" + R + "              " + B + "\\n" +
    FOOTER
  );
  process.exit(0);
}

try {
  var state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  var now = Date.now();
  var info = [];

  var jc = (state.jobs || []).length;
  info.push("\\ud83d\\udccb " + jc + " job" + (jc !== 1 ? "s" : ""));
  info.push(GREEN + "\\u25cf live" + R);

  if (state.telegram) {
    info.push(GREEN + "\\ud83d\\udce1" + R);
  }

  var mid = " " + info.join(" " + B + " ") + " ";

  process.stdout.write(HEADER + "\\n" + B + mid + B + "\\n" + FOOTER);
} catch {
  process.stdout.write(
    HEADER + "\\n" +
    B + DIM + "         waiting...         " + R + B + "\\n" +
    FOOTER
  );
}
`;

async function setupStatusline() {
  await mkdir(CLAUDE_DIR, { recursive: true });
  await writeFile(STATUSLINE_FILE, STATUSLINE_SCRIPT);

  let settings: Record<string, unknown> = {};
  try {
    settings = await Bun.file(CLAUDE_SETTINGS_FILE).json();
  } catch {
    // file doesn't exist or isn't valid JSON
  }
  settings.statusLine = {
    type: "command",
    command: "node .claude/statusline.cjs",
  };
  await writeFile(CLAUDE_SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
}

async function teardownStatusline() {
  try {
    const settings = await Bun.file(CLAUDE_SETTINGS_FILE).json();
    delete settings.statusLine;
    await writeFile(CLAUDE_SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n");
  } catch {
    // file doesn't exist, nothing to clean up
  }

  try {
    await unlink(STATUSLINE_FILE);
  } catch {
    // already gone
  }
}

// --- Main ---

export async function start(args: string[] = []) {
  let hasPromptFlag = false;
  let hasTriggerFlag = false;
  let telegramFlag = false;
  let debugFlag = false;
  let webFlag = false;
  let replaceExistingFlag = false;
  let webPortFlag: number | null = null;
  const payloadParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--prompt") {
      hasPromptFlag = true;
    } else if (arg === "--trigger") {
      hasTriggerFlag = true;
    } else if (arg === "--telegram") {
      telegramFlag = true;
    } else if (arg === "--debug") {
      debugFlag = true;
    } else if (arg === "--web") {
      webFlag = true;
    } else if (arg === "--replace-existing") {
      replaceExistingFlag = true;
    } else if (arg === "--web-port") {
      const raw = args[i + 1];
      if (!raw) {
        console.error("`--web-port` requires a numeric value.");
        process.exit(1);
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
        console.error("`--web-port` must be a valid TCP port (1-65535).");
        process.exit(1);
      }
      webPortFlag = parsed;
      i++;
    } else {
      payloadParts.push(arg);
    }
  }
  const payload = payloadParts.join(" ").trim();
  if (hasPromptFlag && !payload) {
    console.error("Usage: claudeclaw start --prompt <prompt> [--trigger] [--telegram] [--debug] [--web] [--web-port <port>] [--replace-existing]");
    process.exit(1);
  }
  if (!hasPromptFlag && payload) {
    console.error("Prompt text requires `--prompt`.");
    process.exit(1);
  }
  if (telegramFlag && !hasTriggerFlag) {
    console.error("`--telegram` with `start` requires `--trigger`.");
    process.exit(1);
  }
  if (hasPromptFlag && !hasTriggerFlag && (webFlag || webPortFlag !== null)) {
    console.error("`--web` is daemon-only. Remove `--prompt`, or add `--trigger`.");
    process.exit(1);
  }

  // One-shot mode: explicit prompt without trigger.
  if (hasPromptFlag && !hasTriggerFlag) {
    const existingPid = await checkExistingDaemon();
    if (existingPid) {
      console.error(`\x1b[31mAborted: daemon already running in this directory (PID ${existingPid})\x1b[0m`);
      console.error("Use `claudeclaw send <message> [--telegram]` while daemon is running.");
      process.exit(1);
    }

    await initConfig();
    await loadSettings();
    await ensureProjectClaudeMd();
    const result = await runUserMessage("prompt", payload);
    console.log(result.stdout);
    if (result.exitCode !== 0) process.exit(result.exitCode);
    return;
  }

  const existingPid = await checkExistingDaemon();
  if (existingPid) {
    if (!replaceExistingFlag) {
      console.error(`\x1b[31mAborted: daemon already running in this directory (PID ${existingPid})\x1b[0m`);
      console.error(`Use --stop first, or kill PID ${existingPid} manually.`);
      process.exit(1);
    }

    console.log(`Replacing existing daemon (PID ${existingPid})...`);
    try {
      process.kill(existingPid, "SIGTERM");
    } catch {
      // ignore if process is already dead
    }

    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      try {
        process.kill(existingPid, 0);
        await Bun.sleep(100);
      } catch {
        break;
      }
    }

    await cleanupPidFile();
  }

  await initConfig();
  const settings = await loadSettings();

  // Migration warning: heartbeat was replaced by preset job
  try {
    const rawSettings = await Bun.file(join(HEARTBEAT_DIR, "settings.json")).json();
    if (rawSettings?.heartbeat?.enabled) {
      console.warn(`\x1b[33m  ⚠ heartbeat config detected in settings.json — heartbeat is now a preset job.\x1b[0m`);
      console.warn(`\x1b[33m    The "heartbeat" key in settings is ignored. Edit .claude/claudeclaw/jobs/heartbeat.md instead.\x1b[0m`);
    }
  } catch {}

  await ensureProjectClaudeMd();
  const jobs = await loadJobs();
  const skills = await loadSkills();
  const webEnabled = webFlag || webPortFlag !== null || settings.web.enabled;
  const webPort = webPortFlag ?? settings.web.port;

  await setupStatusline();
  await writePidFile();
  let web: WebServerHandle | null = null;

  async function shutdown() {
    if (web) web.stop();
    await stopMtcute();
    await teardownStatusline();
    await cleanupPidFile();
    process.exit(0);
  }
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log("ClaudeClaw daemon started");
  console.log(`  PID: ${process.pid}`);
  console.log(`  Security: ${settings.security.level}`);
  if (settings.security.allowedTools.length > 0)
    console.log(`    + allowed: ${settings.security.allowedTools.join(", ")}`);
  if (settings.security.disallowedTools.length > 0)
    console.log(`    - blocked: ${settings.security.disallowedTools.join(", ")}`);
  console.log(`  Web UI: ${webEnabled ? `http://${settings.web.host}:${webPort}` : "disabled"}`);
  if (debugFlag) console.log("  Debug: enabled");
  console.log(`  Jobs loaded: ${jobs.length}`);
  jobs.forEach((j) => console.log(`    - ${j.name} [${j.schedule}]`));

  // --- Mutable state ---
  let currentSettings: Settings = settings;
  let currentJobs: Job[] = jobs;
  let currentSkills = skills;
  const daemonStartedAt = Date.now();

  // --- Telegram ---
  let telegramSend: ((chatId: number, text: string, format?: "plain" | "html" | "markdown") => Promise<void>) | null = null;
  let telegramToken = "";

  async function initTelegram(token: string) {
    if (token && token !== telegramToken) {
      const { startPolling, sendMessage } = await import("./telegram");
      startPolling(debugFlag, {
        sendMessage: async () => {},
        getSnapshot: () => ({
          pid: process.pid,
          startedAt: daemonStartedAt,

          settings: currentSettings,
          jobs: currentJobs,
          skills: currentSkills,
        }),
        runJob: async (jobName) => {
          const job = currentJobs.find((j) => j.name === jobName);
          if (!job) throw new Error(`Job not found: ${jobName}`);
          if (job.type === "script") {
            const result = await execScript(job.prompt);
            forwardToTelegram(job.name, result, job.format);
          } else {
            const prompt = await resolvePrompt(job.prompt);
            const result = await run(job.name, prompt);
            forwardToTelegram(job.name, result, job.format);
          }
        },
      });
      telegramSend = (chatId, text, format) => sendMessage(token, chatId, text, undefined, format);
      telegramToken = token;
      console.log(`[${ts()}] Telegram: enabled`);
    } else if (!token && telegramToken) {
      telegramSend = null;
      telegramToken = "";
      console.log(`[${ts()}] Telegram: disabled`);
    }
  }

  await initTelegram(currentSettings.telegram.token);
  if (!telegramToken) console.log("  Telegram: not configured");

  // --- mtcute (via gateway) ---
  let mtcuteConnected = false;
  let mtcuteTrackingTimer: ReturnType<typeof setInterval> | null = null;

  async function initMtcute(config: MtcuteConfig) {
    if (config.enabled && !mtcuteConnected) {
      try {
        const { isGatewayConnected } = await import("../mtcute/gateway");
        mtcuteConnected = await isGatewayConnected();
        if (mtcuteConnected) {
          console.log(`[${ts()}] mtcute: gateway connected`);
          scheduleMtcuteTracking(config);
        } else {
          console.log(`[${ts()}] mtcute: gateway not available`);
        }
      } catch (err) {
        console.error(`[${ts()}] mtcute: gateway check failed: ${err instanceof Error ? err.message : err}`);
      }
    } else if (!config.enabled && mtcuteConnected) {
      await stopMtcute();
    }
  }

  function scheduleMtcuteTracking(config: MtcuteConfig) {
    if (mtcuteTrackingTimer) {
      clearInterval(mtcuteTrackingTimer);
      mtcuteTrackingTimer = null;
    }
    if (!config.trackingEnabled || !mtcuteConnected) return;

    const intervalMs = config.trackingInterval * 60_000;
    mtcuteTrackingTimer = setInterval(async () => {
      try {
        const { checkAllTrackedChats } = await import("../mtcute/tracker");
        await checkAllTrackedChats();
      } catch (err) {
        console.error(`[${ts()}] mtcute tracking error: ${err instanceof Error ? err.message : err}`);
      }
    }, intervalMs);
    console.log(`[${ts()}] mtcute: tracking every ${config.trackingInterval}m`);
  }

  async function stopMtcute() {
    if (mtcuteTrackingTimer) {
      clearInterval(mtcuteTrackingTimer);
      mtcuteTrackingTimer = null;
    }
    mtcuteConnected = false;
  }

  function isAddrInUse(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = "code" in err ? String((err as { code?: unknown }).code) : "";
    const message = "message" in err ? String((err as { message?: unknown }).message) : "";
    return code === "EADDRINUSE" || message.includes("EADDRINUSE");
  }

  function startWebWithFallback(host: string, preferredPort: number): WebServerHandle {
    const maxAttempts = 10;
    let lastError: unknown;
    for (let i = 0; i < maxAttempts; i++) {
      const candidatePort = preferredPort + i;
      try {
        return startWebUi({
          host,
          port: candidatePort,
          token: process.env.CLAUDECLAW_WEB_TOKEN || "",
          getSnapshot: () => ({
            pid: process.pid,
            startedAt: daemonStartedAt,
  
            settings: currentSettings,
            jobs: currentJobs,
            skills: currentSkills,
          }),
          onJobsChanged: async () => {
            currentJobs = await loadJobs();
            updateState();
            console.log(`[${ts()}] Jobs reloaded from Web UI`);
          },
          onSettingsChanged: async () => {
            currentSettings = await reloadSettings();
            if (web) {
              currentSettings.web.enabled = true;
              currentSettings.web.port = web.port;
            }
            await initTelegram(currentSettings.telegram.token);
            currentJobs = await loadJobs();
            updateState();
            console.log(`[${ts()}] Settings updated from Web UI (setup)`);
          },
        });
      } catch (err) {
        lastError = err;
        if (!isAddrInUse(err) || i === maxAttempts - 1) throw err;
      }
    }

    throw lastError;
  }

  if (webEnabled) {
    currentSettings.web.enabled = true;
    web = startWebWithFallback(currentSettings.web.host, webPort);
    currentSettings.web.port = web.port;
    console.log(`[${new Date().toLocaleTimeString()}] Web UI listening on http://${web.host}:${web.port}`);
  }

  await initMtcute(currentSettings.mtcute);
  if (!mtcuteConnected) console.log("  mtcute: disabled or gateway unavailable");

  // --- Helpers ---
  function ts() { return new Date().toLocaleTimeString(); }

  function startPreflightInBackground(projectPath: string): void {
    try {
      const proc = Bun.spawn([process.execPath, "run", PREFLIGHT_SCRIPT, projectPath], {
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
      });
      proc.unref();
      console.log(`[${ts()}] Plugin preflight started in background`);
    } catch (err) {
      console.error(`[${ts()}] Failed to start plugin preflight:`, err);
    }
  }

  function forwardToTelegram(label: string, result: { exitCode: number; stdout: string; stderr: string }, format?: "plain" | "html" | "markdown") {
    if (!telegramSend || currentSettings.telegram.allowedUserIds.length === 0) return;
    const text = result.exitCode === 0
      ? `${label ? `[${label}]\n` : ""}${result.stdout || "(empty)"}`
      : `${label ? `[${label}] ` : ""}error (exit ${result.exitCode}): ${result.stderr || "Unknown"}`;
    for (const userId of currentSettings.telegram.allowedUserIds) {
      telegramSend(userId, text, format).catch((err) =>
        console.error(`[Telegram] Failed to forward to ${userId}: ${err}`)
      );
    }
  }

  async function execScript(script: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const proc = Bun.spawn(["sh", "-c", script], {
      stdout: "pipe",
      stderr: "pipe",
      cwd: process.cwd(),
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return { exitCode, stdout, stderr };
  }

  // Startup init:
  // - trigger mode: run exactly one trigger prompt (no separate bootstrap)
  // - normal mode: bootstrap to initialize session context
  if (hasTriggerFlag) {
    const triggerPrompt = hasPromptFlag ? payload : "Wake up, my friend!";
    const triggerResult = await run("trigger", triggerPrompt);
    console.log(triggerResult.stdout);
    if (telegramFlag) forwardToTelegram("", triggerResult);
    if (triggerResult.exitCode !== 0) {
      console.error(`[${ts()}] Startup trigger failed (exit ${triggerResult.exitCode}). Daemon will continue running.`);
    }
  } else {
    // Bootstrap the session first so system prompt is initial context
    // and session.json is created immediately.
    await bootstrap();
  }

  // Install plugins without blocking daemon startup.
  startPreflightInBackground(process.cwd());

  // --- Hot-reload loop (every 30s) ---
  setInterval(async () => {
    try {
      const newSettings = await reloadSettings();
      const newJobs = await loadJobs();
      currentSkills = await loadSkills();

      // Detect security config changes
      const secChanged =
        newSettings.security.level !== currentSettings.security.level ||
        newSettings.security.allowedTools.join(",") !== currentSettings.security.allowedTools.join(",") ||
        newSettings.security.disallowedTools.join(",") !== currentSettings.security.disallowedTools.join(",");

      if (secChanged) {
        console.log(`[${ts()}] Security level changed → ${newSettings.security.level}`);
      }

      currentSettings = newSettings;
      if (web) {
        currentSettings.web.enabled = true;
        currentSettings.web.port = web.port;
      }

      // Detect job changes
      const jobNames = newJobs.map((j) => `${j.name}:${j.schedule}:${j.prompt}`).sort().join("|");
      const oldJobNames = currentJobs.map((j) => `${j.name}:${j.schedule}:${j.prompt}`).sort().join("|");
      if (jobNames !== oldJobNames) {
        console.log(`[${ts()}] Jobs reloaded: ${newJobs.length} job(s)`);
        newJobs.forEach((j) => console.log(`    - ${j.name} [${j.schedule}]`));
      }
      currentJobs = newJobs;

      // Telegram changes
      await initTelegram(newSettings.telegram.token);

      // mtcute changes
      const mtcuteChanged =
        newSettings.mtcute.enabled !== currentSettings.mtcute.enabled ||
        newSettings.mtcute.trackingEnabled !== currentSettings.mtcute.trackingEnabled ||
        newSettings.mtcute.trackingInterval !== currentSettings.mtcute.trackingInterval;
      if (mtcuteChanged) {
        console.log(`[${ts()}] mtcute config changed — reinitializing`);
        await stopMtcute();
        await initMtcute(newSettings.mtcute);
      }
    } catch (err) {
      console.error(`[${ts()}] Hot-reload error:`, err);
    }
  }, 30_000);

  // --- Cron tick (every 60s) ---
  function updateState() {
    const now = new Date();
    const state: StateData = {
      jobs: currentJobs.map((job) => ({
        name: job.name,
        nextAt: nextCronMatch(job.schedule, now, currentSettings.timezoneOffsetMinutes).getTime(),
      })),
      security: currentSettings.security.level,
      telegram: !!currentSettings.telegram.token,
      startedAt: daemonStartedAt,
      web: {
        enabled: !!web,
        host: currentSettings.web.host,
        port: currentSettings.web.port,
      },
      mtcute: mtcuteConnected
        ? { connected: true, trackedChats: 0 }
        : undefined,
    };
    writeState(state);
  }

  updateState();

  setInterval(() => {
    const now = new Date();
    for (const job of currentJobs) {
      if (cronMatches(job.schedule, now, currentSettings.timezoneOffsetMinutes)) {
        const exec = job.type === "script"
          ? execScript(job.prompt)
          : resolvePrompt(job.prompt).then((prompt) => run(job.name, prompt));
        exec
          .then((r) => {
            if (job.notify === false) return;
            if (job.notify === "error" && r.exitCode === 0) return;
            forwardToTelegram(job.name, r, job.format);
          })
          .finally(async () => {
            if (job.recurring) return;
            try {
              await clearJobSchedule(job.name);
              console.log(`[${ts()}] Cleared schedule for one-time job: ${job.name}`);
            } catch (err) {
              console.error(`[${ts()}] Failed to clear schedule for ${job.name}:`, err);
            }
          });
      }
    }
    updateState();
  }, 60_000);
}
