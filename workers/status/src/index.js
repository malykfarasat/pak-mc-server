/**
 * PAK MC SERVER — Public Status Worker
 *
 * Deployed at: https://status.pakanonymous.org
 *
 * Shows whether the Minecraft server is online, current player list,
 * version, connection instructions for both Java and Bedrock players.
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

    // ── Routing ───────────────────────────────────────────────────────────
    if (url.pathname === "/api/status") {
      return await jsonStatus(host, bedrockPort);
    }
    if (url.pathname === "/api/ping") {
      return new Response("pong", { headers: { "Content-Type": "text/plain" } });
    }

    // Default: status page
    return await renderPage(host, bedrockPort);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// HTML page
// ─────────────────────────────────────────────────────────────────────────────

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="refresh" content="30" />
<title>PAK MC SERVER — Status</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg-dark: #050505;
  --bg-gradient: radial-gradient(circle at 50% 0%, #1a1528 0%, #050505 70%);
  --card-glass: rgba(20, 20, 30, 0.4);
  --card-border: rgba(255, 255, 255, 0.08);
  --text-main: #f8f8f8;
  --text-muted: #8b8b9e;
  --accent-cyan: #00f0ff;
  --accent-pink: #ff007f;
  --accent-purple: #8a2be2;
  --success: #00ff88;
  --danger: #ff3366;
  --font-body: 'Outfit', sans-serif;
  --font-code: 'JetBrains Mono', monospace;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg-dark);
  background-image: var(--bg-gradient);
  color: var(--text-main);
  font-family: var(--font-body);
  min-height: 100vh;
  padding: 3rem 1.5rem;
  line-height: 1.6;
  overflow-x: hidden;
  position: relative;
}

/* Ambient animated background orbs */
body::before, body::after {
  content: '';
  position: absolute;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  filter: blur(120px);
  z-index: -1;
  opacity: 0.15;
  animation: float 20s infinite alternate cubic-bezier(0.5, 0, 0.5, 1);
}
body::before {
  top: -100px; left: -100px;
  background: var(--accent-purple);
}
body::after {
  bottom: -200px; right: -100px;
  background: var(--accent-cyan);
  animation-delay: -10s;
}

@keyframes float {
  0% { transform: translate(0, 0) scale(1); }
  100% { transform: translate(100px, 150px) scale(1.2); }
}

.container {
  max-width: 640px;
  margin: 0 auto;
  position: relative;
  z-index: 10;
}

header {
  text-align: center;
  margin-bottom: 3rem;
  animation: slideDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(-20px);
}

@keyframes slideDown {
  to { opacity: 1; transform: translateY(0); }
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent-cyan);
  background: rgba(0, 240, 255, 0.05);
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid rgba(0, 240, 255, 0.2);
  margin-bottom: 1.5rem;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.1);
  backdrop-filter: blur(10px);
}

h1 {
  font-size: 3.5rem;
  font-weight: 900;
  line-height: 1.1;
  margin-bottom: 0.5rem;
  background: linear-gradient(to right, #fff, var(--text-muted));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
  font-weight: 300;
}

.glass-card {
  background: var(--card-glass);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--card-border);
  border-radius: 24px;
  padding: 2.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 30px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
  animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(30px);
}

@keyframes fadeUp {
  to { opacity: 1; transform: translateY(0); }
}

.glass-card:nth-child(2) { animation-delay: 0.1s; }
.glass-card:nth-child(3) { animation-delay: 0.2s; }

.status-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--card-border);
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${online ? "var(--success)" : "var(--danger)"};
  box-shadow: 0 0 20px ${online ? "rgba(0,255,136,0.6)" : "rgba(255,51,102,0.6)"};
  position: relative;
}

.status-dot::before {
  content: '';
  position: absolute;
  top: -4px; left: -4px; right: -4px; bottom: -4px;
  border-radius: 50%;
  background: inherit;
  opacity: 0.4;
  ${online ? "animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;" : ""}
}

@keyframes ping {
  75%, 100% { transform: scale(2.5); opacity: 0; }
}

.status-text {
  font-size: 1.4rem;
  font-weight: 700;
  color: #fff;
}

.live-badge {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  padding: 6px 12px;
  border-radius: 8px;
  background: ${online ? "rgba(0, 255, 136, 0.1)" : "rgba(255, 51, 102, 0.1)"};
  color: ${online ? "var(--success)" : "var(--danger)"};
  border: 1px solid ${online ? "rgba(0, 255, 136, 0.2)" : "rgba(255, 51, 102, 0.2)"};
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.metric-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.metric-value {
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}

.metric-value.small {
  font-size: 1.1rem;
  font-weight: 500;
  margin-top: 0.4rem;
}

.metric-sub {
  font-size: 1rem;
  color: var(--text-muted);
  font-weight: 400;
}

.motd-box {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 1rem 1.5rem;
  font-family: var(--font-code);
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-bottom: 2.5rem;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.connection-guide h3 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-muted);
  margin-bottom: 1.5rem;
  font-weight: 800;
}

.connect-methods {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.connect-row {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.05);
  padding: 1.2rem;
  border-radius: 16px;
  transition: all 0.3s ease;
}

