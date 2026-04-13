#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PAK MC SERVER — Cloudflare DNS bootstrap
# Creates the DNS records needed for mc.pakanonymous.org on Cloudflare.
#
# Requires env vars:
#   CF_API_TOKEN   — Cloudflare API token with Zone:Edit permission
#   CF_ZONE_NAME   — defaults to "pakanonymous.org"
#   MC_TARGET      — the playit.gg tunnel hostname (e.g. "abc123.joinmc.link")
#   MC_BEDROCK_IP  — A record target for Bedrock (playit IP)
#   MC_BEDROCK_PORT — Bedrock port from playit (default 19132)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

: "${CF_API_TOKEN:?Need CF_API_TOKEN}"
CF_ZONE_NAME="${CF_ZONE_NAME:-pakanonymous.org}"
MC_TARGET="${MC_TARGET:-}"
MC_BEDROCK_IP="${MC_BEDROCK_IP:-}"
MC_BEDROCK_PORT="${MC_BEDROCK_PORT:-19132}"

CF_API="https://api.cloudflare.com/client/v4"
AUTH="Authorization: Bearer $CF_API_TOKEN"

echo "🔎 Looking up zone ID for $CF_ZONE_NAME..."
ZONE_ID=$(curl -fsSL -H "$AUTH" "$CF_API/zones?name=$CF_ZONE_NAME" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id']) if d.get('result') else sys.exit(1)")

echo "   Zone ID: $ZONE_ID"

# Helper: upsert a DNS record
upsert_record() {
  local type="$1"
  local name="$2"
  local content="$3"
  local ttl="${4:-1}"
  local proxied="${5:-false}"
  local extra_json="${6:-}"

  echo "📝 Upserting $type record: $name → $content"

  # Check if record already exists
  local existing
  existing=$(curl -fsSL -H "$AUTH" \
    "$CF_API/zones/$ZONE_ID/dns_records?type=$type&name=$name" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result'][0]['id']) if d.get('result') else print('')")

  local body
  body=$(python3 -c "
import json, os
r = {
    'type': os.environ['TYPE'],
    'name': os.environ['NAME'],
    'content': os.environ['CONTENT'],
    'ttl': int(os.environ['TTL']),
    'proxied': os.environ['PROXIED'] == 'true',
}
extra = os.environ.get('EXTRA_JSON', '').strip()
if extra:
    r.update(json.loads(extra))
print(json.dumps(r))
" TYPE="$type" NAME="$name" CONTENT="$content" TTL="$ttl" PROXIED="$proxied" EXTRA_JSON="$extra_json")

  if [ -n "$existing" ]; then
    curl -fsSL -X PUT \
      -H "$AUTH" -H "Content-Type: application/json" \
      -d "$body" \
      "$CF_API/zones/$ZONE_ID/dns_records/$existing" > /dev/null
    echo "   ✅ updated existing record"
  else
    curl -fsSL -X POST \
      -H "$AUTH" -H "Content-Type: application/json" \
      -d "$body" \
      "$CF_API/zones/$ZONE_ID/dns_records" > /dev/null
    echo "   ✅ created new record"
  fi
}

# ── 1. Java edition — CNAME from mc.pakanonymous.org to playit tunnel ────────
if [ -n "$MC_TARGET" ]; then
  upsert_record "CNAME" "mc.$CF_ZONE_NAME" "$MC_TARGET" 1 false
  echo ""
  echo "ℹ️  NOTE: Minecraft Java Edition can use SRV records for custom ports."
  echo "   If your playit tunnel uses a non-default port, you'll also want"
  echo "   to create an SRV record pointing _minecraft._tcp.mc to it."
else
  echo "⏭️  Skipping Java CNAME (MC_TARGET not set)"
fi

# ── 2. Bedrock edition — A record (Bedrock doesn't support SRV) ──────────────
if [ -n "$MC_BEDROCK_IP" ]; then
  upsert_record "A" "mc.$CF_ZONE_NAME" "$MC_BEDROCK_IP" 1 false
  echo ""
  echo "ℹ️  Bedrock players will connect with port $MC_BEDROCK_PORT"
fi

# ── 3. Wait for workers.dev subdomain to propagate ───────────────────────────
echo ""
echo "✅ DNS setup complete"
echo ""
echo "Next steps:"
echo "   1. Deploy workers:    cd workers/status && wrangler deploy"
echo "                         cd workers/admin  && wrangler deploy"
echo "   2. Add custom domains in wrangler.toml (uncomment [[routes]])"
echo "   3. Re-deploy to bind  status.$CF_ZONE_NAME and admin.$CF_ZONE_NAME"
