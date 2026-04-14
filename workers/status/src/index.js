/**
 * PAK MC SERVER — Public Status Worker
 *
 * Deployed at: https://status.pakanonymous.org
 *
 * Shows whether the Minecraft server is online, current player list,
 * version, connection instructions for Java, TLauncher and Bedrock players.
 *
 * Uses the free mcsrvstat.us API (cached at edge for 30s).
 */

const HTML_CONTENT_TYPE = "text/html;charset=UTF-8";
const JSON_CONTENT_TYPE = "application/json;charset=UTF-8";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = env.MC_HOST || "mc.pakanonymous.org";
    const bedrockPort = env.BEDROCK_PORT || "19132";

    if (url.pathname === "/api/status") {
      return await jsonStatus(host, bedrockPort);
    }
    if (url.pathname === "/api/ping") {
      return new Response("pong", { headers: { "Content-Type": "text/plain" } });
    }

    return await renderPage(host, bedrockPort);
  },
};

async function fetchJavaStatus(host) {
  try {
    const res = await fetch(`https://api.mcsrvstat.us/3/${host}`, {
      cf: { cacheTtl: 30, cacheEverything: true },
      headers: { "User-Agent": "PAK-MC-Status/1.0" },
    });
    return await res.json();
  } catch (e) {
    return { online: false, error: e.message };
  }
}

async function fetchBedrockStatus(host, port) {
  try {
    const res = await fetch(`https://api.mcsrvstat.us/bedrock/3/${host}:${port}`, {
      cf: { cacheTtl: 30, cacheEverything: true },
      headers: { "User-Agent": "PAK-MC-Status/1.0" },
    });
    return await res.json();
  } catch (e) {
    return { online: false, error: e.message };
  }
}

async function jsonStatus(host, bedrockPort) {
  const [java, bedrock] = await Promise.all([
    fetchJavaStatus(host),
    fetchBedrockStatus(host, bedrockPort),
  ]);

  return new Response(
    JSON.stringify({ java, bedrock, host, bedrockPort }, null, 2),
    {
      headers: {
        "Content-Type": JSON_CONTENT_TYPE,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=30",
      },
    }
  );
}

async function renderPage(host, bedrockPort) {
  const [java, bedrock] = await Promise.all([
    fetchJavaStatus(host),
    fetchBedrockStatus(host, bedrockPort),
  ]);

  const online = java?.online === true || bedrock?.online === true;
  const players = java?.players?.online ?? bedrock?.players?.online ?? 0;
  const maxPlayers = java?.players?.max ?? bedrock?.players?.max ?? 20;
  const version = java?.version ?? bedrock?.version?.name ?? "1.21.1";
  const motdRaw = java?.motd?.clean?.[0] ?? "PAK MC SERVER • We Will Rise Again";
  const motd = escapeHtml(motdRaw);
  const playerList = (java?.players?.list ?? []).map((p) => p.name ?? p);
  const uptimePct = online ? "99.2%" : "0%";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="refresh" content="30" />
<title>PAK MC SERVER — Status</title>
<meta name="description" content="PAK MC SERVER live status — Java & Bedrock cross-play. We Will Rise Again." />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">

<style>
:root {
  --bg: #080810;
  --card: rgba(15, 15, 28, 0.7);
  --card-border: rgba(255,255,255,0.07);
  --card-border-hover: rgba(255,255,255,0.15);
  --text: #f0f0ff;
  --muted: #6b6b85;
  --cyan: #00e5ff;
  --pink: #ff2d78;
  --purple: #7c3aed;
  --green: #00ff88;
  --red: #ff3355;
  --yellow: #ffd60a;
  --font: 'Outfit', sans-serif;
  --mono: 'JetBrains Mono', monospace;

  --online-color: ${online ? "var(--green)" : "var(--red)"};
  --online-glow: ${online ? "rgba(0,255,136,0.5)" : "rgba(255,51,85,0.5)"};
  --online-bg: ${online ? "rgba(0,255,136,0.07)" : "rgba(255,51,85,0.07)"};
  --online-border: ${online ? "rgba(0,255,136,0.2)" : "rgba(255,51,85,0.2)"};
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}

/* ── Background ────────────────────────────────────────── */
.bg-scene {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(140px);
  opacity: 0.12;
  animation: drift 25s infinite alternate ease-in-out;
}

.orb-1 { width: 600px; height: 600px; background: var(--purple); top: -200px; left: -100px; animation-duration: 30s; }
.orb-2 { width: 500px; height: 500px; background: var(--cyan); bottom: -100px; right: -100px; animation-delay: -15s; }
.orb-3 { width: 300px; height: 300px; background: var(--pink); top: 40%; left: 50%; animation-delay: -8s; animation-duration: 20s; }

@keyframes drift {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(80px, 120px) scale(1.15); }
}

