# ★ PAK MC SERVER

**Free Minecraft hosting for Java + Bedrock players** — powered by GitHub Actions and Cloudflare Workers.

- ☕ **Java Edition** (all versions 1.8+ via ViaVersion)
- 🎮 **Bedrock Edition** (Xbox, PlayStation, Switch, Mobile, Windows 10) via Geyser + Floodgate
- 🌐 **Custom domain**: `mc.pakanonymous.org`
- 📊 **Status page**: `status.pakanonymous.org`
- 🔒 **Admin panel**: `admin.pakanonymous.org` (Google login, locked to one email)
- 🎙️ **Voice chat** via Simple Voice Chat mod
- 💾 **Persistent world** across sessions (GitHub Actions cache + artifacts)

---

## Project layout

```
pak-mc-server/
│
├── .github/workflows/
│   ├── minecraft.yml           ▸ Runs the Minecraft server
│   ├── stop-server.yml         ▸ Stops any running server
│   └── deploy-workers.yml      ▸ Deploys Cloudflare Workers on push
│
├── server/
│   ├── server.properties       ▸ Server config (online-mode=false for Floodgate)
│   ├── ops.json                ▸ Server operators
│   ├── whitelist.json          ▸ Player whitelist
│   ├── config/
│   │   ├── geyser/config.yml   ▸ Bedrock bridge config
│   │   └── floodgate/config.yml▸ Bedrock auth config
│   └── mods/                   ▸ Mods (auto-installed by script)
│
├── workers/
│   ├── status/                 ▸ Public status page
│   │   ├── src/index.js
│   │   ├── wrangler.toml
│   │   └── package.json
│   └── admin/                  ▸ Admin panel with Google OAuth
│       ├── src/
│       │   ├── index.js        ▸ Router
│       │   ├── auth.js         ▸ Google OAuth + signed sessions
│       │   ├── github.js       ▸ GitHub API client
│       │   └── templates.js    ▸ HTML views
│       ├── wrangler.toml
│       └── package.json
│
├── scripts/
│   ├── install-mods.sh             ▸ Downloads all server mods
│   ├── setup-cloudflare-dns.sh     ▸ Creates DNS records via CF API
│   └── generate-session-secret.sh  ▸ Makes a random SESSION_SECRET
│
├── docs/
│   ├── SETUP.md                ▸ Step-by-step setup walkthrough
│   ├── ARCHITECTURE.md         ▸ How the pieces fit together
│   └── TROUBLESHOOTING.md      ▸ Common issues and fixes
│
├── README.md
└── .gitignore
```

---

## Quick start

See [`docs/SETUP.md`](docs/SETUP.md) for the full walkthrough.

Short version:

1. **Push this project to a GitHub repo** named `pak-mc-server`
2. **Create a [playit.gg](https://playit.gg) account** → make a Minecraft tunnel → copy the agent secret
3. **Create a Google OAuth client** at [console.cloud.google.com](https://console.cloud.google.com)
4. **Add secrets** to your GitHub repo → Settings → Secrets → Actions:
   - `PLAYIT_SECRET_KEY`
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SESSION_SECRET`  *(run `scripts/generate-session-secret.sh`)*
   - `GH_DISPATCH_TOKEN` *(fine-grained PAT with actions:write)*
5. **Deploy Cloudflare Workers** — push to `main`, the deploy-workers workflow takes care of it
6. **Go to `admin.pakanonymous.org`**, log in with `malikmuhammadfarasatali@gmail.com`, click **Start Server**

---

## How players connect

| Platform | Address |
|---|---|
| Java Edition (any version 1.8+) | `mc.pakanonymous.org` |
| Bedrock Edition (Xbox, PS, Switch, Mobile, Win10) | `mc.pakanonymous.org` port `19132` |

---

## Tech stack

| Layer | Technology |
|---|---|
| Compute | GitHub Actions (ubuntu-latest, 7GB RAM, 6h max) |
| Minecraft core | Fabric 1.21.1 + Fabric API |
| Bedrock bridge | Geyser-Fabric + Floodgate |
| Multi-version | ViaFabric + ViaFabricPlus |
| Performance | Lithium + FerriteCore + Krypton |
| Tunneling | playit.gg agent (TCP 25565 + UDP 19132) |
| DNS + edge | Cloudflare |
| Status page | Cloudflare Worker (mcsrvstat.us backend) |
| Admin panel | Cloudflare Worker + Google OAuth 2.0 |
| Session auth | HMAC-SHA256 signed cookies |
| World persistence | GitHub Actions cache + artifacts |

---

**⚠️ Important:** `online-mode=false` is set in `server.properties`. This is **required** for Floodgate (Bedrock players) to work and also allows TLauncher/cracked Java accounts. For a Mojang-account-only server, also change the Floodgate config.
