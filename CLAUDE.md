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
- Six maps, each with 2–3 floors, picked in the lobby (Harbor Office, Cliffside Villa, Rail Depot, The Embassy,
  Alpine Lodge, Clocktower School). 30 operators (15 attack, 15 defence; he chose 15 each), covering R6's role types with our own names and twists.
  Quick Match only (first to 3 rounds, sides swap every round). Defenders choose the site during operator select.
- Out of sight = dull grey "remembered" map; shared team vision (teammates, drones, cameras) is live colour; enemy changes out of sight stay hidden until seen (`st.known` vs `st.map` in main.js).
- Controls are CS2-style (players come from CS2): run default, Shift walk, Ctrl crouch (hold), E use, Q skill, 3 melee, 4 gadget. Walking/crouching are silent to others. Running spreads shots (server `fire`). Mouse is pointer-locked in matches with sensitivity + ADS multiplier settings.
- Aiming defaults to the **aim pad** (he asked for it): a ring on the right of the screen (`pad()` in main.js) acts like a joystick — the mouse is kept inside it and its direction from the centre sets the aim, its distance how far ahead the crosshair sits (`cursor()`), so turning round is a short flick. Settings → Aiming → "Cursor" brings back aim-at-the-cursor; saved per profile (`aim`).
- Builds follow armor (`BODY_W`/`HIT_R` in shared/operators.js): heavies broad, mediums and lights skinnier. Bullets hit within `hitR(op)` (7.5 / 6.8 / 6.2 px), smaller than the bumping radius `PLAYER_R` 10, so people are harder to hit. He asked for this.
- Movement uses real-world speeds (`M_S` in shared/physics.js, 1 m = 36 px = `PX_PER_M`): jog 2.6 m/s (2.3 heavy, 3.0 light), walk 1.4, ADS 1.5, crouch 0.9, downed crawl 0.5, drone 3.2. He asked for everything slower and realistic.
- FOV like a modern FPS (103°, 70° ADS). Zoom adapts: close indoors, wider outside / long sightlines (`want` in the main.js camera: 240–470 world px tall indoors, up to 520 down a sightline; he asked twice for closer).
- Abilities all work. Floors are joined by stairs only (no shooting or seeing between floors yet; no hatches).
- Graphics detailed enough to interest people used to modern games; fills a fullscreen
  16:9 monitor; must not lag; it's a multi-day project.
- Setting/art direction (chosen by us, he can change it): modern counter-terror unit,
  crisp detailed top-down style. Your team is blue, enemies orange.

## How it is built

- **Language:** JavaScript. Node 22 server (no npm packages at all — a tiny hand-written
  WebSocket server in `server/ws.js`) + plain browser JavaScript with Canvas 2D.
  Dev shell: `vibe-web` (see `.vibe-project`, `.envrc`).
- **Run:** his desktop shortcut runs `play.sh` (starts the server if not running, opens Firefox in kiosk mode with its own profile at ~/.local/share/r62d/firefox-kiosk, URL `?app=1`; "Quit to desktop" calls `/api/quit`, localhost only, which pkills that window). Manually: `nix develop /home/insideabush/nixos-config#vibe-web --command node server/server.js`
  then open `http://localhost:6262`. Friends use `http://<this machine's VPN IP>:6262`.
  `R62D_FAST=1` shortens operator-select and prep to a few seconds for testing. `PORT=` changes port.
