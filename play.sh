#!/usr/bin/env bash
# Starts the R62D game server (if it isn't running yet) and opens the game in Firefox.
cd "$(dirname "$(readlink -f "$0")")"
up() { (exec 3<>/dev/tcp/127.0.0.1/6262) 2>/dev/null; }
if ! up; then
  nohup nix develop /home/insideabush/nixos-config#vibe-web --command node server/server.js > /tmp/r62d-server.log 2>&1 &
  for i in $(seq 1 90); do up && break; sleep 1; done
fi
exec firefox --new-window http://localhost:6262/
