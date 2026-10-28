# R62D

*Created by the `vibe` command. Keep the two sections below current as the app grows —
a future session starts by reading them.*

> **The rules for working here are in `../CLAUDE.md`** (one directory up, alongside the
> other apps). They are loaded automatically; if for any reason they are not in your
> context, read that file before doing anything else.

## What this app is

A top-down 2D tactical shooter in the browser for insideabush and up to 9 friends (10
players max, 5v5), played over a VPN to a machine running the server. He wants it to feel
instantly familiar to people who play Rainbow Six Siege — the same round flow, breaching,
reinforcing, droning, cameras, defuser objective, downed-but-not-out — **but everything
must be original**: our own operators, names, map, art. We declined to copy Siege's
operators/maps/art (it would be recreating a specific existing game); keep it that way.

His wishes so far:
- One small map to start (Harbor Office), 10 operators (5 attack, 5 defence), Quick Match only
  (first to 3 rounds, sides swap every round).
- Out of sight = dull grey "remembered" map; shared team vision (teammates, drones, cameras) is live colour; enemy changes out of sight stay hidden until seen (`st.known` vs `st.map` in main.js).
- FOV like a modern FPS (103°, 70° ADS). Zoom adapts: close indoors, wide outside / long sightlines.
- Abilities all work; no verticality.
- Graphics detailed enough to interest people used to modern games; fills a fullscreen
  16:9 monitor; must not lag; it's a multi-day project.
- Setting/art direction (chosen by us, he can change it): modern counter-terror unit,
  crisp detailed top-down style. Your team is blue, enemies orange.

## How it is built

- **Language:** JavaScript. Node 22 server (no npm packages at all — a tiny hand-written
  WebSocket server in `server/ws.js`) + plain browser JavaScript with Canvas 2D.
  Dev shell: `vibe-web` (see `.vibe-project`, `.envrc`).
- **Run:** his desktop shortcut runs `play.sh` (starts the server if not running, opens Firefox). Manually: `nix develop /home/insideabush/nixos-config#vibe-web --command node server/server.js`
  then open `http://localhost:6262`. Friends use `http://<this machine's VPN IP>:6262`.
  `R62D_FAST=1` shortens operator-select and prep to a few seconds for testing. `PORT=` changes port.
- **Layout:**
  - `shared/` — used by both server and browser: `constants.js` (tiles, timings),
    `map.js` (the map, built from room/wall/door/furniture calls; run `node tests/sim.js --map`
    for an ASCII view), `physics.js` (movement, collision, line of sight, ray casting),
    `operators.js` (weapons + the 10 operators).
  - `server/game.js` — authoritative match: lobby, rounds/phases, shooting (hitscan,
    soft walls penetrate & break), gadgets, explosions, defuser, downed state, snapshots.
    `server/bots.js` — bots (A* pathing, fighting, plant/defuse, site fortifying).
  - `public/` — `index.html`, `style.css`, `js/main.js` (network, prediction of your own
    movement, camera, vision blackout, HUD, menus), `js/mapdraw.js` (map pre-rendered to a
    big off-screen canvas with procedural textures; only changed cells are redrawn),
    `js/textures.js`, `js/sprites.js` (operators/gadgets drawn in code), `js/fx.js`
    (particles/explosions/smoke), `js/audio.js` (all sounds synthesised, no files).
- **Networking:** server ticks at 30/s, sends a JSON snapshot to everyone 20/s. Clients send
  input every frame; server applies movement per input message (with its dt) and echoes the
  last sequence number, client replays unacknowledged inputs (prediction + reconciliation).
  Other players are interpolated 100 ms behind.
- **Tests:** `node tests/sim.js` plays a whole bot-only match headless (must print PASS).
  `tests/shoot.mjs` drives a hidden Firefox (run as insideabush, via WebDriver BiDi,
  `--remote-debugging-port`) to take screenshots; see `docs/testing.md`.
- **Status:** first playable version — all 10 operators, gadgets, drones, cameras, reinforcement,
  barricades, destruction, defuser, DBNO, bots, lobby, operator select, HUD, scoreboard.
  **His idea list is `r6-todo.md` — work through it top to bottom, tick items off, keep going.**
  Other ideas are in `docs/roadmap.md`. Sound mix notes: `docs/sound.md`.
- **Menus/presentation:** title screen (`#splash`, first click starts audio), menu music is composed live in `public/js/music.js`, levels/XP in `shared/progress.js` (awarded in `store.recordMatch`, sent to players as an `xp` message), end screen in `showEnd`/`playXp` (main.js). `window.__r62d` is a hook for screenshot tests (`st.forceEnd` shows the end screen).
- **Saved data:** `server/store.js` keeps `data/profiles.json` and `data/matches.json` (gitignored; on the machine running the server). Browsers keep a secret login token in localStorage (`r62d-token`). `/api/profile`, `/api/match`, `/api/players` feed the Profile page. Loadouts per operator live in `shared/operators.js` (`LOADOUTS`).
