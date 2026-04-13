#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PAK MC SERVER — Server mod installer
# Downloads all server-side mods needed for cross-version + Bedrock support.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

MC_VERSION="${MC_VERSION:-1.21.1}"
MODS_DIR="$(cd "$(dirname "$0")/.." && pwd)/server/mods"

mkdir -p "$MODS_DIR"
cd "$MODS_DIR"

echo "📦 Installing PAK MC SERVER mods for Minecraft $MC_VERSION"
echo "    Target directory: $MODS_DIR"
echo ""

# ── Helper: fetch latest Fabric-compatible version from Modrinth ──────────────
get_modrinth_url() {
  local slug="$1"
  local mc="$2"
  local loader="${3:-fabric}"

  curl -sSL "https://api.modrinth.com/v2/project/${slug}/version?loaders=%5B%22${loader}%22%5D&game_versions=%5B%22${mc}%22%5D" \
    | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if data and len(data) > 0:
        print(data[0]['files'][0]['url'])
    else:
        sys.exit(1)
except Exception as e:
    sys.exit(1)
"
}

download() {
  local name="$1"
  local url="$2"
  local filename="$3"

  if [ -z "$url" ]; then
    echo "  ⚠️  $name — no URL (skipped)"
    return 1
  fi

  echo "  → $name"
  if curl -fsSL "$url" -o "$filename"; then
    echo "     ✅ $(du -h "$filename" | cut -f1) → $filename"
  else
    echo "     ❌ download failed for $name"
    rm -f "$filename"
    return 1
  fi
}

# ── 1. Fabric API (required by nearly all Fabric mods) ───────────────────────
FABRIC_API_URL=$(get_modrinth_url "fabric-api" "$MC_VERSION" || true)
download "Fabric API" "$FABRIC_API_URL" "fabric-api.jar" || true

# ── 2. Geyser-Fabric (Bedrock Edition bridge) ─────────────────────────────────
echo "  → Geyser-Fabric"
if curl -fsSL "https://download.geysermc.org/v2/projects/geyser/versions/latest/builds/latest/downloads/fabric" \
     -o "geyser-fabric.jar"; then
  echo "     ✅ $(du -h geyser-fabric.jar | cut -f1) → geyser-fabric.jar"
else
  echo "     ❌ Geyser download failed"
fi

# ── 3. Floodgate-Fabric (Bedrock player authentication) ──────────────────────
echo "  → Floodgate-Fabric"
if curl -fsSL "https://download.geysermc.org/v2/projects/floodgate/versions/latest/builds/latest/downloads/fabric" \
     -o "floodgate-fabric.jar"; then
  echo "     ✅ $(du -h floodgate-fabric.jar | cut -f1) → floodgate-fabric.jar"
else
  echo "     ❌ Floodgate download failed"
fi

# ── 4. ViaFabric (lets any Java version 1.8+ join) ───────────────────────────
VIAFABRIC_URL=$(get_modrinth_url "viafabric" "$MC_VERSION" || true)
download "ViaFabric" "$VIAFABRIC_URL" "viafabric.jar" || true

# ── 5. ViaFabricPlus (optional — enhances ViaFabric for older clients) ───────
VIAFABRICPLUS_URL=$(get_modrinth_url "viafabricplus" "$MC_VERSION" || true)
download "ViaFabricPlus" "$VIAFABRICPLUS_URL" "viafabricplus.jar" || true

# ── 6. Simple Voice Chat (proximity voice) ───────────────────────────────────
VOICECHAT_URL=$(get_modrinth_url "simple-voice-chat" "$MC_VERSION" || true)
download "Simple Voice Chat" "$VOICECHAT_URL" "voicechat.jar" || true

# ── 7. Lithium (performance — highly recommended for small runners) ──────────
LITHIUM_URL=$(get_modrinth_url "lithium" "$MC_VERSION" || true)
download "Lithium" "$LITHIUM_URL" "lithium.jar" || true

# ── 8. FerriteCore (memory usage optimization) ───────────────────────────────
FERRITE_URL=$(get_modrinth_url "ferrite-core" "$MC_VERSION" || true)
download "FerriteCore" "$FERRITE_URL" "ferrite-core.jar" || true

# ── 9. Krypton (network stack optimization) ──────────────────────────────────
KRYPTON_URL=$(get_modrinth_url "krypton" "$MC_VERSION" || true)
download "Krypton" "$KRYPTON_URL" "krypton.jar" || true

# ── 10. Spark (profiling — useful for server admin) ──────────────────────────
SPARK_URL=$(get_modrinth_url "spark" "$MC_VERSION" || true)
download "Spark" "$SPARK_URL" "spark.jar" || true

echo ""
echo "📋 Final mod list:"
ls -lh *.jar 2>/dev/null || echo "  (none)"
echo ""
echo "✅ Mod installation complete"
