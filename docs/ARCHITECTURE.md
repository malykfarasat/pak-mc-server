# PAK MC SERVER — Architecture

## High-level diagram

```
                              ┌─────────────────────────────────┐
                              │        Players (anywhere)        │
                              └──────────────┬──────────────────┘
                                             │
                  ┌──────────────────────────┼──────────────────────────┐
                  │                          │                          │
                  ▼                          ▼                          ▼
          ┌──────────────┐          ┌──────────────┐          ┌───────────────┐
          │  Java client │          │Bedrock client│          │  Any browser  │
          │ (1.8 - 1.21) │          │ (Xbox/PS/etc)│          │               │
          └──────┬───────┘          └──────┬───────┘          └───────┬───────┘
                 │                         │                          │
                 │ TCP 25565               │ UDP 19132                │ HTTPS
                 │                         │                          │
                 ▼                         ▼                          ▼
            ┌─────────────────────────────────┐             ┌─────────────────┐
            │    Cloudflare DNS + Edge        │             │  Cloudflare     │
            │    (mc.pakanonymous.org)        │             │  Workers        │
            └──────────────────┬──────────────┘             │  ┌────────────┐ │
                               │                             │  │ status.pak │ │
                               ▼                             │  └────────────┘ │
                         ┌──────────────┐                    │  ┌────────────┐ │
                         │  playit.gg   │                    │  │ admin.pak  │ │
                         │  tunnel      │                    │  │ (OAuth)    │ │
                         └──────┬───────┘                    │  └──────┬─────┘ │
                                │                             └─────────┼──────┘
                                ▼                                       │
                  ┌──────────────────────────────┐                       │
                  │   GitHub Actions runner      │◀──────────────────────┘
                  │   (ubuntu-latest, 7GB RAM)   │       workflow_dispatch
                  │                              │
                  │   ┌──────────────────────┐   │
                  │   │ Fabric MC 1.21.1     │   │
                  │   │  ├─ Fabric API       │   │
                  │   │  ├─ Geyser-Fabric    │──┐│
                  │   │  ├─ Floodgate-Fabric │  ├┼──── Bedrock UDP 19132
                  │   │  ├─ ViaFabric(+Plus) │  ││
                  │   │  ├─ Simple Voice Chat│  ││
                  │   │  └─ Lithium/Krypton  │  ││
                  │   └──────────────────────┘  ││
                  │                              ││
                  │   Java TCP 25565 ────────────┘│
                  │                               │
                  └───────────────────────────────┘
                                 │
                                 │  world save
                                 ▼
                   ┌──────────────────────────┐
                   │  GitHub Actions Cache    │
                   │  + Artifact storage      │
                   └──────────────────────────┘
```

---

## Components

### 1. GitHub Actions runner
- `ubuntu-latest` runner, 7GB RAM, 6h max runtime
- Downloads Fabric server 1.21.1 from the official Fabric meta API at runtime
- Runs `scripts/install-mods.sh` to fetch all server mods from Modrinth/GeyserMC CDN
- Starts playit agent as a background process
- Starts the Minecraft JVM with Aikar's GC flags
- World is persisted via:
  - `actions/cache@v4` between runs (fast)
  - `actions/upload-artifact@v4` on job end (30-day retention, downloadable)

### 2. playit.gg tunnel
- Provides the only working free solution for exposing both TCP and UDP from GitHub Actions.
- TCP tunnel bridges Java clients to port 25565 on the runner
- UDP tunnel bridges Bedrock clients to port 19132 on the runner (Geyser is listening there)
- Authenticated via a pre-generated **agent secret** stored as `PLAYIT_SECRET_KEY` secret in GitHub

### 3. Cloudflare DNS
- `mc.pakanonymous.org` — CNAME to the playit Java tunnel, optionally also A record for Bedrock
- **Must be grey-cloud** (DNS only, not proxied) — Cloudflare's proxy only handles HTTP/HTTPS
- Custom Bedrock port is handled client-side (players enter `mc.pakanonymous.org : 19132`)

### 4. Cloudflare Worker: `status`
- Deployed at `status.pakanonymous.org`
- Calls `api.mcsrvstat.us` for Java and Bedrock status
- Cached at the Cloudflare edge for 30s
- Pure HTML/CSS/JS — no build step, no dependencies
- Exposes `/api/status` as JSON for integrations

