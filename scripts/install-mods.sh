#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# PAK MC SERVER — Server mod installer
# Standardized for Root directory execution and Geyser-Standalone Bridge.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

MC_VERSION="${MC_VERSION:-1.21.1}"
MODS_DIR="$(cd "$(dirname "$0")/.." && pwd)/mods"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$MODS_DIR"

echo "📦 Installing PAK MC SERVER mods for Minecraft $MC_VERSION"
echo "    Target directory: $MODS_DIR"

# Ensure basic config directories exist
mkdir -p "$ROOT_DIR/config"

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
  local dest="${4:-$MODS_DIR}"

  if [ -z "$url" ]; then
    echo "  ⚠️  $name — no URL (skipped)"
    return 1
  fi

  echo "  → $name"
  if curl -fsSL "$url" -o "$dest/$filename"; then
    echo "     ✅ $(du -h "$dest/$filename" | cut -f1) → $filename"
  else
    echo "     ❌ download failed for $name"
    rm -f "$dest/$filename"
    return 1
  fi
}

# ── 1. Fabric API (required) ─────────────────────────────────────────────────
download "Fabric API" "$(get_modrinth_url "fabric-api" "$MC_VERSION")" "fabric-api.jar"

# ── 2. Bedrock bridge mods (Fabric-native) ───────────────────────────────────
download "Geyser Fabric" "$(get_modrinth_url "geyser" "$MC_VERSION")" "geyser-fabric.jar"
download "Floodgate Fabric" "$(get_modrinth_url "floodgate" "$MC_VERSION")" "floodgate-fabric.jar"

# ── 3. ViaFabricPlus (Cross-version support) ─────────────────────────────────
download "ViaFabricPlus" "$(get_modrinth_url "viafabricplus" "$MC_VERSION")" "viafabricplus.jar"

# ── 4. Simple Voice Chat ─────────────────────────────────────────────────────
download "Simple Voice Chat" "$(get_modrinth_url "simple-voice-chat" "$MC_VERSION")" "voicechat.jar"

# ── 5. Performance Mods ──────────────────────────────────────────────────────
download "Lithium" "$(get_modrinth_url "lithium" "$MC_VERSION")" "lithium.jar"
download "FerriteCore" "$(get_modrinth_url "ferrite-core" "$MC_VERSION")" "ferrite-core.jar"
download "Krypton" "$(get_modrinth_url "krypton" "$MC_VERSION")" "krypton.jar"

# ── 6. Spark (Diagnostic) ────────────────────────────────────────────────────
download "Spark" "$(get_modrinth_url "spark" "$MC_VERSION")" "spark.jar"

# ── Cleanup ──────────────────────────────────────────────────────────────────
cd "$MODS_DIR"
rm -f viafabric.jar viaversion.jar viabackwards.jar
rm -f viafabric-mc*.jar viafabricplus-*.jar

# Remove old standalone bridge artifact when migrating to Fabric-native bridge.
rm -f "$ROOT_DIR/Geyser.jar"

echo ""
echo "📋 Final mod list:"
ls -lh *.jar 2>/dev/null || echo "  (none)"
echo ""
echo "✅ Mod installation complete"
