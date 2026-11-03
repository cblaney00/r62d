#!/usr/bin/env bash
# Opens the build progress window on his desktop (temporary, see server.js).
cd "$(dirname "$(readlink -f "$0")")"
(exec 3<>/dev/tcp/127.0.0.1/6263) 2>/dev/null || { nohup nix develop /home/insideabush/nixos-config#vibe-web --command node server.js > /dev/null 2>&1 & sleep 4; }
P="$HOME/.local/share/r62d/firefox-progress"; mkdir -p "$P"
pgrep -f "r62d/firefox-progress" > /dev/null && exit 0
nohup firefox --new-instance --profile "$P" --width 620 --height 860 "http://127.0.0.1:6263" > "$HOME/.local/share/r62d/progress-window.log" 2>&1 &
