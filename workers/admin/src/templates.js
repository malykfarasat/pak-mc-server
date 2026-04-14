/**
 * HTML templates for PAK MC SERVER admin panel.
 */

import { listRuns } from "./github.js";

const HTML_HEADERS = {
  "Content-Type": "text/html;charset=UTF-8",
  "Cache-Control": "no-store",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main dashboard
// ─────────────────────────────────────────────────────────────────────────────
export async function renderDashboard(session, env) {
  let runs = [];
  try {
    runs = await listRuns(env, { limit: 8 });
  } catch (e) {
    runs = [];
  }

  const currentlyRunning = runs.find((r) => r.status === "in_progress" || r.status === "queued");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PAK MC SERVER — Admin Command Center</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
${baseStyles()}
</style>
</head>
<body>
  <!-- Animated Background Elements -->
  <div class="bg-orb orb-1"></div>
  <div class="bg-orb orb-2"></div>

  <nav class="topbar">
    <div class="brand">
      <div class="brand-badge">★</div>
      <div>
        <div class="brand-title">PAK MC DASHBOARD</div>
        <div class="brand-sub">Admin Access</div>
      </div>
    </div>
    <div class="user">
      <div class="user-meta">
        <div class="user-name">${escapeHtml(session.name)}</div>
        <div class="user-email">${escapeHtml(session.email)}</div>
      </div>
      ${session.picture ? `<img src="${session.picture}" alt="${escapeHtml(session.name)}" />` : ""}
      <a href="/logout" class="logout-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
      </a>
    </div>
  </nav>

  <main class="container">
    <!-- ── Diagnostic Alert ──────────────────────────────────────────── -->
    <div id="diagnostic-banner" class="diagnostic-banner hidden" style="background: rgba(255, 51, 102, 0.1); border: 1px solid var(--danger); padding: 1.5rem; border-radius: 16px; margin-bottom: 2rem;">
      <h3 style="color: var(--danger); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 8px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        Playit Tunnel Not Configured
      </h3>
      <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.5;">
        You MUST add your <code>PLAYIT_SECRET_KEY</code> as a Repository Secret in your GitHub project settings. Without it, the server runs in guest mode and players cannot connect to <strong>mc.pakanonymous.org</strong>.
      </p>
    </div>

    <div class="dashboard-grid">
      <!-- ── Left Column: Controls & Connect ───────────────────────────── -->
      <div class="col-main">
        <!-- ── Live Status Card ──────────────────────────────────────── -->
        <section class="glass-card status-card">
          <div class="section-badge">NETWORK STATUS</div>
          <div class="status-row">
            <div class="status-indicator">
              <span class="dot" id="statusDot"></span>
              <span class="status-text" id="statusText">Checking...</span>
            </div>
            <div class="player-count">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span id="playerCount">—</span>
            </div>
          </div>
          <div class="motd" id="motd">—</div>
        </section>

        <!-- ── Controls Card ─────────────────────────────────────────── -->
        <section class="glass-card controls-card">
          <div class="section-badge">SERVER ENGINE CONTROLS</div>
          
          <div class="form-grid">
            <div class="input-group">
              <label>Memory Allocation (RAM)</label>
              <select id="memorySelect" class="cyber-input">
                <option value="3G">3 GB - Lightweight</option>
                <option value="4G">4 GB - Standard</option>
                <option value="5G" selected>5 GB - Performance</option>
                <option value="6G">6 GB - Maximum</option>
              </select>
            </div>
            <div class="input-group">
              <label>Session Duration (Minutes)</label>
              <input type="number" id="durationInput" class="cyber-input" value="340" min="10" max="350" />
            </div>
          </div>

          <div class="button-grid">
            <button id="startBtn" class="btn btn-glow-success">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Initialize Server
            </button>
            <button id="stopBtn" class="btn btn-glow-danger">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
              Halt Server
            </button>
          </div>
          <button id="refreshBtn" class="btn btn-ghost" style="width: 100%; margin-top: 10px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            Sync Dashboard state
          </button>

          <div id="toast" class="toast"></div>
        </section>

        <!-- ── Connect Info Card ─────────────────────────────────────── -->
        <section class="glass-card connect-card">
          <div class="section-badge">CONNECTION ENDPOINTS</div>
          <div class="endpoint-list">
            <div class="endpoint-item">
              <div class="ep-icon" style="color: var(--accent-cyan); background: rgba(0,240,255,0.1);">☕</div>
              <div class="ep-meta">
                <div class="ep-title">Java / TLauncher</div>
                <div class="ep-addr" id="conn-java">${escapeHtml(env.MC_HOST || "mc.pakanonymous.org")}</div>
              </div>
            </div>
            <div class="endpoint-item">
              <div class="ep-icon" style="color: var(--accent-pink); background: rgba(255,0,127,0.1);">🎮</div>
              <div class="ep-meta">
                <div class="ep-title">Bedrock (Xbox / Mobile / Switch)</div>
                <div class="ep-addr" id="conn-bedrock">${escapeHtml(env.MC_HOST || "mc.pakanonymous.org")} : ${escapeHtml(env.BEDROCK_PORT || "19132")}</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- ── Right Column: Sessions ──────────────────────────────────── -->
      <div class="col-side">
        <section class="glass-card runs-card">
          <div class="section-badge" style="display:flex; justify-content:space-between; align-items:center;">
            <span>SESSION HISTORY</span>
            <a href="https://github.com/${escapeHtml(env.GITHUB_OWNER)}/${escapeHtml(env.GITHUB_REPO)}/actions" target="_blank" class="github-link">
              View Logs <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
          
          <div class="runs-container">
            ${runs.length === 0 ? `
              <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1rem; opacity: 0.5;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                <br>No sessions found.<br>Initialize the server to begin.
              </div>
            ` : `
              <ul class="run-list">
                ${runs.map((r) => renderRunItem(r, env)).join("")}
              </ul>
            `}
          </div>
        </section>
      </div>
    </div>

    <footer>
      PAK MC SERVER COMMAND CENTER &bull;
      <a href="https://status.pakanonymous.org" target="_blank" style="margin-left: 5px;">Public Node Status</a>
    </footer>
  </main>

<script>
${dashboardScript()}
</script>
</body>
</html>`;

  return new Response(html, { headers: HTML_HEADERS });
}

function renderRunItem(run, env) {
  const d = new Date(run.created_at);
  const time = d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusClass =
    run.status === "in_progress" ? "running" :
    run.status === "queued" ? "queued" :
    run.conclusion === "success" ? "success" :
    run.conclusion === "cancelled" ? "cancelled" :
    "failed";

  const statusText =
    run.status === "in_progress" ? "RUNNING" :
    run.status === "queued" ? "QUEUED" :
    (run.conclusion || run.status).toUpperCase();

  return `
    <li class="run-item">
      <div class="run-ring">
        <span class="run-dot ${statusClass}"></span>
      </div>
      <div class="run-meta">
        <div class="run-flex">
          <div class="run-num">#${run.run_number}</div>
          <span class="run-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="run-time">${time} &bull; ${escapeHtml(run.actor || "Automated")}</div>
      </div>
    </li>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared CSS
// ─────────────────────────────────────────────────────────────────────────────
function baseStyles() {
  return `
:root {
  --bg-dark: #050505;
  --bg-gradient: radial-gradient(circle at 60% top, #151025 0%, #050505 50%);
  --card-glass: rgba(18, 18, 26, 0.45);
  --card-border: rgba(255, 255, 255, 0.08);
  --text-main: #ffffff;
  --text-muted: #8b8b9e;
  --accent-cyan: #00f0ff;
  --accent-blue: #0088ff;
  --accent-pink: #ff007f;
  --success: #00f576;
  --danger: #ff2a55;
  --warning: #ffb800;
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
  line-height: 1.6;
  overflow-x: hidden;
  position: relative;
}

a { color: var(--accent-cyan); transition: opacity 0.2s; text-decoration: none; }
a:hover { opacity: 0.8; }

/* Background Animations */
.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(120px);
  z-index: -1;
  opacity: 0.15;
  animation: floatOrb 25s infinite alternate cubic-bezier(0.4, 0, 0.2, 1);
}
.orb-1 { width: 400px; height: 400px; background: var(--accent-blue); top: -100px; left: -100px; }
.orb-2 { width: 500px; height: 500px; background: var(--accent-pink); bottom: -200px; right: -100px; animation-delay: -10s; }

@keyframes floatOrb {
  0% { transform: translateY(0) scale(1); }
  100% { transform: translateY(150px) scale(1.3); }
}

/* Navbar */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2rem 2rem;
  background: rgba(10, 10, 15, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  position: sticky;
  top: 0;
  z-index: 50;
}
.brand { display: flex; align-items: center; gap: 16px; }
.brand-badge {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent-cyan), var(--accent-blue));
  display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem;
  color: white;
  box-shadow: 0 0 20px rgba(0, 240, 255, 0.3);
}
.brand-title { font-weight: 800; font-size: 1.1rem; letter-spacing: 0.05em; line-height: 1.2; }
.brand-sub { font-size: 0.75rem; color: var(--accent-cyan); letter-spacing: 0.15em; text-transform: uppercase; font-weight: 700; }

.user { display: flex; align-items: center; gap: 16px; }
.user-meta { text-align: right; }
.user-name { font-size: 0.9rem; font-weight: 700; }
.user-email { font-size: 0.75rem; color: var(--text-muted); }
.user img { width: 44px; height: 44px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.1); }
.logout-btn {
  background: rgba(255, 51, 102, 0.1);
  color: var(--danger);
  border: 1px solid rgba(255, 51, 102, 0.2);
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
}
.logout-btn:hover { background: var(--danger); color: white; transform: scale(1.05); }

/* Main Container */
.container { max-width: 1100px; margin: 3rem auto; padding: 0 1.5rem; }

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 2rem;
}

@media (max-width: 850px) {
  .dashboard-grid { grid-template-columns: 1fr; }
  .user-meta { display: none; }
}

/* Glass Cards */
.glass-card {
  background: var(--card-glass);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--card-border);
  border-radius: 24px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 30px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05);
  animation: fadeUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  opacity: 0;
  transform: translateY(20px);
}
@keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }

.col-main .glass-card:nth-child(2) { animation-delay: 0.1s; }
.col-main .glass-card:nth-child(3) { animation-delay: 0.2s; }
.col-side .glass-card { animation-delay: 0.3s; height: calc(100% - 2rem); display: flex; flex-direction: column; }

.section-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: var(--accent-cyan);
  background: rgba(0, 240, 255, 0.05);
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid rgba(0, 240, 255, 0.1);
  margin-bottom: 1.5rem;
  text-transform: uppercase;
}

/* Status Component */
.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}
.status-indicator { display: flex; align-items: center; gap: 12px; }
.dot {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--text-muted);
}
.dot.online {
  background: var(--success);
  box-shadow: 0 0 20px rgba(0, 245, 118, 0.6);
  animation: pulseNode 2s infinite;
}
.dot.offline {
  background: var(--danger);
  box-shadow: 0 0 20px rgba(255, 42, 85, 0.6);
}
@keyframes pulseNode {
  0% { box-shadow: 0 0 0 0 rgba(0, 245, 118, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(0, 245, 118, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 245, 118, 0); }
}
.status-text { font-size: 1.5rem; font-weight: 800; }
.player-count {
  display: flex; align-items: center; gap: 8px;
  background: rgba(255,255,255,0.05);
  padding: 8px 16px; border-radius: 12px;
  font-weight: 700; font-size: 1.1rem;
}
.motd {
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.05);
  padding: 1rem; border-radius: 12px;
  font-family: var(--font-code); font-size: 0.9rem; color: var(--text-muted);
}

/* Controls */
.form-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;
}
.input-group { display: flex; flex-direction: column; gap: 8px; }
.input-group label { font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.cyber-input {
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.1);
  color: white; padding: 14px 16px; border-radius: 12px;
  font-family: var(--font-body); font-size: 1rem; font-weight: 500;
  outline: none; transition: all 0.2s;
  appearance: none;
}
.cyber-input:focus { border-color: var(--accent-cyan); box-shadow: 0 0 15px rgba(0,240,255,0.15); }

.button-grid { display: flex; gap: 1rem; }
.btn {
  flex: 1; padding: 14px 0; border-radius: 12px; border: none;
  font-family: var(--font-body); font-weight: 700; font-size: 1rem;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:hover:not(:disabled) { transform: translateY(-2px); }

.btn-glow-success {
  background: var(--success); color: #000;
  box-shadow: 0 8px 25px rgba(0, 245, 118, 0.3);
}
.btn-glow-danger {
  background: rgba(255, 42, 85, 0.1); color: var(--danger);
  border: 1px solid rgba(255, 42, 85, 0.3);
}
.btn-glow-danger:hover:not(:disabled) {
  background: var(--danger); color: white;
  box-shadow: 0 8px 25px rgba(255, 42, 85, 0.3);
}
.btn-ghost {
  background: transparent; color: var(--text-muted); border: 1px solid rgba(255,255,255,0.1);
}
.btn-ghost:hover { background: rgba(255,255,255,0.05); color: white; }

/* Endpoints */
.endpoint-list { display: flex; flex-direction: column; gap: 1rem; }
.endpoint-item {
  display: flex; align-items: center; gap: 1rem;
  background: rgba(0,0,0,0.3); padding: 1.2rem; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);
}
.ep-icon {
  width: 44px; height: 44px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; font-size: 1.4rem;
}
.ep-meta { flex: 1; }
.ep-title { font-weight: 700; font-size: 0.95rem; margin-bottom: 2px; }
.ep-addr { font-family: var(--font-code); color: var(--text-muted); font-size: 0.85rem; }

/* Runs Timeline */
.runs-container { flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 5px; }
.runs-container::-webkit-scrollbar { width: 6px; }
.runs-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
.run-list { list-style: none; display: flex; flex-direction: column; gap: 1.2rem; }
.run-item { display: flex; gap: 1rem; align-items: flex-start; }
.run-ring {
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.1); flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; margin-top: 5px;
}
.run-dot { width: 6px; height: 6px; border-radius: 50%; }
.run-dot.success { background: var(--success); }
.run-dot.running { background: var(--accent-blue); box-shadow: 0 0 10px var(--accent-blue); }
.run-dot.queued { background: var(--warning); }
.run-dot.failed { background: var(--danger); }
.run-dot.cancelled { background: var(--text-muted); }

.run-meta { flex: 1; background: rgba(255,255,255,0.02); padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03); }
.run-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.run-num { font-weight: 700; font-size: 0.95rem; }
.run-badge { font-size: 0.65rem; font-weight: 800; padding: 4px 8px; border-radius: 6px; letter-spacing: 0.05em; }
.run-badge.success { background: rgba(0,245,118,0.1); color: var(--success); }
.run-badge.running { background: rgba(0,136,255,0.1); color: var(--accent-blue); }
.run-badge.queued { background: rgba(255,184,0,0.1); color: var(--warning); }
.run-badge.failed { background: rgba(255,42,85,0.1); color: var(--danger); }
.run-badge.cancelled { background: rgba(255,255,255,0.05); color: var(--text-muted); }
.run-time { font-size: 0.75rem; color: var(--text-muted); }

.github-link { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }
.github-link:hover { color: var(--accent-cyan); }

.empty-state { text-align: center; color: var(--text-muted); font-size: 0.95rem; margin-top: 3rem; }

/* Toast */
.toast {
  margin-top: 15px; padding: 12px 16px; border-radius: 10px;
  font-size: 0.9rem; font-weight: 600; display: none; text-align: center;
}
.toast.success { display: block; background: rgba(0,245,118,0.1); color: var(--success); border: 1px solid rgba(0,245,118,0.3); }
.toast.error   { display: block; background: rgba(255,42,85,0.1); color: var(--danger); border: 1px solid rgba(255,42,85,0.3); }

footer { text-align: center; font-size: 0.8rem; color: var(--text-muted); padding-bottom: 2rem; }
`;
}

function dashboardScript() {
  return `
const $ = (id) => document.getElementById(id);
const statusDot    = $("statusDot");
const statusText   = $("statusText");
const playerCount  = $("playerCount");
const motdEl       = $("motd");
const startBtn     = $("startBtn");
const stopBtn      = $("stopBtn");
const refreshBtn   = $("refreshBtn");
const memorySelect = $("memorySelect");
const durationInput= $("durationInput");
const toast        = $("toast");
const banner       = $("diagnostic-banner");

async function fetchStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    const online = data?.online === true;
    statusDot.className = "dot " + (online ? "online" : "offline");
    statusText.textContent = online ? "Network Linked" : "Network Unreachable";
    playerCount.textContent = online ? (data.players?.online ?? 0) : "—";
    motdEl.innerHTML = online
      ? "PAK MC SERVER — We Will Rise Again"
      : "<i>Awaiting server boot sequence...</i>";

    // Update connection endpoints with live tunnel addresses
    const connJava    = document.getElementById("conn-java");
    const connBedrock = document.getElementById("conn-bedrock");
    if (connJava    && data.java_host)    connJava.textContent    = data.java_host;
    if (connBedrock && data.bedrock_host) connBedrock.textContent = data.bedrock_host + " : " + (data.bedrock_port || "19132");

    // Show banner if a run is in progress but server is offline (playit may be missing)
    if (!online && document.querySelector('.run-dot.running')) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  } catch (e) {
    statusText.textContent = "Telemetry Disconnected";
  }
}

function showToast(msg, type) {
  toast.className = "toast " + type;
  toast.textContent = msg;
  setTimeout(() => toast.className = "toast", 5000);
}

async function callAction(path, btn, label) {
  const prev = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "<span class='btn-icon'>⏳</span> Transmitting...";
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memory: memorySelect.value,
        duration: parseInt(durationInput.value, 10),
      }),
    });
    const data = await res.json();
    if (data.ok) {
      showToast(data.message || (label + " Command Accepted"), "success");
      setTimeout(() => location.reload(), 2500);
    } else {
      showToast("Transmission Failed: " + (data.error || "unknown exception"), "error");
    }
  } catch (e) {
    showToast("Network disconnect: " + e.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = prev;
  }
}

startBtn.addEventListener("click", () => callAction("/api/start", startBtn, "Startup"));
stopBtn.addEventListener("click",  () => {
  if (confirm("WARNING: Halting the server forces an immediate disconnection for all active players. Proceed?")) {
    callAction("/api/stop", stopBtn, "Halt");
  }
});
refreshBtn.addEventListener("click", () => {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = "Syncing...";
    location.reload();
});

fetchStatus();
setInterval(fetchStatus, 20000);

document.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector('.run-dot.running')) {
        setTimeout(fetchStatus, 1000);
    }
});
`;
}

export function renderForbidden(email, env) {
  return new Response("Forbidden: " + email, { status: 403 });
}
export function renderError(err, env) {
  return new Response("Error: " + err, { status: 500 });
}
function escapeHtml(str) { return String(str ?? ""); }
