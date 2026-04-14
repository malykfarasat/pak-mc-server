#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOCK_FILE="${LOCK_FILE:-$ROOT_DIR/config/mods.lock.json}"
MODS_DIR="$ROOT_DIR/mods"
TMP_DIR="$ROOT_DIR/.tmp-mod-downloads"

mkdir -p "$MODS_DIR" "$TMP_DIR"

echo "Installing locked mods from: $LOCK_FILE"

if [ ! -f "$LOCK_FILE" ]; then
  echo "ERROR: lock file not found: $LOCK_FILE"
  exit 1
fi

python3 - <<'PY' "$LOCK_FILE" "$TMP_DIR" "$MODS_DIR"
import hashlib
import json
import os
import shutil
import sys
import urllib.error
import urllib.request

lock_file, tmp_dir, mods_dir = sys.argv[1], sys.argv[2], sys.argv[3]

with open(lock_file, "r", encoding="utf-8") as f:
    lock = json.load(f)

mods = lock.get("mods", [])
if not mods:
    raise SystemExit("ERROR: lock file has no mods")

def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

for mod in mods:
    name = mod["name"]
    output = mod["output"]
    urls = mod.get("urls", [])
    expected_sha = (mod.get("sha256") or "").strip().lower()

    if not urls:
        raise SystemExit(f"ERROR: no URLs configured for {name}")

    target = os.path.join(mods_dir, output)
    temp_target = os.path.join(tmp_dir, output)
    downloaded = False
    last_error = ""

    print(f"-> {name}")
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "pak-mc-server-installer/1.0"})
            with urllib.request.urlopen(req, timeout=90) as r, open(temp_target, "wb") as out:
                shutil.copyfileobj(r, out)
            downloaded = True
            print(f"   downloaded from {url}")
            break
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as e:
            last_error = str(e)
            print(f"   failed {url}: {e}")

    if not downloaded:
        raise SystemExit(f"ERROR: could not download {name}. Last error: {last_error}")

    actual_sha = sha256_of(temp_target)
    if expected_sha and expected_sha != actual_sha:
        raise SystemExit(
            f"ERROR: checksum mismatch for {name}. expected={expected_sha} actual={actual_sha}"
        )

    shutil.move(temp_target, target)
    print(f"   ok -> {target} sha256={actual_sha[:16]}...")

print("Locked mod installation complete.")
PY

rm -rf "$TMP_DIR"
rm -f "$ROOT_DIR/Geyser.jar"

echo ""
echo "Final mods:"
ls -lh "$MODS_DIR"/*.jar