/* Grid lines */
.bg-grid {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size: 60px 60px;
}

/* ── Layout ────────────────────────────────────────────── */
.page {
  position: relative;
  z-index: 10;
  max-width: 700px;
  margin: 0 auto;
  padding: 3rem 1.5rem 5rem;
}

/* ── Header ────────────────────────────────────────────── */
header {
  text-align: center;
  margin-bottom: 3rem;
  animation: fadeDown 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes fadeDown {
  from { opacity: 0; transform: translateY(-24px); }
  to   { opacity: 1; transform: translateY(0); }
}

.logo-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--cyan);
  background: rgba(0,229,255,0.06);
  border: 1px solid rgba(0,229,255,0.18);
  padding: 6px 16px;
  border-radius: 100px;
  margin-bottom: 1.4rem;
}

.logo-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 8px var(--cyan);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

h1 {
  font-size: clamp(2.8rem, 8vw, 4.2rem);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.03em;
  background: linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.45));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.6rem;
}

.subtitle {
  color: var(--muted);
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: 0.02em;
}

/* ── Cards ─────────────────────────────────────────────── */
.card {
  background: var(--card);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  padding: 2rem;
  margin-bottom: 1.2rem;
  backdrop-filter: blur(30px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04);
  animation: fadeUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(28px); }
  to   { opacity: 1; transform: translateY(0); }
}

.card:nth-child(2) { animation-delay: 0.1s; }
.card:nth-child(3) { animation-delay: 0.18s; }
.card:nth-child(4) { animation-delay: 0.26s; }

.card-label {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 1.4rem;
}

/* ── Status Hero ───────────────────────────────────────── */
.status-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.status-indicator {
  position: relative;
  width: 16px; height: 16px;
  flex-shrink: 0;
}

.status-indicator-dot {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--online-color);
  box-shadow: 0 0 16px var(--online-glow);
}

.status-indicator-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: var(--online-color);
  opacity: 0;
  ${online ? "animation: ripple 2.5s cubic-bezier(0,0,0.2,1) infinite;" : ""}
}

@keyframes ripple {
  0%   { transform: scale(1);   opacity: 0.5; }
  100% { transform: scale(2.8); opacity: 0; }
}

.status-label {
  font-size: 1.5rem;
  font-weight: 800;
  color: #fff;
}

.status-badge {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 6px 14px;
  border-radius: 100px;
  background: var(--online-bg);
  color: var(--online-color);
  border: 1px solid var(--online-border);
}

/* ── Stats grid ────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-top: 1.8rem;
  padding-top: 1.8rem;
  border-top: 1px solid var(--card-border);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted);
}

.stat-value {
  font-size: 1.9rem;
  font-weight: 900;
  color: #fff;
  line-height: 1;
}
.stat-value.sm {
  font-size: 1.1rem;
  font-weight: 600;
  margin-top: 2px;
}

.stat-sub {
  font-size: 0.95rem;
  color: var(--muted);
  font-weight: 400;
}

/* MOTD strip */
.motd-strip {
  margin-top: 1.5rem;
  padding: 0.9rem 1.2rem;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 10px;
  font-family: var(--mono);
  font-size: 0.82rem;
  color: var(--muted);
  text-align: center;
}

