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

# Ensure config directories exist to prevent mod initialization crashes
mkdir -p ../config/floodgate ../config/geyser

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
rm -f fabric-api.jar
FABRIC_API_URL=$(get_modrinth_url "fabric-api" "$MC_VERSION" || true)
download "Fabric API" "$FABRIC_API_URL" "fabric-api.jar" || true

# ── 2. Geyser-Fabric (Bedrock Edition bridge) ─────────────────────────────────
rm -f geyser-fabric.jar
GEYSER_URL=$(get_modrinth_url "geyser" "$MC_VERSION" || true)
download "Geyser-Fabric" "$GEYSER_URL" "geyser-fabric.jar" || true

# ── 3. Floodgate-Fabric (Bedrock player authentication) ──────────────────────
rm -f floodgate-fabric.jar
FLOODGATE_URL=$(get_modrinth_url "floodgate" "$MC_VERSION" || true)
download "Floodgate-Fabric" "$FLOODGATE_URL" "floodgate-fabric.jar" || true

# ── 4. Cross-Version Support (Allows older clients to join) ──────────────────
rm -f via*.jar
# ViaFabric: The core implementation for Fabric
VIAFABRIC_URL=$(get_modrinth_url "viafabric" "$MC_VERSION" || true)
download "ViaFabric" "$VIAFABRIC_URL" "viafabric.jar" || true

# ViaVersion/ViaBackwards: Bridging plugins for older clients
VIAVERSION_URL=$(get_modrinth_url "viaversion" "$MC_VERSION" || true)
download "ViaVersion" "$VIAVERSION_URL" "viaversion.jar" || true

VIABACKWARDS_URL=$(get_modrinth_url "viabackwards" "$MC_VERSION" || true)
download "ViaBackwards" "$VIABACKWARDS_URL" "viabackwards.jar" || true

# ── 5. Simple Voice Chat (proximity voice) ───────────────────────────────────
rm -f voicechat.jar
VOICECHAT_URL=$(get_modrinth_url "simple-voice-chat" "$MC_VERSION" || true)
download "Simple Voice Chat" "$VOICECHAT_URL" "voicechat.jar" || true

# ── 6. Lithium (performance — highly recommended for small runners) ──────────
rm -f lithium.jar
LITHIUM_URL=$(get_modrinth_url "lithium" "$MC_VERSION" || true)
download "Lithium" "$LITHIUM_URL" "lithium.jar" || true

# ── 7. FerriteCore (memory usage optimization) ───────────────────────────────
rm -f ferrite-core.jar
FERRITE_URL=$(get_modrinth_url "ferrite-core" "$MC_VERSION" || true)
download "FerriteCore" "$FERRITE_URL" "ferrite-core.jar" || true

# ── 8. Krypton (network stack optimization) ──────────────────────────────────
rm -f krypton.jar
KRYPTON_URL=$(get_modrinth_url "krypton" "$MC_VERSION" || true)
download "Krypton" "$KRYPTON_URL" "krypton.jar" || true

# ── 9. Spark (profiling) ─────────────────────────────────────────────────────
rm -f spark.jar
SPARK_URL=$(get_modrinth_url "spark" "$MC_VERSION" || true)
download "Spark" "$SPARK_URL" "spark.jar" || true

# ── Cleanup ──────────────────────────────────────────────────────────────────
# CRITICAL: ViaFabric downloads "sub-jars" for older versions that cause crashes 
# on a 1.21.1 server. We MUST delete them.
rm -f viafabric-mc*.jar viafabricplus-*.jar

echo ""
echo "📋 Final mod list:"
ls -lh *.jar 2>/dev/null || echo "  (none)"
echo ""
echo "✅ Mod installation complete"
