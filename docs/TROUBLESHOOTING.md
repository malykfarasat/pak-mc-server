# Troubleshooting

## Fast recovery checklist

1. Open latest run in GitHub Actions (`PAK MC SERVER Runtime`).
2. Download `runtime-diagnostics` artifact.
3. Check `join_info.txt` first.
4. If `status=degraded`, inspect `playit.log`.
5. If server crashed, inspect `logs/latest.log`.

## Common failures

### 1) Workflow fails before server starts

- Confirm required secrets exist (`PLAYIT_SECRET_KEY` or `PLAYIT_SECRET`, OAuth, Cloudflare, GitHub PAT).
- Verify `config/mods.lock.json` exists and has valid URLs.
- Check `Install server mods from lock file` step for download failures.

### 2) Tunnel starts but endpoint missing

- Open `playit.log` in diagnostics artifact.
- Look for claim-mode output (happens when no playit secret is configured).
- Add `PLAYIT_SECRET_KEY` and rerun workflow.

### 3) Bedrock cannot join

- Confirm server `online-mode=false` in `server.properties`.
- Confirm workflow step `Verify required bridge mods` succeeded.
- Confirm `bedrock_port=19132` in `join_info.txt`.

### 4) Floodgate crash on boot

- Workflow now resets `config/floodgate/config.yml` on each run to avoid stale cached config.
- If crash persists, remove persisted `config` from cache by running a fresh workflow after cache key rotation.

### 5) Admin panel cannot start/stop server

- Ensure `workers/admin` has secret `GITHUB_PAT`.
- Ensure `workers/admin/wrangler.toml` repo owner/repo/branch values are correct.
- Verify PAT includes Actions read/write permissions.

### 6) Status page says offline while server is up

- Status page uses upstream status source and edge caching.
- Wait 30-60 seconds and refresh.
- Check `/api/status` payload on status worker.

## Deterministic recovery flow

If runtime quality degrades unexpectedly:

1. Trigger a new runtime session.
2. Validate `join_info.txt` from diagnostics artifact.
3. If bad, inspect:
   - `playit.log`
   - `logs/latest.log`
4. Apply config fix in repository.
5. Re-run workflow until `join_info.txt` shows `status=ready`.

## Start-to-join timeline target

- 0:00 dispatch workflow
- 0:30 preflight + mod install complete
- 0:50 tunnel resolved and `join_info.txt` populated
- 1:10 server enters startup
- 1:40 server available for players

If the timeline exceeds 3 minutes, review logs for tunnel or mod download delays.
