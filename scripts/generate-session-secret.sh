#!/usr/bin/env bash
# Generate a cryptographically-random secret for SESSION_SECRET
# and copy it to the clipboard if possible.

set -e

SECRET=$(openssl rand -hex 32)
echo "SESSION_SECRET=$SECRET"

if command -v clip.exe > /dev/null; then
  echo -n "$SECRET" | clip.exe
  echo "(copied to clipboard)"
elif command -v pbcopy > /dev/null; then
  echo -n "$SECRET" | pbcopy
  echo "(copied to clipboard)"
elif command -v xclip > /dev/null; then
  echo -n "$SECRET" | xclip -selection clipboard
  echo "(copied to clipboard)"
fi

echo ""
echo "Use this with: wrangler secret put SESSION_SECRET"
