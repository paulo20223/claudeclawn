export function setupPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClaudeClaw — Setup</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-top: #2a4262;
    --bg-bottom: #0d1828;
    --bg-spot-a: #7fb8ff3d;
    --bg-spot-b: #95d1ff38;
    --text: #f0f4fb;
    --muted: #a8b4c5;
    --panel: #0b1220aa;
    --border: #d8e4ff1f;
    --accent: #9be7ff;
    --good: #67f0b5;
    --bad: #ff7f7f;
  }
  * { box-sizing: border-box; }
  html, body { width: 100%; min-height: 100%; margin: 0; }
  body {
    font-family: "Space Grotesk", system-ui, sans-serif;
    color: var(--text);
    background:
      radial-gradient(1400px 700px at 15% -10%, var(--bg-spot-a), transparent 60%),
      radial-gradient(900px 500px at 85% 10%, var(--bg-spot-b), transparent 65%),
      linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
    display: grid;
    place-items: center;
    min-height: 100vh;
    padding: 24px 0;
  }
  .card {
    width: min(440px, calc(100% - 32px));
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--panel);
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 40px #00000055;
    padding: 28px 24px;
    display: grid;
    gap: 16px;
    animation: rise 500ms ease-out both;
  }
  @keyframes rise {
    from { opacity: 0; transform: translateY(14px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .title {
    font-family: "JetBrains Mono", monospace;
    font-size: 14px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
    text-align: center;
  }
  .subtitle {
    font-size: 13px;
    color: var(--muted);
    text-align: center;
    margin-top: -8px;
  }
  .field {
    display: grid;
    gap: 5px;
  }
  .label {
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .optional {
    font-size: 10px;
    color: #ffffff44;
    text-transform: none;
    letter-spacing: 0;
  }
  .input, .select {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    border: 1px solid #ffffff2e;
    border-radius: 10px;
    background: #ffffff09;
    color: #eef4ff;
    font-family: "JetBrains Mono", monospace;
    font-size: 13px;
  }
  .select {
    appearance: none;
    cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23a8b4c5' stroke-width='1.5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }
  .input:focus-visible, .select:focus-visible {
    outline: 1px solid #7dc5ff88;
    outline-offset: 1px;
  }
  .input::placeholder { color: #ffffff33; }
  .divider {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
  .info {
    font-size: 11px;
    color: var(--muted);
    line-height: 1.4;
    padding: 4px 0 0;
  }
  .section-title {
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    color: var(--accent);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .btn {
    height: 44px;
    border-radius: 999px;
    border: 1px solid #3cb87980;
    background: linear-gradient(180deg, #1f6f47d4 0%, #18563ace 100%);
    color: #c8f8de;
    font-family: "JetBrains Mono", monospace;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: transform 0.16s ease, filter 0.16s ease, opacity 0.16s ease;
    margin-top: 4px;
  }
  .btn:hover { transform: translateY(-1px); filter: brightness(1.06); }
  .btn:disabled { opacity: 0.7; cursor: wait; transform: none; filter: none; }
  .error {
    min-height: 1.2em;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    color: var(--bad);
    text-align: center;
  }
</style>
</head>
<body>
<div class="card">
  <div class="title">ClaudeClaw Setup</div>
  <div class="subtitle">Configure your daemon to get started</div>

  <div class="field">
    <div class="label">Model</div>
    <select class="select" id="model" autofocus>
      <option value="sonnet" selected>sonnet</option>
      <option value="opus">opus</option>
    </select>
  </div>

  <div class="field">
    <div class="label">Fallback model <span class="optional">(optional)</span></div>
    <select class="select" id="fallbackModel">
      <option value="" selected>none</option>
      <option value="sonnet">sonnet</option>
      <option value="opus">opus</option>
    </select>
  </div>

  <div class="divider"></div>

  <div class="field">
    <div class="label">Telegram bot token <span class="optional">(optional)</span></div>
    <input class="input" id="telegramToken" type="text" placeholder="123456:ABC-DEF...">
  </div>

  <div class="field">
    <div class="label">Telegram allowed user IDs <span class="optional">(optional, comma-separated)</span></div>
    <input class="input" id="telegramUsers" type="text" placeholder="123456789, 987654321">
  </div>

  <div class="divider"></div>

  <div class="field">
    <div class="label">Timezone</div>
    <select class="select" id="timezone">
      <optgroup label="Europe">
        <option value="Europe/London">Europe/London</option>
        <option value="Europe/Dublin">Europe/Dublin</option>
        <option value="Europe/Paris">Europe/Paris</option>
        <option value="Europe/Berlin">Europe/Berlin</option>
        <option value="Europe/Amsterdam">Europe/Amsterdam</option>
        <option value="Europe/Brussels">Europe/Brussels</option>
        <option value="Europe/Zurich">Europe/Zurich</option>
        <option value="Europe/Vienna">Europe/Vienna</option>
        <option value="Europe/Rome">Europe/Rome</option>
        <option value="Europe/Madrid">Europe/Madrid</option>
        <option value="Europe/Lisbon">Europe/Lisbon</option>
        <option value="Europe/Warsaw">Europe/Warsaw</option>
        <option value="Europe/Prague">Europe/Prague</option>
        <option value="Europe/Budapest">Europe/Budapest</option>
        <option value="Europe/Bucharest">Europe/Bucharest</option>
        <option value="Europe/Helsinki">Europe/Helsinki</option>
        <option value="Europe/Stockholm">Europe/Stockholm</option>
        <option value="Europe/Oslo">Europe/Oslo</option>
        <option value="Europe/Copenhagen">Europe/Copenhagen</option>
        <option value="Europe/Athens">Europe/Athens</option>
        <option value="Europe/Istanbul">Europe/Istanbul</option>
        <option value="Europe/Moscow">Europe/Moscow</option>
        <option value="Europe/Kiev">Europe/Kiev</option>
      </optgroup>
      <optgroup label="America">
        <option value="America/New_York">America/New_York</option>
        <option value="America/Chicago">America/Chicago</option>
        <option value="America/Denver">America/Denver</option>
        <option value="America/Los_Angeles">America/Los_Angeles</option>
        <option value="America/Anchorage">America/Anchorage</option>
        <option value="Pacific/Honolulu">Pacific/Honolulu</option>
        <option value="America/Toronto">America/Toronto</option>
        <option value="America/Vancouver">America/Vancouver</option>
        <option value="America/Mexico_City">America/Mexico_City</option>
        <option value="America/Sao_Paulo">America/Sao_Paulo</option>
        <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
        <option value="America/Bogota">America/Bogota</option>
        <option value="America/Lima">America/Lima</option>
        <option value="America/Santiago">America/Santiago</option>
      </optgroup>
      <optgroup label="Asia">
        <option value="Asia/Dubai">Asia/Dubai</option>
        <option value="Asia/Riyadh">Asia/Riyadh</option>
        <option value="Asia/Tehran">Asia/Tehran</option>
        <option value="Asia/Kolkata">Asia/Kolkata</option>
        <option value="Asia/Dhaka">Asia/Dhaka</option>
        <option value="Asia/Bangkok">Asia/Bangkok</option>
        <option value="Asia/Singapore">Asia/Singapore</option>
        <option value="Asia/Hong_Kong">Asia/Hong_Kong</option>
        <option value="Asia/Shanghai">Asia/Shanghai</option>
        <option value="Asia/Seoul">Asia/Seoul</option>
        <option value="Asia/Tokyo">Asia/Tokyo</option>
        <option value="Asia/Taipei">Asia/Taipei</option>
        <option value="Asia/Jakarta">Asia/Jakarta</option>
        <option value="Asia/Karachi">Asia/Karachi</option>
      </optgroup>
      <optgroup label="Pacific">
        <option value="Pacific/Auckland">Pacific/Auckland</option>
        <option value="Pacific/Fiji">Pacific/Fiji</option>
        <option value="Pacific/Guam">Pacific/Guam</option>
      </optgroup>
      <optgroup label="Africa">
        <option value="Africa/Cairo">Africa/Cairo</option>
        <option value="Africa/Lagos">Africa/Lagos</option>
        <option value="Africa/Johannesburg">Africa/Johannesburg</option>
        <option value="Africa/Nairobi">Africa/Nairobi</option>
        <option value="Africa/Casablanca">Africa/Casablanca</option>
      </optgroup>
      <optgroup label="Other">
        <option value="UTC">UTC</option>
        <option value="Australia/Sydney">Australia/Sydney</option>
        <option value="Australia/Melbourne">Australia/Melbourne</option>
        <option value="Australia/Perth">Australia/Perth</option>
      </optgroup>
    </select>
  </div>

  <div class="field">
    <div class="label">Language</div>
    <select class="select" id="language">
      <option value="Русский" selected>Русский</option>
      <option value="English">English</option>
    </select>
  </div>

  <div class="divider"></div>

  <div class="field">
    <div class="label">Security level</div>
    <select class="select" id="security">
      <option value="locked">locked</option>
      <option value="strict">strict</option>
      <option value="moderate" selected>moderate</option>
      <option value="unrestricted">unrestricted</option>
    </select>
    <div class="info" id="securityInfo">All tools enabled, restricted to project directory</div>
  </div>

  <div class="divider"></div>

  <div class="section-title">mtcute <span class="optional">(optional)</span></div>

  <div class="field">
    <div class="label">API ID</div>
    <input class="input" id="mtcuteApiId" type="number" placeholder="12345678">
  </div>

  <div class="field">
    <div class="label">API Hash</div>
    <input class="input" id="mtcuteApiHash" type="text" placeholder="0123456789abcdef...">
  </div>

  <div class="field">
    <div class="label">Phone number</div>
    <input class="input" id="mtcutePhone" type="text" placeholder="+7...">
  </div>

  <button class="btn" id="save">Save &amp; Start</button>
  <div class="error" id="err"></div>
</div>
<script>
(function(){
  var btn = document.getElementById("save");
  var err = document.getElementById("err");
  var securitySelect = document.getElementById("security");
  var securityInfo = document.getElementById("securityInfo");
  var timezoneSelect = document.getElementById("timezone");

  var securityDescriptions = {
    locked: "Read-only. Only file reading (Read, Grep, Glob)",
    strict: "No shell or internet. No Bash, WebSearch, WebFetch",
    moderate: "All tools enabled, restricted to project directory",
    unrestricted: "Full access without restrictions"
  };

  securitySelect.addEventListener("change", function() {
    securityInfo.textContent = securityDescriptions[securitySelect.value] || "";
  });

  // Auto-detect browser timezone
  try {
    var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      var opts = timezoneSelect.options;
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].value === tz) {
          timezoneSelect.value = tz;
          break;
        }
      }
    }
  } catch(e) {}

  function val(id) { return document.getElementById(id).value.trim(); }

  function submit() {
    var model = val("model");
    if (!model) { err.textContent = "model is required"; return; }

    btn.disabled = true;
    err.textContent = "";

    var body = { model: model, security: { level: val("security") }, timezone: val("timezone"), language: val("language") };

    // Fallback model
    var fb = val("fallbackModel");
    if (fb) {
      body.fallback = { model: fb };
    }

    // Telegram
    var tgToken = val("telegramToken");
    var tgUsersRaw = val("telegramUsers");
    if (tgToken || tgUsersRaw) {
      var userIds = tgUsersRaw
        .split(",")
        .map(function(s) { return s.trim(); })
        .filter(function(s) { return s !== ""; })
        .map(Number)
        .filter(function(n) { return Number.isFinite(n) && n > 0; });
      body.telegram = { token: tgToken, allowedUserIds: userIds };
    }

    // mtcute
    var apiId = val("mtcuteApiId");
    var apiHash = val("mtcuteApiHash");
    if (apiId && apiHash) {
      body.mtcute = {
        apiId: Number(apiId),
        apiHash: apiHash,
        phoneNumber: val("mtcutePhone"),
        enabled: true
      };
    }

    fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.ok) {
        window.location.href = "/";
      } else {
        err.textContent = data.error || "unknown error";
        btn.disabled = false;
      }
    })
    .catch(function(e) {
      err.textContent = "network error";
      btn.disabled = false;
    });
  }

  btn.addEventListener("click", submit);
})();
</script>
</body>
</html>`;
}
