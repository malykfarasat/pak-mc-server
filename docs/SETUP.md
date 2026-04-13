# PAK MC SERVER — Setup Guide

Everything you need to go from zero to a running server with status + admin pages.

---

## Part 1 — GitHub repo

### 1.1 Create the repo
```bash
cd "C:\Users\malik\Documents\Minecraft-World-Host"
git init
git add .
git commit -m "initial PAK MC SERVER setup"
gh repo create pak-mc-server --public --source=. --push
```
(or create it manually on github.com and `git push`)

### 1.2 Create a fine-grained personal access token
This is how the admin panel will start/stop the server.

1. Go to https://github.com/settings/personal-access-tokens/new
2. **Token name**: `pak-mc-admin`
3. **Resource owner**: you
4. **Repository access**: only `pak-mc-server`
5. **Permissions** → Repository permissions:
   - **Actions**: Read and write
   - **Metadata**: Read-only
6. Click **Generate token** → copy it (starts with `github_pat_`)

---

## Part 2 — playit.gg (the Minecraft tunnel)

playit.gg is the simplest way to expose a Minecraft server running inside a GitHub Actions runner to the outside world — it's free and supports both **TCP** (Java) and **UDP** (Bedrock).

### 2.1 Create the account and tunnels
1. Sign up at https://playit.gg (free)
2. Go to **Tunnels → Create Tunnel**
3. Create **two** tunnels:
   - **Tunnel 1** — Type: `Minecraft Java`, Port: `25565`
   - **Tunnel 2** — Type: `Minecraft Bedrock`, Port: `19132`
4. Note down the hostnames playit gives you (e.g. `xyz-1234.joinmc.link`)

### 2.2 Get the agent secret
1. Go to **Account → Agents → Create Agent**
2. Give it a name like `pak-mc-github-runner`
3. Copy the **secret key**

---

## Part 3 — Google OAuth (for admin panel login)

### 3.1 Create the OAuth client
1. Go to https://console.cloud.google.com
2. Create a new project or select one: `pak-mc-admin`
3. Go to **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - App name: `PAK MC Admin`
   - Support email: `malikmuhammadfarasatali@gmail.com`
   - Scopes: `openid`, `email`, `profile`
   - Test users: add `malikmuhammadfarasatali@gmail.com`
4. Go to **APIs & Services → Credentials → Create → OAuth client ID**
   - Application type: **Web application**
   - Name: `PAK MC Admin Worker`
   - Authorized redirect URIs:
     - `https://admin.pakanonymous.org/auth/callback`
     - `https://pak-mc-admin.YOUR-SUBDOMAIN.workers.dev/auth/callback` *(while testing before custom domain is live)*
5. Click **Create** → copy the **Client ID** and **Client Secret**

---

## Part 4 — Cloudflare

### 4.1 API token
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** → use the **Edit Cloudflare Workers** template
3. Add **Zone:DNS:Edit** permission for `pakanonymous.org`
4. Copy the token

### 4.2 Account ID
Go to any domain in your Cloudflare dashboard → sidebar → **Account ID** (right side) → copy it.

---

## Part 5 — Add all secrets to GitHub

In your `pak-mc-server` repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `PLAYIT_SECRET_KEY` | playit agent secret from step 2.2 |
| `CLOUDFLARE_API_TOKEN` | from step 4.1 |
| `CLOUDFLARE_ACCOUNT_ID` | from step 4.2 |
| `GOOGLE_CLIENT_ID` | from step 3.1 |
| `GOOGLE_CLIENT_SECRET` | from step 3.1 |
| `SESSION_SECRET` | run `bash scripts/generate-session-secret.sh` and paste |
| `GH_DISPATCH_TOKEN` | the fine-grained PAT from step 1.2 |
| `RCON_PASSWORD` *(optional)* | any random string for RCON |

---

## Part 6 — Configure + deploy the Cloudflare Workers

### 6.1 Set your GitHub owner in the admin worker
Edit `workers/admin/wrangler.toml`:
```toml
GITHUB_OWNER = "your-github-username"
```
Commit and push.

### 6.2 First deploy
The `deploy-workers.yml` workflow will run automatically on push to `main`. After it finishes, both workers are live at:
- `https://pak-mc-status.YOUR-SUBDOMAIN.workers.dev`
- `https://pak-mc-admin.YOUR-SUBDOMAIN.workers.dev`

Visit the admin URL and test Google login. You should be redirected to Google, sign in with `malikmuhammadfarasatali@gmail.com`, and land on the admin dashboard.

### 6.3 Bind custom domains
Once the workers are deployed and working:

1. Uncomment the `[[routes]]` block in `workers/status/wrangler.toml`:
   ```toml
   [[routes]]
   pattern       = "status.pakanonymous.org/*"
   zone_name     = "pakanonymous.org"
   custom_domain = true
   ```

2. Same for `workers/admin/wrangler.toml`:
   ```toml
   [[routes]]
   pattern       = "admin.pakanonymous.org/*"
   zone_name     = "pakanonymous.org"
   custom_domain = true
   ```

3. Commit and push — the deploy-workers workflow re-runs and binds the domains. Cloudflare automatically creates the DNS records.

---

## Part 7 — DNS for mc.pakanonymous.org

Point the `mc` subdomain at your playit tunnel.

### Option A — Manual (Cloudflare dashboard)
Add a **CNAME** record:
- Name: `mc`
- Target: (your playit Java tunnel hostname, e.g. `xyz-1234.joinmc.link`)
- Proxy status: **DNS only** (grey cloud — must be grey because Cloudflare proxy doesn't handle Minecraft TCP/UDP)

### Option B — Scripted
```bash
export CF_API_TOKEN="<your cloudflare token>"
export MC_TARGET="xyz-1234.joinmc.link"
bash scripts/setup-cloudflare-dns.sh
```

---

## Part 8 — Start the server

1. Open `https://admin.pakanonymous.org`
2. Sign in with `malikmuhammadfarasatali@gmail.com`
3. Click **▶ Start Server**
4. Wait ~2 minutes for Minecraft to boot
5. Tell your friends:
   - **Java**: `mc.pakanonymous.org`
   - **Bedrock**: `mc.pakanonymous.org` port `19132`

---

## Part 9 — Check status

Anyone can visit `https://status.pakanonymous.org` to see:
- Whether the server is online
- Who's currently playing
- Version + MOTD
- How to connect (Java + Bedrock)

---

## Session limits

| Limit | Value |
|---|---|
| Max session length | ~5h 40m (GitHub Actions cap is 6h) |
| RAM available | 5GB to server, 2GB for runner OS |
| Concurrent sessions | 1 (enforced by `concurrency:` in workflow) |
| World persistence | Cached between runs + uploaded as artifacts for 30 days |
| Monthly free minutes | 2000 minutes for private repos, unlimited for public |

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues like:
- "Server shows offline even though the workflow is running" — DNS propagation
- "Bedrock players can't connect" — playit UDP tunnel not configured
- "Admin panel gives 403" — check `ALLOWED_EMAIL` in `workers/admin/wrangler.toml`
- "GitHub Action fails to download a mod" — Modrinth version pinning
