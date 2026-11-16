# R62D

*Created by the `vibe` command. Keep this file SHORT (under ~25,000 characters): it is
loaded into every session. Details go in `docs/` (see "Where the details are").*

> **The rules for working here are in `../CLAUDE.md`** (one directory up, alongside the
> other apps). They are loaded automatically; if for any reason they are not in your
> context, read that file before doing anything else.

## What this app is

A top-down 2D tactical shooter in the browser for insideabush and up to 9 friends (10
players max, 5v5), played over a VPN to a machine running the server, or as a Windows
program. He wants it to feel instantly familiar to people who play Rainbow Six Siege — the
same round flow, breaching, reinforcing, droning, cameras, defuser objective,
downed-but-not-out — **but everything must be original**: our own operators, names, maps,
art. We declined to copy Siege's operators/maps/art (it would be recreating a specific
existing game); keep it that way. Same for Zombies (Black Ops 1 rules, our own town).

Players come from CS2 and R6: CS2-style controls, R6-style rounds. Modern counter-terror
look, crisp detailed top-down with tilt and raised walls; your team blue, enemies orange
(colours changeable in Settings). It must not lag (target: steady 80+ fps on his PC).

**His idea list is `r6-todo.md` — work through it top to bottom, tick items off, keep
going.** Every idea goes there (there is no other list), only his ideas.

## Standing decisions (his; don't undo without asking)

- Crosshair aiming mode is the default; other modes stay in Settings → Mouse & Aim.
- Friendly fire always on (not in preparation). Unlimited barricades. Prep 30 s, action 2:40.
- Out of sight = grey remembered map; only what YOU look through is live colour.
- Fewer alert marks: no off-screen ! marks. He does NOT want the aim marker past the crosshair.
- Voice is scrapped (text chat, ping wheel, map instead); don't bring it back unless he asks.
- Hosting is VPN / home network only, never the open internet. No installer: the zip is fine.
- The server only runs while the game is open; don't leave one running after tests.
- Don't start long background runs (e.g. 20-minute pro practice) without asking him.
- Bot ranks: Copper/Bronze dumb, Silver/Gold casual, Diamond dedicated, Champion top 0.8%, Pros best.
- Balance targets: attack 45–55% on every map; an operator is broken over 60% / bad under 40%.
- GPU checks run in headless gamescope, never a window on his screen (docs/performance.md).
- Releasing to Lando (the config pin) is never done from here; see ../CLAUDE.md.

## Where the details are

Search these with grep for a feature, a function name or a test name before changing it.

| File | Holds |
|---|---|
| `docs/features.md` | every feature he asked for, what he chose, and its code names (aiming, camera, maps, cameras/feeds, ropes/roofs/hatches/windows, phones/touch/trackpad/controller, Esports TV, pros/playbook/practice, roles, guns/attachments/spray, shields, tutorial, free play, ranks, sound…) |
| `docs/history.md` | dated batches of work since 2026-11-02, newest last, with lessons and tests (game modes, zombies, perspective/3D look, rope camera, replays, balance passes, Windows program…) |
| `docs/layers.md` | the full draw order, bottom to top — keep current |
| `docs/performance.md` | frame-rate work, GPU measuring recipe |
| `docs/testing.md` | headless browser screenshots (`tests/shoot.mjs`), thumbs test |
| `docs/balance.md` | balance reports and past changes |
| `docs/drills.md` | pro drills, patch notes, pro opinions |
| `docs/sound.md` | sound mix |
| `docs/notes-next.md`, `docs/batch-*.md`, `docs/sniper-wip.md`, `docs/voice.md` | older plans and leftovers |
| `android/README.md`, `public/phone/README.md` | the Android app: the whole game on a phone (its server runs in the page), joining computers, updates, signing |
| `tools/changelog/` | his change history document (rebuilt after every commit into ~/Documents); add each new day to `days.json` |
| `shared/patchnotes.js` | add a line for every gameplay change |

When adding a feature a player uses, also update: tutorial.js `STEPS`, index.html
`.tutInfo`, `renderControls`, `TIPS` in main.js. When a batch is done, add a short
section to the end of `docs/history.md` (and features.md if it changes a feature), and
only add to this file if it is a rule every session needs.

## Lessons learned the hard way

- Headless Firefox timings do not show GPU-canvas costs: avoid unusual composite ops,
  per-frame canvas style changes, `ctx.filter` on map changes, and `drawImage` of a big
  plain canvas into a per-frame canvas. Have him (or headless gamescope) try any rendering change.
- `classList.toggle(x, a || b)` with b undefined flips instead of setting: pass a real true/false.
- Map rules: doors at least 2 cells wide, 2 free rows beyond both ends of every staircase;
  doors/windows on a shared wall go AFTER the wing's `box`; never run a shape through
  furniture, doors or stairs. `node tests/reach.js`, `tests/openings.js` must pass.
