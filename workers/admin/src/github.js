/**
 * GitHub REST API client for PAK MC SERVER admin controls.
 *
 * Uses a fine-grained PAT (stored as GITHUB_PAT secret) with permissions:
 *   • Actions: Read & Write  (to dispatch and cancel workflows)
 *   • Metadata: Read
 *
 * Expected env vars:
 *   GITHUB_PAT     — the token
 *   GITHUB_OWNER   — repo owner (e.g. "malikali")
 *   GITHUB_REPO    — repo name  (e.g. "pak-mc-server")
 */

const GH_API = "https://api.github.com";
const MC_WORKFLOW = "minecraft.yml";

function ghHeaders(env) {
  return {
    Authorization: `Bearer ${env.GITHUB_PAT}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "PAK-MC-Admin/1.0",
  };
}

function repoPath(env) {
  return `${env.GITHUB_OWNER}/${env.GITHUB_REPO}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Start server — dispatch the minecraft.yml workflow
// ─────────────────────────────────────────────────────────────────────────────
export async function startServer(env, opts = {}) {
  if (!env.GITHUB_PAT || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return { ok: false, error: "GitHub integration is not configured on admin worker." };
  }

  const requestedMemory = String(opts.memory || "5G").toUpperCase();
  const memory = /^(3|4|5|6|7|8)G$/.test(requestedMemory) ? requestedMemory : "5G";
  const requestedDuration = Number.parseInt(String(opts.duration || 340), 10);
  const duration = Number.isFinite(requestedDuration)
    ? Math.max(10, Math.min(350, requestedDuration))
    : 340;
  const motd = typeof opts.motd === "string" ? opts.motd.slice(0, 120) : "";

  const url = `${GH_API}/repos/${repoPath(env)}/actions/workflows/${MC_WORKFLOW}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: { ...ghHeaders(env), "Content-Type": "application/json" },
    body: JSON.stringify({
      ref: env.GITHUB_BRANCH || "main",
      inputs: {
        memory,
        duration: String(duration),
        motd,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, error: text };
  }
  return { ok: true, message: "Server starting — check runs in ~10s" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop server — cancel any in-progress minecraft.yml runs
// ─────────────────────────────────────────────────────────────────────────────
export async function stopServer(env) {
  if (!env.GITHUB_PAT || !env.GITHUB_OWNER || !env.GITHUB_REPO) {
    return { ok: false, error: "GitHub integration is not configured on admin worker." };
  }

  const runs = await listRuns(env, { status: "in_progress" });
  if (runs.length === 0) {
    return { ok: true, message: "No running sessions to stop" };
  }

  const results = [];
  for (const run of runs) {
    const res = await fetch(
      `${GH_API}/repos/${repoPath(env)}/actions/runs/${run.id}/cancel`,
      { method: "POST", headers: ghHeaders(env) }
    );
    results.push({ id: run.id, cancelled: res.ok });
  }
  return { ok: true, message: `Stopped ${results.length} session(s)`, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// List recent workflow runs
// ─────────────────────────────────────────────────────────────────────────────
export async function listRuns(env, { status = null, limit = 10 } = {}) {
  let url = `${GH_API}/repos/${repoPath(env)}/actions/workflows/${MC_WORKFLOW}/runs?per_page=${limit}`;
  if (status) url += `&status=${status}`;

  const res = await fetch(url, { headers: ghHeaders(env) });
  if (!res.ok) return [];
  const data = await res.json();

  return (data.workflow_runs || []).map((r) => ({
    id: r.id,
    status: r.status,
    conclusion: r.conclusion,
    created_at: r.created_at,
    updated_at: r.updated_at,
    run_number: r.run_number,
    html_url: r.html_url,
    actor: r.actor?.login,
    duration_ms: r.updated_at && r.run_started_at
      ? new Date(r.updated_at) - new Date(r.run_started_at)
      : null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch logs for a specific run (returns plaintext)
// ─────────────────────────────────────────────────────────────────────────────
export async function getRunLogs(env, runId) {
  const url = `${GH_API}/repos/${repoPath(env)}/actions/runs/${runId}/logs`;
  const res = await fetch(url, {
    headers: ghHeaders(env),
    redirect: "follow",
  });
  if (!res.ok) return `Failed to fetch logs: ${res.status}`;
  // GitHub returns a zip archive — we can't unzip in a Worker easily,
  // so just tell the user to visit the run URL.
  return `Logs are in a zip archive. Open: https://github.com/${repoPath(env)}/actions/runs/${runId}`;
}
