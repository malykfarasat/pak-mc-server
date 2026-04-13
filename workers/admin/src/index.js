/**
 * PAK MC SERVER — Admin Worker
 *
 * Deployed at: https://admin.pakanonymous.org
 *
 * Google OAuth 2.0 protected admin dashboard. Only the email configured
 * in env.ALLOWED_EMAIL can access the panel. Provides controls to:
 *   • Start the Minecraft server  (GitHub workflow_dispatch)
 *   • Stop the Minecraft server   (cancels the running workflow)
 *   • View recent server sessions (GitHub runs API)
 *   • View live server status     (Java + Bedrock)
 */

import {
  handleLogin,
  handleCallback,
  handleLogout,
  requireSession,
} from "./auth.js";
import {
  startServer,
  stopServer,
  listRuns,
  getRunLogs,
} from "./github.js";
import {
  renderDashboard,
  renderForbidden,
  renderError,
} from "./templates.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      // ── Public auth routes ─────────────────────────────────────────────
      if (url.pathname === "/login") {
        return handleLogin(request, env);
      }
      if (url.pathname === "/auth/callback") {
        return handleCallback(request, env);
      }
      if (url.pathname === "/logout") {
        return handleLogout(request, env);
      }
      if (url.pathname === "/healthz") {
        return new Response("ok", { headers: { "Content-Type": "text/plain" } });
      }

      // ── All other routes require a valid session ──────────────────────
      const session = await requireSession(request, env);
      if (!session) {
        return Response.redirect(`${url.origin}/login`, 302);
      }
      if (session.email !== env.ALLOWED_EMAIL) {
        return renderForbidden(session.email, env);
      }

      // ── API routes ─────────────────────────────────────────────────────
      if (url.pathname === "/api/start" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const result = await startServer(env, body);
        return jsonResponse(result);
      }
      if (url.pathname === "/api/stop" && request.method === "POST") {
        const result = await stopServer(env);
        return jsonResponse(result);
      }
      if (url.pathname === "/api/runs") {
        const runs = await listRuns(env);
        return jsonResponse({ runs });
      }
      if (url.pathname === "/api/status") {
        const host = env.MC_HOST || "mc.pakanonymous.org";
        const res = await fetch(`https://api.mcsrvstat.us/3/${host}`, {
          cf: { cacheTtl: 15, cacheEverything: true },
        });
        return new Response(await res.text(), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.pathname.startsWith("/api/logs/") && request.method === "GET") {
        const runId = url.pathname.split("/").pop();
        const logs = await getRunLogs(env, runId);
        return new Response(logs, {
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
        });
      }

      // ── Dashboard (HTML) ───────────────────────────────────────────────
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return renderDashboard(session, env);
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      console.error("Admin worker error:", err);
      return renderError(err, env);
    }
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}