- Tests import `tests/_tmpdata.js` first so they never write to the real `data/`.
- Node is not on PATH in a plain session: run tests through
  `nix develop /home/insideabush/nixos-config#vibe-web --command ...` (a failing `node` hides in grep).
- Checked 2026-11-16: `tests/feeds.js` 4/4, `stuckbots.js` 3/3, `ropebots.js` 3/3 pass;
  `prepff.js` was a test fault (a third teammate or a wall in the line of fire), fixed, 40/40.

## How it is built

- **Language:** JavaScript. Node 22 server (no npm packages at all — a tiny hand-written
  WebSocket server in `server/ws.js`) + plain browser JavaScript with Canvas 2D.
  Dev shell: `vibe-web` (see `.vibe-project`, `.envrc`).
- **Run:** his desktop shortcut runs `play.sh` (he asked that it work from any clone so Lando can play: Node 22+ on PATH, else `~/nixos-config#vibe-web`, else `nix shell nixpkgs#nodejs_22`; `PORT=` honoured; only stops a server it started itself; no Firefox = `xdg-open`; starts the server if not running, opens Firefox with its own profile at ~/.local/share/r62d/firefox-kiosk, URL `?app=1`; on Hyprland a normal window with its bars hidden by `userChrome.css`, made full screen or a 1280×720 window by `hyprctl` (he asked to go windowed; Firefox `--kiosk` ignored the desktop leaving full screen; `/api/window`, `appWin` in main.js, choice in `~/.local/share/r62d/windowed`), elsewhere still `--kiosk`; "Quit to desktop" calls `/api/quit`, localhost only, which pkills that window). Manually: `nix develop /home/insideabush/nixos-config#vibe-web --command node server/server.js`
  then open `http://localhost:6262`. Friends use `http://<this machine's VPN IP>:6262`.
  `R62D_FAST=1` shortens operator-select and prep to a few seconds for testing. `PORT=` changes port.