- **Layout:**
  - `shared/` — used by both server and browser: `constants.js` (tiles, timings),
    `map.js` (list of maps + floorAt/localPos/roomAt), `mapkit.js` (map building kit: floors sit side by
    side in ONE grid separated by void, joined by stairs — `map.portal` sends you to the other floor when you
    walk off a staircase's end; maps are written in a shared building frame so floors line up),
    `maps/*.js` (one file per map; `node tests/sim.js --map <id>` prints every floor as ASCII). Map rules
    learned the hard way: doors at least 2 cells wide, 2 free rows beyond both ends of every staircase. A body is
    `PLAYER_R` 7 (he asked that people fit everywhere; at 10 a body couldn't pass 1-cell gaps beside bookcases), so a
    1-cell gap is a squeeze bots also take. `node tests/reach.js` must print 0 unreachable cells on every map.
    Drone holes (`map.dhole`): `mapkit.js droneHoles()` puts one in the middle of each plain wall two rooms share
    (`K.droneHole(x, y)` adds one by hand); drones (radius 3.5) pass, people don't, reinforcing the wall closes it. `physics.js` (movement, collision, line of sight, ray casting),
    `operators.js` (weapons + the 10 operators).
  - `server/game.js` — authoritative match: lobby, rounds/phases, shooting (hitscan,
    bullets go through soft walls; pistols/SMGs/MPs/ARs/LMGs only leave small see-through holes (`map.holes`, `HOLE_ONLY` in constants.js, sight checks in physics `castSight`), shotguns/DMRs/melee/explosives break them), gadgets, explosions, defuser, downed state, snapshots.
    `server/bots.js` — bots (A* pathing, fighting, plant/defuse, site fortifying).
  - `public/` — `index.html`, `style.css`, `js/main.js` (network, prediction of your own
    movement, camera, vision blackout, HUD, menus), `js/mapdraw.js` (map pre-rendered to a
    big off-screen canvas with procedural textures; only changed cells are redrawn; shown as
    1024px tile canvases inside `#mapLayer` that the browser moves/scales with a CSS transform),
    `js/textures.js` (`S` = map picture detail, set by graphics quality), `js/sprites.js` (operators/gadgets drawn in code), `js/fx.js`
    (particles/explosions/smoke), `js/audio.js` (all sounds synthesised, no files; distances use the shared
    building frame so a sound on another floor is heard muffled from the right spot), `js/armory.js`
    (private shooting range in the menus), `js/crosshair.js` (crosshair settings + drawing), `js/gunart.js` (side-view gun
    pictures with attachments). Attachments: `ATTACH`/`gunMods` in shared/operators.js, stored in the loadout as `att[weapon]`,
    applied in server `fire()` and the Armory; the current gun's attachments go to clients as `aa` ("barrel,grip,sight").
- **Rendering & speed:** layers bottom to top: `#mapLayer` (map tiles, CSS transform), `#game` (people,
  gadgets, effects), `#fog` (line-of-sight blackout drawn small, stretched by the browser), `#over` (markers,
  crosshair, screen effects), `#vignette` (CSS). Graphics quality presets (`GFX` in main.js: Low/Medium/High/Ultra,
  saved per computer in localStorage `r62d-gfx`; default "auto" guesses from CPU cores/memory, then `watchPerf` drops a level
  when frames run slow and remembers it in `r62d-gfx-auto`) set render scale, fog resolution, particles, smoke puffs, sight
  rays and sprite shading. `window.__r62d.PF` holds per-section frame timings (ms, summed; divide by `frames`).
  Measured 1600×900 headless: Low 3.7 ms, High 7.3 ms, Ultra 11.3 ms per frame (was 19.7 before the layers).
- **Networking:** server ticks at 30/s, sends a JSON snapshot to everyone 20/s. Snapshots are compressed with permessage-deflate
  (`server/ws.js`, no context takeover; ~6 KB → ~1 KB) and each player's private details (ammo, gadget counts, recoil,
  prediction state) go only to them as `mine`, merged into `st.me` on arrival. Clients send
  input every frame; server applies movement per input message (with its dt) and echoes the
  last sequence number, client replays unacknowledged inputs (prediction + reconciliation).
  Other players are interpolated 100 ms behind.
- **Abilities:** server `useAbility` (instant), the "held abilities" block in the player tick (scan, lance, shroud,
  brace), `tickEnts` (gadgets over time), `detonate`/`explode`; client draws them in `sprites.js drawGadget` and
  `main.js draw` (decoys, lance sparks, gas, shroud hiding via `teamSeesBody`, scope viewers in `teamViewers`).
  Defending bots place their gadgets in `botPrep`; attacking bots use a few abilities in `botThink`.
- **Tests:** `node tests/abilities.js` has every operator use their ability in a live match.
  `node tests/sim.js` plays a bot-only match on every map (must print PASS; `--only <id>` for one).
  `node tests/reach.js` checks a body can reach every floor cell and every drone hole passes a drone but not a body.
  `node tests/stairs.js` walks a body up and down every staircase with real physics + bot path finding.
  `node tests/balance.js 12` is the balance report (see docs/balance.md for how to read it and past changes).
  `tests/shoot.mjs` drives a hidden Firefox (run as insideabush, via WebDriver BiDi,
  `--remote-debugging-port`) to take screenshots; see `docs/testing.md`.
- **Status:** first playable version — all 10 operators, gadgets, drones, cameras, reinforcement,
  barricades, destruction, defuser, DBNO, bots, lobby, operator select, HUD, scoreboard.
  **His idea list is `r6-todo.md` — work through it top to bottom, tick items off, keep going.**
  Other ideas are in `docs/roadmap.md`. Sound mix notes: `docs/sound.md`.
- **Menus/presentation:** title screen (`#splash`, first click starts audio), menu music is composed live in `public/js/music.js`, levels/XP in `shared/progress.js` (awarded in `store.recordMatch`, sent to players as an `xp` message), end screen in `showEnd`/`playXp` (main.js). `window.__r62d` is a hook for screenshot tests (`st.forceEnd` shows the end screen).
- **Saved data:** `server/store.js` keeps `profiles.json` and `matches.json` in `$R62D_DATA` — `~/.local/share/r62d/data`, shared by `play.sh` and the installed app (the old `data/` folder here is a leftover copy). Browsers keep a secret login token in localStorage (`r62d-token`). Key bindings + volumes are saved in the profile (`settings`), applied on join. `/api/profile`, `/api/match`, `/api/players` feed the Profile page. Loadouts per operator live in `shared/operators.js` (`LOADOUTS`).