.connect-row:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.1);
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0,0,0,0.2);
}

.platform-icon {
  width: 48px; height: 48px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem;
  background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.05);
}

.java-icon { color: var(--accent-cyan); }
.bedrock-icon { color: var(--accent-pink); }

.platform-info { flex: 1; }
.platform-name {
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 0.3rem;
  color: #fff;
}
.platform-name span {
  font-weight: 400;
  color: var(--text-muted);
  font-size: 0.8rem;
  margin-left: 8px;
}
.platform-address {
  font-family: var(--font-code);
  font-size: 0.9rem;
  color: var(--text-muted);
}

.copy-button {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  padding: 0.6rem 1.2rem;
  border-radius: 8px;
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-button:hover {
  background: white;
  color: black;
}

.players-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 1.5rem;
}

.player-tag {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}
.player-tag::before {
  content: '';
  width: 6px; height: 6px;
  background: var(--success);
  border-radius: 50%;
}

.empty-state {
  text-align: center;
  padding: 2rem 0;
  color: var(--text-muted);
  font-size: 1.1rem;
}

.help-text {
  background: rgba(255, 51, 102, 0.05);
  border-left: 4px solid var(--danger);
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
  font-size: 0.9rem;
  color: var(--text-muted);
}

footer {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8rem;
  margin-top: 4rem;
  opacity: 0.6;
}

@media (max-width: 600px) {
  h1 { font-size: 2.5rem; }
  .glass-card { padding: 1.5rem; }
  .metrics-grid { grid-template-columns: 1fr; gap: 1rem; text-align: center; }
  .connect-row { flex-direction: column; text-align: center; }
  .platform-name span { display: block; margin: 4px 0 0; }
  .copy-button { width: 100%; margin-top: 10px; }
}
</style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge">Pak Server Engine</div>
      <h1>We Will<br>Rise Again</h1>
      <p class="subtitle">Unified Java & Bedrock Experience</p>
    </header>

    <div class="glass-card">
      <div class="status-hero">
        <div class="status-indicator">
          <div class="status-dot"></div>
          <div class="status-text">${online ? "Systems Online" : "Systems Offline"}</div>
        </div>
        <div class="live-badge">${online ? "LIVE" : "STANDBY"}</div>
      </div>

      <div class="metrics-grid">
        <div class="metric-item">
          <div class="metric-label">Players</div>
          <div class="metric-value">${players}<span class="metric-sub">/${maxPlayers}</span></div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Game Version</div>
          <div class="metric-value small">${escapeHtml(String(version))}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Latency</div>
          <div class="metric-value small" style="color:var(--accent-cyan);">${online ? (java?.debug?.ping ? "< 45ms" : "Stable") : "—"}</div>
        </div>
      </div>

      <div class="motd-box">${motd}</div>

      ${!online ? `
      <div class="help-text">
        <strong>Server unreachable?</strong> If the server workflow is running but the status is offline, ensure that your 'PLAYIT_SECRET_KEY' is added to GitHub secrets so the tunnel maps correctly to mc.pakanonymous.org.
      </div>
      ` : ""}

      <div class="connection-guide">
        <h3>Connect to Network</h3>
        <div class="connect-methods">
          <div class="connect-row">
            <div class="platform-icon java-icon">☕</div>
            <div class="platform-info">
              <div class="platform-name">Java Edition <span>(PC/Mac/Linux)</span></div>
              <div class="platform-address" id="addr-java">${host}</div>
            </div>
            <button class="copy-button" onclick="copyText('${host}', this)">Copy</button>
          </div>
          <div class="connect-row">
            <div class="platform-icon bedrock-icon">🎮</div>
            <div class="platform-info">
              <div class="platform-name">Bedrock Edition <span>(Xbox, PS, Mobile)</span></div>
              <div class="platform-address" id="addr-bedrock">${host} <b>:</b> ${bedrockPort}</div>
            </div>
            <button class="copy-button" onclick="copyText('${host}', this)">Copy IP</button>
          </div>
        </div>
      </div>
    </div>

    <div class="glass-card">
      <div class="connection-guide" style="margin:0;">
        <h3>Active Players <span>(${playerList.length})</span></h3>
        ${playerList.length > 0 ? `
          <div class="players-grid">
            ${playerList.map(name => `<div class="player-tag">${escapeHtml(name)}</div>`).join("")}
          </div>
        ` : `
          <div class="empty-state">
            ${online ? "World is empty. Be the first to deploy!" : "Server asleep. Wake up via Admin Panel."}
          </div>
        `}
      </div>
    </div>

    <footer>
      Powered by Cloudflare Workers Edge Network &bull; Auto-Refresh Enabled
    </footer>
  </div>

<script>
function copyText(text, btn) {
  navigator.clipboard.writeText(text);
  const original = btn.innerText;
  btn.innerText = 'Copied!';
  btn.style.background = 'var(--success)';
  btn.style.color = '#000';
  btn.style.borderColor = 'var(--success)';
  setTimeout(() => {
    btn.innerText = original;
    btn.style.background = '';
    btn.style.color = '';
    btn.style.borderColor = '';
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
