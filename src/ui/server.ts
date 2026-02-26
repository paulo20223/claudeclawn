import { htmlPage } from "./page/html";
import { loginPage } from "./page/login";
import { setupPage } from "./page/setup";
import { clampInt, json } from "./http";
import type { StartWebUiOptions, WebServerHandle } from "./types";
import { isConfigured } from "../config";
import { buildState, buildTechnicalInfo, sanitizeSettings } from "./services/state";
import { readHeartbeatSettings, updateHeartbeatSettings, updateSettings } from "./services/settings";
import { createQuickJob, deleteJob } from "./services/jobs";
import { readLogs } from "./services/logs";

function parseCookie(header: string, name: string): string {
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function buildAuthCookie(token: string): string {
  return `claw_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`;
}

export function startWebUi(opts: StartWebUiOptions): WebServerHandle {
  const token = opts.token || "";

  const server = Bun.serve({
    hostname: opts.host,
    port: opts.port,
    fetch: async (req) => {
      const url = new URL(req.url);

      // --- Auth gate ---
      if (token) {
        const cookieHeader = req.headers.get("cookie") || "";
        const cookieToken = parseCookie(cookieHeader, "claw_token");
        const queryToken = url.searchParams.get("token") || "";

        if (cookieToken !== token) {
          if (queryToken === token) {
            // Valid query token — set cookie
            const isApi = url.pathname.startsWith("/api/");
            if (isApi) {
              // For API requests: serve response with Set-Cookie header
              const response = await handleRoute(req, url, opts);
              response.headers.set("Set-Cookie", buildAuthCookie(token));
              return response;
            }
            // For HTML pages: redirect to strip token from URL
            const clean = url.pathname + (url.search ? url.search.replace(/[?&]token=[^&]*/, "").replace(/^&/, "?") : "");
            const redirectTo = clean === "" || clean === "?" ? "/" : clean;
            return new Response(null, {
              status: 302,
              headers: {
                Location: redirectTo,
                "Set-Cookie": buildAuthCookie(token),
              },
            });
          }

          // No valid token
          if (url.pathname.startsWith("/api/")) {
            return json({ error: "unauthorized" }, 401);
          }
          return new Response(loginPage(), {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
      }

      return handleRoute(req, url, opts);
    },
  });

  return {
    stop: () => server.stop(),
    host: opts.host,
    port: server.port,
  };
}

async function handleRoute(req: Request, url: URL, opts: StartWebUiOptions): Promise<Response> {
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const snapshot = opts.getSnapshot();
    if (!isConfigured(snapshot.settings)) {
      return new Response(setupPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response(htmlPage(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (url.pathname === "/api/setup" && req.method === "POST") {
    try {
      const body = await req.json() as Record<string, unknown>;
      const model = typeof body.model === "string" ? body.model.trim() : "";
      if (!model) {
        return json({ ok: false, error: "model is required" }, 400);
      }
      await updateSettings(body);
      if (opts.onSettingsChanged) {
        await opts.onSettingsChanged();
      }
      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  if (url.pathname === "/api/health") {
    return json({ ok: true, now: Date.now() });
  }

  if (url.pathname === "/api/state") {
    return json(await buildState(opts.getSnapshot()));
  }

  if (url.pathname === "/api/settings") {
    return json(sanitizeSettings(opts.getSnapshot().settings));
  }

  if (url.pathname === "/api/settings/heartbeat" && req.method === "POST") {
    try {
      const body = await req.json();
      const payload = body as {
        enabled?: unknown;
        interval?: unknown;
        prompt?: unknown;
        excludeWindows?: unknown;
      };
      const patch: {
        enabled?: boolean;
        interval?: number;
        prompt?: string;
        excludeWindows?: Array<{ days?: number[]; start: string; end: string }>;
      } = {};

      if ("enabled" in payload) patch.enabled = Boolean(payload.enabled);
      if ("interval" in payload) {
        const iv = Number(payload.interval);
        if (!Number.isFinite(iv)) throw new Error("interval must be numeric");
        patch.interval = iv;
      }
      if ("prompt" in payload) patch.prompt = String(payload.prompt ?? "");
      if ("excludeWindows" in payload) {
        if (!Array.isArray(payload.excludeWindows)) {
          throw new Error("excludeWindows must be an array");
        }
        patch.excludeWindows = payload.excludeWindows
          .filter((entry) => entry && typeof entry === "object")
          .map((entry) => {
            const row = entry as Record<string, unknown>;
            const start = String(row.start ?? "").trim();
            const end = String(row.end ?? "").trim();
            const days = Array.isArray(row.days)
              ? row.days
                  .map((d) => Number(d))
                  .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
              : undefined;
            return {
              start,
              end,
              ...(days && days.length > 0 ? { days } : {}),
            };
          });
      }

      if (
        !("enabled" in patch) &&
        !("interval" in patch) &&
        !("prompt" in patch) &&
        !("excludeWindows" in patch)
      ) {
        throw new Error("no heartbeat fields provided");
      }

      const next = await updateHeartbeatSettings(patch);
      if (opts.onHeartbeatEnabledChanged && "enabled" in patch) {
        await opts.onHeartbeatEnabledChanged(Boolean(patch.enabled));
      }
      if (opts.onHeartbeatSettingsChanged) {
        await opts.onHeartbeatSettingsChanged(patch);
      }
      return json({ ok: true, heartbeat: next });
    } catch (err) {
      return json({ ok: false, error: String(err) });
    }
  }

  if (url.pathname === "/api/settings/heartbeat" && req.method === "GET") {
    try {
      return json({ ok: true, heartbeat: await readHeartbeatSettings() });
    } catch (err) {
      return json({ ok: false, error: String(err) });
    }
  }

  if (url.pathname === "/api/technical-info") {
    return json(await buildTechnicalInfo(opts.getSnapshot()));
  }

  if (url.pathname === "/api/jobs/quick" && req.method === "POST") {
    try {
      const body = await req.json();
      const result = await createQuickJob(body as { time?: unknown; prompt?: unknown });
      if (opts.onJobsChanged) await opts.onJobsChanged();
      return json({ ok: true, ...result });
    } catch (err) {
      return json({ ok: false, error: String(err) });
    }
  }

  if (url.pathname.startsWith("/api/jobs/") && req.method === "DELETE") {
    try {
      const encodedName = url.pathname.slice("/api/jobs/".length);
      const name = decodeURIComponent(encodedName);
      await deleteJob(name);
      if (opts.onJobsChanged) await opts.onJobsChanged();
      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: String(err) });
    }
  }

  if (url.pathname === "/api/jobs") {
    const jobs = opts.getSnapshot().jobs.map((j) => ({
      name: j.name,
      schedule: j.schedule,
      promptPreview: j.prompt.slice(0, 160),
    }));
    return json({ jobs });
  }

  if (url.pathname === "/api/logs") {
    const tail = clampInt(url.searchParams.get("tail"), 200, 20, 2000);
    return json(await readLogs(tail));
  }

  return new Response("Not found", { status: 404 });
}