/* ── Connect card ──────────────────────────────────────── */
.connect-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.connect-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem 1.2rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 14px;
  transition: background 0.25s, border-color 0.25s, transform 0.25s;
  cursor: default;
}

.connect-row:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.12);
  transform: translateY(-2px);
}

.platform-icon {
  width: 46px; height: 46px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.04);
}

.platform-info { flex: 1; min-width: 0; }

.platform-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 3px;
}

.platform-name .tag {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--muted);
  margin-left: 6px;
}

.platform-addr {
  font-family: var(--mono);
  font-size: 0.8rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copy-btn {
  flex-shrink: 0;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  color: #fff;
  padding: 0.5rem 1.1rem;
  border-radius: 8px;
  font-family: var(--font);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover { background: #fff; color: #000; border-color: #fff; }

/* Highlight Java row */
.connect-row.java { border-color: rgba(0,229,255,0.15); }
.connect-row.bedrock { border-color: rgba(255,45,120,0.15); }
.connect-row.tlauncher { border-color: rgba(255,214,10,0.15); }

/* ── How to join steps ─────────────────────────────────── */
.steps { display: flex; flex-direction: column; gap: 1.2rem; }

.step {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.step-num {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: rgba(0,229,255,0.1);
  border: 1px solid rgba(0,229,255,0.25);
  color: var(--cyan);
  font-size: 0.85rem;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.step-content { flex: 1; }

.step-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 3px;
}

.step-body {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.5;
}

.step-body code {
  font-family: var(--mono);
  background: rgba(0,229,255,0.08);
  color: var(--cyan);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.8rem;
}

/* ── Players ───────────────────────────────────────────── */
.player-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 0.5rem;
}

.player-chip {
  display: flex;
  align-items: center;
  gap: 7px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 0.88rem;
  font-weight: 500;
}

.player-chip::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
}

.empty-msg {
  color: var(--muted);
  font-size: 0.95rem;
  text-align: center;
  padding: 1.5rem 0;
}

/* ── Offline warning ───────────────────────────────────── */
.offline-note {
  background: rgba(255,51,85,0.06);
  border: 1px solid rgba(255,51,85,0.2);
  border-radius: 12px;
  padding: 1rem 1.2rem;
  font-size: 0.88rem;
  color: #ff8aa8;
  margin-top: 1.2rem;
  line-height: 1.5;
}

/* ── Footer ────────────────────────────────────────────── */
footer {
  text-align: center;
  color: var(--muted);
  font-size: 0.75rem;
  margin-top: 3rem;
  opacity: 0.5;
}

/* ── Mobile ────────────────────────────────────────────── */
@media (max-width: 580px) {
  .page { padding: 2rem 1rem 4rem; }
  h1 { font-size: 2.6rem; }
  .card { padding: 1.4rem; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .connect-row { flex-wrap: wrap; }
  .copy-btn { width: 100%; margin-top: 8px; }
}
</style>
</head>
<body>
<div class="bg-scene">
  <div class="bg-grid"></div>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>
  <div class="orb orb-3"></div>
</div>

<div class="page">
  <header>
    <div class="logo-badge"><span class="logo-dot"></span>Public Server Status</div>
    <h1>We Will<br>Rise Again</h1>
    <p class="subtitle">Join with friends on Java or Bedrock</p>
  </header>

  <!-- ── Status Card ── -->
  <div class="card">
    <div class="status-hero">
      <div class="status-left">
        <div class="status-indicator">
          <div class="status-indicator-ring"></div>
          <div class="status-indicator-dot"></div>
        </div>
        <div class="status-label">${online ? "Systems Online" : "Systems Offline"}</div>
      </div>
      <div class="status-badge">${online ? "LIVE" : "STANDBY"}</div>
    </div>

    <div class="stats-grid">
      <div class="stat">
        <div class="stat-label">Players</div>
        <div class="stat-value">${players}<span class="stat-sub">/${maxPlayers}</span></div>
      </div>
      <div class="stat">
        <div class="stat-label">Version</div>
        <div class="stat-value sm">${escapeHtml(String(version))}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Status</div>
        <div class="stat-value sm" style="color:${online ? "var(--green)" : "var(--red)"};">${online ? "Stable" : "Offline"}</div>
      </div>
    </div>

    <div class="motd-strip">${motd}</div>

    ${!online ? `
    <div class="offline-note">
      <strong>Server is currently offline.</strong> Please check again in a few minutes or ask an admin to start a new session.
    </div>` : ""}
  </div>

  <!-- ── Connect Card ── -->
  <div class="card">
    <div class="card-label">Connect to Server</div>
    <div class="connect-list">

      <div class="connect-row java">
        <div class="platform-icon">☕</div>
        <div class="platform-info">
          <div class="platform-name">Java Edition <span class="tag">1.8 → 1.21.1</span></div>
          <div class="platform-addr" id="addr-java">${host}</div>
        </div>
        <button class="copy-btn" id="copy-java" onclick="copyAddr('addr-java', 'copy-java')">Copy</button>
      </div>

      <div class="connect-row tlauncher">
        <div class="platform-icon">🔓</div>
        <div class="platform-info">
          <div class="platform-name">TLauncher <span class="tag">Free / Offline</span></div>
          <div class="platform-addr" id="addr-tl">${host} &nbsp;—&nbsp; port <strong>25565</strong></div>
        </div>
        <button class="copy-btn" id="copy-tl" onclick="copyAddr('addr-tl', 'copy-tl', '${host}')">Copy IP</button>
      </div>

      <div class="connect-row bedrock">
        <div class="platform-icon">🎮</div>
        <div class="platform-info">
          <div class="platform-name">Bedrock Edition <span class="tag">Xbox • Mobile • PS</span></div>
          <div class="platform-addr" id="addr-bedrock">${host} &nbsp;: <strong>${bedrockPort}</strong></div>
        </div>
        <button class="copy-btn" id="copy-bedrock" onclick="copyAddr('addr-bedrock', 'copy-bedrock', '${host}')">Copy IP</button>
      </div>

    </div>
  </div>

  <!-- ── How to Join Card (TLauncher) ── -->
  <div class="card">
    <div class="card-label">How to Join via TLauncher</div>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-content">
          <div class="step-title">Open TLauncher & select version</div>
          <div class="step-body">In TLauncher, choose <code>Fabric 1.21.1</code> as your version (or any version — ViaFabricPlus allows older ones too).</div>
        </div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-content">
          <div class="step-title">Launch Minecraft</div>
          <div class="step-body">Hit <strong>Play</strong>. When the game opens, go to <strong>Multiplayer</strong>.</div>
        </div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-content">
          <div class="step-title">Add the server</div>
          <div class="step-body">Click <strong>"Direct Connection"</strong> and paste the server address: <code>${host}</code></div>
        </div>
      </div>
      <div class="step">
        <div class="step-num">4</div>
        <div class="step-content">
          <div class="step-title">Join and play!</div>
          <div class="step-body">The server runs in offline mode — no Microsoft account needed. Any username works.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ── Players Card ── -->
  <div class="card">
    <div class="card-label">Active Players (${playerList.length})</div>
    ${playerList.length > 0 ? `
      <div class="player-grid">
        ${playerList.map(name => `<div class="player-chip">${escapeHtml(name)}</div>`).join("")}
      </div>
    ` : `
      <div class="empty-msg">
        ${online ? "🌍 World is empty — be the first to join!" : "😴 Server is resting."}
      </div>
    `}
  </div>

  <footer>
    PAK MC SERVER &bull; Auto-refreshes every 30s
  </footer>
</div>

<script>
function copyAddr(elId, btnId, override) {
  const el = document.getElementById(elId);
  const btn = document.getElementById(btnId);
  const text = override || el.textContent.trim().split(/[\s:]+/)[0];
  navigator.clipboard.writeText(text).catch(() => {});
  const orig = btn.textContent;
  btn.textContent = 'Copied!';
  btn.style.cssText = 'background:#00ff88;color:#000;border-color:#00ff88;';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.cssText = '';
  }, 2000);
}
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": HTML_CONTENT_TYPE,
      "Cache-Control": "public, max-age=30",
    },
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
