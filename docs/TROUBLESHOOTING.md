# PAK MC SERVER — Troubleshooting

## Server doesn't start

### Workflow immediately fails with "Download failed"
- Check the Actions log — usually one of the mod downloads returned 404
- Fabric loader versions sometimes get retired. Update `FABRIC_LOADER_VERSION` in `.github/workflows/minecraft.yml` to a current stable version from https://meta.fabricmc.net/v2/versions/loader
- Modrinth URLs move around — the installer script falls back silently on failure, so missing non-critical mods won't stop the server

### Java out-of-memory
- Drop the memory input to `4G` or `3G` — the runner only has 7GB total and some is used by the OS, Java overhead, playit agent, etc.

### World doesn't persist
- Cache hits require the key to match. The workflow uses `restore-keys: pak-mc-world-` which matches any previous world — should work out of the box
- Worst case, download the world from the Actions artifacts and re-upload it to a new release

---

## Can't connect to the server

### Java client can't find `mc.pakanonymous.org`
1. Check that the DNS record exists in Cloudflare:
   ```bash
   nslookup mc.pakanonymous.org
   ```
2. Confirm it's **grey-cloud** (DNS only). Cloudflare's proxy does not handle Minecraft traffic.
3. Check that the playit tunnel is active in the playit.gg dashboard → Tunnels page
4. Test the playit hostname directly in Minecraft — if that works but `mc.pakanonymous.org` doesn't, it's a DNS issue.

### Bedrock client says "Unable to connect to world"
1. Bedrock needs UDP, not TCP. Confirm you created a **Minecraft Bedrock** tunnel in playit, not just a Java one.
2. Bedrock doesn't honor SRV records — players must manually enter the port (`19132`).
3. Make sure `floodgate-fabric.jar` actually installed in `server/mods/`. Check the Actions log.
4. `online-mode` **must** be `false` in `server.properties` for Floodgate to work. It is by default in this repo — don't change it.

### Status page shows offline but the server is actually running
1. mcsrvstat.us caches for ~1 min, status page caches at CF edge for 30s → wait a minute
2. Make sure `MC_HOST` in `workers/status/wrangler.toml` matches the actual public hostname
3. Hit `https://status.pakanonymous.org/api/status` directly to see the raw JSON

---

## Admin panel issues

### `https://admin.pakanonymous.org` redirects forever
- The session cookie's HMAC verification is failing. This happens if `SESSION_SECRET` changed between deploys.
- Fix: clear cookies for `admin.pakanonymous.org`, log in again.

### "403 Access Denied"
- You signed in with a Google account whose email doesn't match `ALLOWED_EMAIL` in `workers/admin/wrangler.toml`
- Double-check spelling. It's `malikmuhammadfarasatali@gmail.com`

### "Token exchange failed: redirect_uri_mismatch"
- Google OAuth is strict about redirect URIs
- Go to Google Cloud Console → Credentials → your OAuth client → add **both** redirect URIs:
  - `https://admin.pakanonymous.org/auth/callback`
  - `https://pak-mc-admin.YOUR-SUBDOMAIN.workers.dev/auth/callback`
- The URI must match **exactly** including the trailing path

### "Start Server" button fails with 401
- `GITHUB_PAT` Worker secret is missing or expired
- Run `wrangler secret put GITHUB_PAT` from `workers/admin/` and paste a fresh fine-grained PAT
- PAT must have **Actions: Read and write** permission on the `pak-mc-server` repo

### "Start Server" works but no workflow runs
- `GITHUB_OWNER` and `GITHUB_REPO` in `workers/admin/wrangler.toml` probably don't match your actual repo
- Double check they point at `<your-username>/pak-mc-server`

---

## Cloudflare Worker deployment

### `wrangler deploy` says "Zone not found"
- `pakanonymous.org` isn't on your Cloudflare account
- Either add the domain to Cloudflare first, or remove the `[[routes]]` block and use the `.workers.dev` default subdomain

### `wrangler deploy` says "Authentication error"
- `CLOUDFLARE_API_TOKEN` is missing or incorrect
- Create a new token with the **Edit Cloudflare Workers** template at dash.cloudflare.com/profile/api-tokens

---

## playit.gg agent

### Agent log says "Claim link: ..."
- You started playit without a secret, so it's running in guest mode waiting to be claimed
- Either visit the claim URL once to link it (temporary), or add `PLAYIT_SECRET_KEY` to GitHub secrets for permanent auto-connect

### Tunnels exist in dashboard but nothing is flowing
- The runner's outbound firewall in GitHub Actions is open by default
- Restart the workflow — sometimes playit takes a few seconds to establish the tunnel
- Check `playit-log-<run_number>.txt` artifact in the Actions run

---

## General tips

- The **Actions tab** on GitHub is the source of truth for what's happening. Watch the live logs there.
- Workflow runs cost GitHub free minutes only on **private** repos. Make the repo **public** to get unlimited runs.
- If you're hitting the 6-hour ceiling repeatedly, consider setting up a scheduled "start" workflow that runs every 6 hours — but be warned, this uses a lot of minutes on private repos.
