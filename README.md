# PAK MC SERVER

Production-ready Minecraft runtime on GitHub Actions with Cloudflare Worker control plane.

## What this project provides

- Reliable Java + Bedrock server runtime (`workflow_dispatch` based)
- Public player status page (`status.pakanonymous.org`)
- Admin dashboard with Google OAuth (`admin.pakanonymous.org`)
- Deterministic mod installation using a lock file (`config/mods.lock.json`)
- Runtime diagnostics artifacts with canonical join output (`join_info.txt`)

## Architecture

- `/.github/workflows/minecraft.yml`  
  Starts the game server, tunnel, and persistence pipeline.
- `/scripts/install-mods.sh` + `/config/mods.lock.json`  
  Deterministic mod installation from pinned URLs.
- `/workers/status`  
  Public status UI/API for players.
- `/workers/admin`  
  Protected admin UI/API for server operations.

## Required secrets

Set in **GitHub Repository Settings -> Secrets and variables -> Actions**:

- `PLAYIT_SECRET_KEY` (preferred) or `PLAYIT_SECRET` (legacy fallback)
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET` (32+ chars)
- `GH_DISPATCH_TOKEN` (fine-grained PAT with actions read/write)
- `RCON_PASSWORD` (optional, recommended)

## Start a server session

1. Open GitHub Actions.
2. Run workflow: `PAK MC SERVER Runtime`.
3. Choose runtime inputs:
   - memory: `3G` to `6G`
   - duration: `10` to `350` minutes
   - motd: optional
4. Wait for `Start Minecraft server` step.

## Get join info

Every run uploads `runtime-diagnostics-<run_number>` containing:

- `join_info.txt` (canonical endpoint)
- `playit.log`
- `logs/latest.log`

`join_info.txt` fields:

- `status` (`ready`, `degraded`, etc.)
- `java_host`
- `java_port`
- `bedrock_host`
- `bedrock_port`
- `source`

## Player connection

- Java: `mc.pakanonymous.org` (or host/port from `join_info.txt`)
- Bedrock: same host, port `19132`

## Local development

Status worker:

```bash
cd workers/status
npm install
npm run dev
```

Admin worker:

```bash
cd workers/admin
npm install
npm run dev
```

## Operational notes

- Only one runtime session is allowed at a time via workflow concurrency lock.
- Floodgate config is reset at boot to avoid stale cache incompatibility.
- If `PLAYIT_SECRET_KEY` is missing, tunnel can start in guest mode and endpoint stability is not guaranteed.

## Deployment

Worker deployment is automated by:

- `.github/workflows/deploy-workers.yml`

This workflow validates secrets, deploys both workers, and runs basic smoke checks.
