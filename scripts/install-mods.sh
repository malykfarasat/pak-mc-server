#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PAK MC SERVER — Server mod installer
# Standardized for Root directory execution and ViaFabricPlus consolidation.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

MC_VERSION="${MC_VERSION:-1.21.1}"
MODS_DIR="$(cd "$(dirname "$0")/.." && pwd)/mods"

mkdir -p "$MODS_DIR"
cd "$MODS_DIR"

echo "📦 Installing PAK MC SERVER mods for Minecraft $MC_VERSION (Root Mode)"
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
except Exception:
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

# ── 1. Fabric API (required) ─────────────────────────────────────────────────
rm -f fabric-api.jar
FABRIC_API_URL=$(get_modrinth_url "fabric-api" "$MC_VERSION" || true)
download "Fabric API" "$FABRIC_API_URL" "fabric-api.jar" || true

# ── 2. Geyser-Fabric (Bedrock Bridge) ────────────────────────────────────────
rm -f geyser-fabric.jar
GEYSER_URL=$(get_modrinth_url "geyser" "$MC_VERSION" || true)
download "Geyser-Fabric" "$GEYSER_URL" "geyser-fabric.jar" || true

# ── 3. Floodgate-Fabric (Bedrock Auth) ───────────────────────────────────────
rm -f floodgate-fabric.jar
FLOODGATE_URL=$(get_modrinth_url "floodgate" "$MC_VERSION" || true)
download "Floodgate-Fabric" "$FLOODGATE_URL" "floodgate-fabric.jar" || true

# ── 4. ViaFabricPlus (All-in-one Cross-version support) ──────────────────────
# Note: This replaces ViaVersion, ViaBackwards, and ViaFabric.
rm -f via*.jar
VIA_PLUS_URL=$(get_modrinth_url "viafabricplus" "$MC_VERSION" || true)
download "ViaFabricPlus" "$VIA_PLUS_URL" "viafabricplus.jar" || true

# ── 5. Simple Voice Chat ─────────────────────────────────────────────────────
rm -f voicechat.jar
VOICECHAT_URL=$(get_modrinth_url "simple-voice-chat" "$MC_VERSION" || true)
download "Simple Voice Chat" "$VOICECHAT_URL" "voicechat.jar" || true

# ── 6. Performance & Optimization ────────────────────────────────────────────
rm -f lithium.jar ferrite-core.jar krypton.jar
LITHIUM_URL=$(get_modrinth_url "lithium" "$MC_VERSION" || true)
download "Lithium" "$LITHIUM_URL" "lithium.jar" || true

FERRITE_URL=$(get_modrinth_url "ferrite-core" "$MC_VERSION" || true)
download "FerriteCore" "$FERRITE_URL" "ferrite-core.jar" || true

KRYPTON_URL=$(get_modrinth_url "krypton" "$MC_VERSION" || true)
download "Krypton" "$KRYPTON_URL" "krypton.jar" || true

# ── 7. Spark (Diagnostic) ────────────────────────────────────────────────────
rm -f spark.jar
SPARK_URL=$(get_modrinth_url "spark" "$MC_VERSION" || true)
download "Spark" "$SPARK_URL" "spark.jar" || true

# ── Cleanup ──────────────────────────────────────────────────────────────────
rm -f viafabric-mc*.jar viafabricplus-*.jar

echo ""
echo "📋 Final mod list:"
ls -lh *.jar 2>/dev/null || echo "  (none)"
echo ""
echo "✅ Mod installation complete"
