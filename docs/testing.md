# Testing R62D

## Headless rules test
`nix develop /home/insideabush/nixos-config#vibe-web --command node tests/sim.js`
Plays 10 bots through a full match (25 sim-minutes max). Prints each round's winner and PASS.
`--map` prints the map as ASCII (`=` soft wall, `#` hard, `O` door/window, `T` tall prop, `l` low prop).

## Screenshots in a real browser
1. Start the server in quick mode: `R62D_FAST=1 node server/server.js` (in the dev shell, background).
2. Firefox must run **as insideabush**, never root, with a profile dir he can read
   (e.g. `runuser -u insideabush -- mktemp -d /tmp/r62d-ff.XXXX`):
   `runuser -u insideabush -- firefox --headless --no-remote --profile <dir> --remote-debugging-port 9333 &`
3. `node tests/shoot.mjs 9333 <outdir> <steps.json>` — steps are
   `{"url":..}`, `{"js": "...", "wait": ms, "shot": "name"}`. Keys/mouse are simulated by
   dispatching `KeyboardEvent` on `window` and `MouseEvent` on `#game`. A Firefox instance only
   allows one BiDi session, so restart Firefox for each run.
- Shortcut for this app lives in ~/.local/share/applications/r62d.desktop and ~/Desktop/R62D.desktop, both running play.sh (starts server if needed, opens Firefox).