- **Layout:**
  - `shared/` — used by both server and browser: `constants.js` (tiles, timings),
    `map.js` (list of maps + floorAt/localPos/roomAt), `mapkit.js` (map building kit: floors sit side by
    side in ONE grid separated by void, joined by stairs — `map.portal` sends you to the other floor when you
    walk off a staircase's end; maps are written in a shared building frame so floors line up),
    `maps/*.js` (one file per map; `node tests/sim.js --map <id>` prints every floor as ASCII). Map rules
    learned the hard way: doors at least 2 cells wide, 2 free rows beyond both ends of every staircase. A body is
    `PLAYER_R` 6 (was 7, he asked again 2026-11-06; he asked that people fit everywhere; at 10 a body couldn't pass 1-cell gaps beside bookcases), so a
    1-cell gap is a squeeze bots also take. `node tests/reach.js` must print 0 unreachable cells on every map.
    Drone holes (`map.dhole`): `mapkit.js droneHoles()` puts one in the middle of each plain wall two rooms share
    Every map now uses them (he asked for less blocky maps; a "shapes" block per floor in each map file: angled building corners matched on every floor, rounded/angled room corners, the Embassy courtyard and School gym rounded). Corner coordinates: a box (x0,y0,x1,y1) has its outside corner at x0 / x1+1 and y0 / y1+1.
    Angled and curved walls: `K.walls(points, thickness)`, `K.seg`, `K.arc(cx, cy, r, a0, a1)`, `K.round(x, y, r, dir)` (rounded room
    corner), `K.chamfer(x, y, n, dir)` (45° corner) and `K.outside(poly)` (cut a building corner back to outdoors) — all in building-frame
    cell units (12.5 = middle of cell 12). The cell stays a wall tile, but `map.shape[k]` holds its solid parts (convex polygons, world px);
    physics `resolve`/`castSight`, server `hitscan`, `pointSolid`/`circleBlocked`, mapdraw `wall`/`slopeEdges` all respect it. Never run a
    shape through furniture, doors or stairs (the kit warns: it leaves a gap). `node tests/shapes.js` checks sight/bodies/bullets on Harbor.
    (`K.droneHole(x, y)` adds one by hand); drones (radius 2.5) pass, people don't, reinforcing the wall closes it. Drones have 1 hp (`hp: 1`): any bullet (lag-compensated like bodies via `recordHistory`), melee, arc or blast breaks one (`droneLost` puts the pilot back in their body); defender bots shoot drones in sight unless someone stands behind (`enemyDrone` in bots.js). `physics.js` (movement, collision, line of sight, ray casting),
    `operators.js` (weapons + all the operators, loadouts, bios, roles).
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
  **Lag fix (2026-11-02):** the map picture and its grey copy are `Tiled` (public/js/mapdraw.js) sets of 1024 px canvases, drawn into directly (`onTiles`, `regionPart`) and shown as-is by `mount`; read them with `R.c.drawTo(ctx, sx, sy, sw, sh, dx, dy, dw, dh)` / `R.grey.drawTo`. One huge canvas made Firefox (graphics-card canvas) duplicate ~85 MB on the first change after showing it: a 60-120 ms freeze whenever the map changed (he saw it as lag in Esports TV). Measuring his real window: browsers POST frame stats to `/api/perf` every 3 s during a match (`perfRep` in main.js); his kiosk can be started with `--remote-debugging-port` and driven over BiDi.
  **Zoomed out (2026-11-07, he asked: laggy far out):** raised walls are kept per 16×16 block (look.js `raisedFrame` once a frame for all three passes, then `drawRaised(ctx, R, frame, groups, pic)`; blocks redone from `R.wallsDirty`, filled by `cellChanged`), and far out the fog step and wall tops read `R.lowCopy()` (mapdraw.js: a quarter-size `Tiled` copy, kept up to date from `onTiles` rects) once the layer shows fewer pixels than it holds. PF sections `raise`/`fogblit`. Headless Embassy at 886 px tall: 14.5 → 10.7 ms a frame.
  **GPU copies (2026-11-12, 35 → ~94 fps in his stress test):** never `drawImage` a big plain canvas into a per-frame canvas: `Tiled.src` keeps an ImageBitmap per map piece (`prime` while loading, `drawTo(..., live)` for copies that must be fresh); far out `showFor(z)`/`picFor(k)`/`copyAt(K)` use half/quarter copies. Measure on the real GPU invisibly with headless gamescope (docs/performance.md), never a window on his screen.
  **Lesson (2026-11-02):** a "faster" grey-map copy (pre-scaled snapshot drawn with globalCompositeOperation 'copy' + a sub-pixel CSS slide of #fog) measured 30% faster in headless Firefox (software canvas) but made his real Firefox (graphics-card canvas) very laggy, so it was reverted. Headless timings do not show GPU-canvas costs: avoid unusual composite ops and per-frame canvas style changes, and have him try any rendering change before calling it done.
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
- **Tests:** `node tests/abilities.js` has every operator use their ability in a live match; `node tests/oldops.js` (first 30) and `node tests/newops.js` (the 21 added) check each skill does what its description says.
  `node tests/sim.js` plays a bot-only match on every map (must print PASS; `--only <id>` for one).
  `node tests/reach.js` checks a body can reach every floor cell and every drone hole passes a drone but not a body.
  `node tests/stairs.js` walks a body up and down every staircase with real physics + bot path finding.
  `node tests/balance.js 12` is the balance report (see docs/balance.md for how to read it and past changes).
  `tests/shoot.mjs` drives a hidden Firefox (run as insideabush, via WebDriver BiDi,
  `--remote-debugging-port`) to take screenshots; see `docs/testing.md`.
- **Status:** full game — 60 operators, 40 guns, 7 maps, gadgets, drones, cameras, reinforcement, rappelling,
  barricades, destruction, defuser, DBNO, bots, tutorial, free play, Armory, Map Knowledge, points, HUD, scoreboard.
  **His idea list is `r6-todo.md` — work through it top to bottom, tick items off, keep going.**
  Every idea goes in `r6-todo.md` (there is no other list). Sound mix notes: `docs/sound.md`.
- **Loading screen** (he asked: crisp and premium): `runLoading(title, steps, mapId)` shows the map's picture drifting behind its name, floors and description, a transform-based bar (keeps gliding while the map builds) with a sheen, %, step and a tip; `jobsStep` reports progress inside a step (`loadPart`); back-to-back loading jobs share one screen (`loadQueued`).
- **Menus/presentation:** title screen (`#splash`, first click starts audio), menu music is composed live in `public/js/music.js`, levels/XP in `shared/progress.js` (awarded in `store.recordMatch`, sent to players as an `xp` message), end screen in `showEnd`/`playXp` (main.js). `window.__r62d` is a hook for screenshot tests (`st.forceEnd` shows the end screen).
- **Saved data:** `server/store.js` keeps `profiles.json` and `matches.json` in `$R62D_DATA` — `~/.local/share/r62d/data`, shared by `play.sh` and the installed app (an old leftover copy that used to sit in the project was moved to `~/.local/share/r62d/old-project-data-copy`). Browsers keep a secret login token in localStorage (`r62d-token`). Key bindings + volumes are saved in the profile (`settings`), applied on join. `/api/profile`, `/api/match`, `/api/players` feed the Profile page. Loadouts per operator live in `shared/operators.js` (`LOADOUTS`).

