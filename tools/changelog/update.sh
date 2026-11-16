#!/usr/bin/env bash
# Rebuilds "R62D Change History.docx" in his Documents folder (he asked 2026-11-16: kept up to date by itself).
# Run after every commit (.git/hooks/post-commit) and by play.sh when the game opens (--if-old: only if something
# changed since the last build, or it is a day old). Uses no tokens: just Node and tools/changelog/make.cjs.
set -u
cd "$(dirname "$(readlink -f "$0")")/../.."
OWNER=$(stat -c %U .)
if [ "$(id -u)" = 0 ] && [ "$OWNER" != root ]; then exec runuser -u "$OWNER" -- env -u XDG_DATA_HOME HOME="$(getent passwd "$OWNER" | cut -d: -f6)" bash "$PWD/tools/changelog/update.sh" "$@"; fi # never as root: the file is his
SHARE="${XDG_DATA_HOME:-$HOME/.local/share}/r62d"; TOOLS="$SHARE/tools"; mkdir -p "$TOOLS"
OUT="${R62D_DOC:-$HOME/Documents/R62D Change History.docx}"; mkdir -p "$(dirname "$OUT")"
HEAD=$(git rev-parse HEAD 2>/dev/null)
if [ "${1:-}" = "--if-old" ] && [ -f "$OUT" ] && [ "$(cat "$TOOLS/changelog.head" 2>/dev/null)" = "$HEAD" ] && [ -z "$(find "$OUT" -mmin +1440)" ]; then exit 0; fi
exec 9> "$TOOLS/changelog.lock"; flock -n 9 || exit 0 # one build at a time
job='[ -d "'"$TOOLS"'/node_modules/docx" ] || (cd "'"$TOOLS"'" && npm install --no-audit --no-fund --silent docx@9.5.1 > /dev/null 2>&1); NODE_PATH="'"$TOOLS"'/node_modules" node tools/changelog/make.cjs "'"$OUT"'"'
node_ok() { [ "$(node -p 'parseInt(process.versions.node)' 2>/dev/null || echo 0)" -ge 22 ] && command -v npm > /dev/null; }
NIXF=(--extra-experimental-features "nix-command flakes")
{ node_ok && bash -c "$job"; } ||
  { [ -e "$HOME/nixos-config/flake.nix" ] && nix "${NIXF[@]}" develop "$HOME/nixos-config#vibe-web" --command bash -c "$job"; } ||
  { command -v nix > /dev/null && nix "${NIXF[@]}" shell nixpkgs#nodejs_22 --command bash -c "$job"; } ||
  { echo "change history: could not build (needs Node 22+ or Nix)" >&2; exit 1; }
echo "$HEAD" > "$TOOLS/changelog.head"
