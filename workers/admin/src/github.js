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
const MAX_RETRIES = 3;

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

function isConfigured(env) {
  return Boolean(env.GITHUB_PAT && env.GITHUB_OWNER && env.GITHUB_REPO);
}

async function ghRequest(env, path, init = {}, retries = MAX_RETRIES) {
  const res = await fetch(`${GH_API}${path}`, {
    ...init,
    headers: {
      ...ghHeaders(env),
      ...(init.headers || {}),
    },
  });

  if (res.ok) return res;

  const shouldRetry =
    retries > 1 && (res.status === 429 || res.status >= 500);
  if (shouldRetry) {
    await new Promise((resolve) => setTimeout(resolve, (MAX_RETRIES - retries + 1) * 700));
    return ghRequest(env, path, init, retries - 1);
  }
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// Start server — dispatch the minecraft.yml workflow
// ─────────────────────────────────────────────────────────────────────────────
export async function startServer(env, opts = {}) {
  if (!isConfigured(env)) {
    return { ok: false, error: "GitHub integration is not configured on admin worker." };
  }

  const requestedMemory = String(opts.memory || "5G").toUpperCase();
  const memory = /^(3|4|5|6|7|8)G$/.test(requestedMemory) ? requestedMemory : "5G";
  const requestedDuration = Number.parseInt(String(opts.duration || 340), 10);
  const duration = Number.isFinite(requestedDuration)
    ? Math.max(10, Math.min(350, requestedDuration))
    : 340;
  const motd = typeof opts.motd === "string" ? opts.motd.slice(0, 120) : "";

  const res = await ghRequest(env, `/repos/${repoPath(env)}/actions/workflows/${MC_WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  return { ok: true, message: "Server start submitted. Refresh runs in 10-15 seconds." };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop server — cancel any in-progress minecraft.yml runs
// ─────────────────────────────────────────────────────────────────────────────
export async function stopServer(env) {
  if (!isConfigured(env)) {
    return { ok: false, error: "GitHub integration is not configured on admin worker." };
  }

  const runs = await listRuns(env, { status: "in_progress" });
  if (runs.length === 0) {
    return { ok: true, message: "No running sessions to stop" };
  }

  const results = [];
  for (const run of runs) {
    const res = await ghRequest(env, `/repos/${repoPath(env)}/actions/runs/${run.id}/cancel`, {
      method: "POST",
    });
    results.push({ id: run.id, cancelled: res.ok });
  }
  return { ok: true, message: `Stopped ${results.length} session(s)`, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// List recent workflow runs
// ─────────────────────────────────────────────────────────────────────────────
export async function listRuns(env, { status = null, limit = 10 } = {}) {
  if (!isConfigured(env)) return [];

  let url = `${GH_API}/repos/${repoPath(env)}/actions/workflows/${MC_WORKFLOW}/runs?per_page=${limit}`;
  if (status) url += `&status=${status}`;

  const res = await ghRequest(env, url.replace(GH_API, ""));
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
  const res = await ghRequest(env, `/repos/${repoPath(env)}/actions/runs/${runId}/logs`, {
    redirect: "follow",
  });
  if (!res.ok) return `Failed to fetch logs: ${res.status}`;
  // GitHub returns a zip archive — we can't unzip in a Worker easily,
  // so just tell the user to visit the run URL.
  return `Logs are in a zip archive. Open: https://github.com/${repoPath(env)}/actions/runs/${runId}`;
}

export async function getRuntimeOverview(env) {
  if (!isConfigured(env)) {
    return {
      configured: false,
      message: "GitHub integration is not configured.",
      runs: [],
    };
  }
  const runs = await listRuns(env, { limit: 12 });
  const active = runs.find((run) => run.status === "in_progress" || run.status === "queued") || null;
  const latest = runs[0] || null;
  return {
    configured: true,
    active,
    latest,
    runs,
  };
}