### 5. Cloudflare Worker: `admin`
- Deployed at `admin.pakanonymous.org`
- Custom **Google OAuth 2.0** flow (no third-party library, ~200 lines)
- **Session management** via HMAC-SHA256 signed cookies (stateless, no KV needed)
- Email allowlist — only `malikmuhammadfarasatali@gmail.com` can access the dashboard
- Uses GitHub REST API to:
  - **Start server**: `POST /repos/{owner}/{repo}/actions/workflows/minecraft.yml/dispatches`
  - **Stop server**: `POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel`
  - **List runs**: `GET /repos/{owner}/{repo}/actions/workflows/minecraft.yml/runs`
- GitHub PAT is stored as a Worker secret (`wrangler secret put GITHUB_PAT`)

### 6. Mod stack
| Mod | Purpose |
|---|---|
| Fabric API | Base library for all Fabric mods |
| **Geyser-Fabric** | Accepts Bedrock Edition connections on UDP 19132 and forwards them to the Java server |
| **Floodgate-Fabric** | Provides authentication for Bedrock players (no Java account needed) |
| **ViaFabric** | Backports/forwardports protocol — lets Java 1.8 through 1.21.x clients all connect |
| ViaFabricPlus | Enhances ViaFabric with client-side fixes |
| Simple Voice Chat | Proximity voice chat (server-side component) |
| Lithium | CPU optimization mod |
| FerriteCore | Reduces RAM usage by ~30% |
| Krypton | Optimizes Minecraft's networking stack |
| Spark | Profiler for diagnosing lag |

---

## Security model

### Admin authentication
1. User visits `admin.pakanonymous.org`
2. Worker checks for signed session cookie
3. If missing/invalid → redirect to `/login`
4. `/login` redirects to Google OAuth consent screen with a CSRF `state` parameter stored in a short-lived cookie
5. Google redirects back to `/auth/callback?code=...&state=...`
6. Worker:
   - Verifies the state matches the cookie (CSRF protection)
   - Exchanges the code for tokens via Google's token endpoint (server-to-server over HTTPS with the client secret)
   - Decodes the ID token's payload to get `email` and `email_verified`
   - If `email === ALLOWED_EMAIL && email_verified === true`, mints a session
7. Session cookie structure:
   ```
   base64url(JSON{email, name, picture, iat, exp}) . base64url(HMAC-SHA256(body, SESSION_SECRET))
   ```
8. On every subsequent request, the HMAC is verified before any action is taken

### Why not Cloudflare Access?
- Cloudflare Access would also work and is arguably better, but requires Zero Trust setup and the user has to configure Access applications in the dashboard.
- Doing OAuth directly in the Worker keeps the whole stack self-contained and version-controlled.

### Secrets at rest
- GitHub secrets (`PLAYIT_SECRET_KEY`, `GH_DISPATCH_TOKEN`, etc.) — encrypted at rest by GitHub
- Cloudflare Worker secrets (`GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `GITHUB_PAT`) — encrypted at rest by Cloudflare, never returned by the dashboard
- No secret is ever committed to the repo

---

## Cost

| Item | Cost |
|---|---|
| GitHub Actions (public repo) | Free (unlimited) |
| GitHub Actions (private repo) | Free up to 2000 min/month (33h) |
| Cloudflare Workers | Free up to 100k requests/day |
| Cloudflare DNS | Free |
| playit.gg | Free |
| Google OAuth | Free |
| **Total** | **$0** |

---

## Why this architecture?

| Alternative | Why we didn't use it |
|---|---|
| Aternos / Minehut | No control, limited mods, ads |
| Free Oracle VPS | Requires credit card + complex setup, risk of being shut down |
| Railway / Fly.io free tier | Limited to ~500MB RAM, not enough for modded |
| Pure Cloudflare Tunnel (no playit) | Doesn't support UDP well → no Bedrock |
| Cloudflare Spectrum | Paid ($) |
| ngrok | Free tier is TCP-only with session limits |
| Self-hosting | Defeats the point of "free" |
