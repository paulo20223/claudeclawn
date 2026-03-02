export function loginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClaudeClaw — Login</title>
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
  }
  .card {
    width: min(380px, calc(100% - 32px));
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--panel);
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 40px #00000055;
    padding: 28px 24px;
    display: grid;
    gap: 18px;
    text-align: center;
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
  }
  .field {
    display: grid;
    gap: 10px;
  }
  .input {
    width: 100%;
    height: 44px;
    padding: 0 14px;
    border: 1px solid #ffffff2e;
    border-radius: 12px;
    background: #ffffff09;
    color: #eef4ff;
    font-family: "JetBrains Mono", monospace;
    font-size: 14px;
    text-align: center;
    letter-spacing: 0.08em;
  }
  .input:focus-visible {
    outline: 1px solid #7dc5ff88;
    outline-offset: 1px;
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
  }
  .btn:hover { transform: translateY(-1px); filter: brightness(1.06); }
  .btn:disabled { opacity: 0.7; cursor: wait; transform: none; filter: none; }
  .error {
    min-height: 1.2em;
    font-family: "JetBrains Mono", monospace;
    font-size: 11px;
    color: var(--bad);
  }
</style>
</head>
<body>
<div class="card">
  <div class="title">ClaudeClaw</div>
  <div class="field">
    <input class="input" id="tok" type="password" placeholder="token" autocomplete="off" autofocus>
    <button class="btn" id="go">Login</button>
  </div>
  <div class="error" id="err"></div>
</div>
<script>
(function(){
  var tok = document.getElementById("tok");
  var btn = document.getElementById("go");
  var err = document.getElementById("err");

  function attempt() {
    var v = tok.value.trim();
    if (!v) { err.textContent = "enter token"; return; }
    btn.disabled = true;
    err.textContent = "";
    fetch("/api/health?token=" + encodeURIComponent(v))
      .then(function(r) {
        if (r.ok) {
          window.location.href = "/?token=" + encodeURIComponent(v);
        } else {
          err.textContent = "invalid token";
          btn.disabled = false;
        }
      })
      .catch(function() {
        err.textContent = "network error";
        btn.disabled = false;
      });
  }

  btn.addEventListener("click", attempt);
  tok.addEventListener("keydown", function(e) {
    if (e.key === "Enter") attempt();
  });
})();
</script>
</body>
</html>`;
}
