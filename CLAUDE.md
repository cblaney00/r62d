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
- Aiming defaults to the **aim pad** (he asked for it): a ring on the right of the screen (`pad()` in main.js) acts like a joystick — the mouse is kept inside it and its direction from the centre sets the aim, its distance how far ahead the crosshair sits (`cursor()`), so turning round is a short flick. No dead middle (he asked): captured-mouse moves go through `padMove` (sideways always turns, straight through the middle comes out the other side). Settings → Aiming also has "Turn" (FPS-style: mouse X turns, Y sets reach, `turnMove`) and "Cursor" (aim at the cursor); saved per profile (`aim`).
- Xbox controller (he asked): `public/js/gamepad.js` (read each frame by `pollPad` in main.js; layout listed in Settings). Right stick aims like the pad, left stick moves (light push walks), B toggles crouch.
- Crosshair v2 (he asked: the old thin white one was hard to see): green cross + dot with a black border, pixel-sharp (`crosshair.js`); old saved crosshairs reset to it once (`XH_VERSION`).
- Builds follow armor (`BODY_W`/`HIT_R` in shared/operators.js): heavies broad, mediums and lights skinnier. Bullets hit within `hitR(op)` (7.5 / 6.8 / 6.2 px), smaller than the bumping radius `PLAYER_R` 10, so people are harder to hit. He asked for this.
- Movement uses real-world speeds (`M_S` in shared/physics.js, 1 m = 36 px = `PX_PER_M`): jog 2.6 m/s (2.3 heavy, 3.0 light), walk 1.4, ADS 1.5, crouch 0.9, downed crawl 0.5, drone 3.2. He asked for everything slower and realistic.
- FOV like a modern FPS (103°, 70° ADS). Aiming is quick (`ADS_TIME` 0.1–0.28 s) and zooms the camera in (×0.82, scope ×0.9, `st.adsZ`) within ~0.15 s; he asked for that and for less slow panning, so the room-size zoom (`st.envWant`/`st.envH`) only changes for a >15% difference and settles in ~0.5 s. Zoom adapts: close indoors, wider outside / long sightlines (`want` in the main.js camera: 240–470 world px tall indoors, up to 520 down a sightline; he asked twice for closer).
- Map cameras hang on walls (he asked: never in the middle of a floor). The map files still give a rough spot (`cams`); `wallMount` in shared/map.js moves each to the nearest plain wall or corner of the same room (not a door edge, drone hole or behind a tall prop), so they are in the same places every round. They are drawn small and dark (`drawWallCam` in sprites.js; view cone only for defenders), can only turn ±83° from the wall (±49° in a corner), and break like drones: one bullet, melee, blast, zap, or knocking down the wall they hang on. `node tests/wallcams.js` checks all of it on every map.
- Team feeds (he asked): the view key opens your team's feeds and left/right or the mouse wheel flips through all of them (`feeds()` in server/game.js, `feedList`/`feedView`/`camBar` in main.js). Defence: every working camera, map, turret or sticky. Attack: every team drone and wall scope. Only the owner steers their own drone or turns/fires their own gadget camera (`operates`); others watch only but can still mark enemies. Map cameras are anyone's. `node tests/feeds.js` checks it.
- Operator select shows a big loadout panel (he asked: the old small LOADOUT button wasn't immersive enough). Cards sit in a 4-wide grid on the left (`#opgrid`), the right ~60% is `#selLo`: the hovered card's loadout as a preview until you pick, then your pick's; guns, attachments and gadget are changed right there. It reuses the Operators page detail (`showLoadout`/`fillDetail` in ops.js, compact = no bio/stats).
- Friendly fire is always on (he asked): bullets, melee, shield bash, hammer, arc gun, turret cameras, toxin gas and every explosion (traps included) hurt teammates too; a teamkill costs a kill.
- Free play (he asked, for testing): a FREE PLAY tab picks a map and 0/1/3/5 enemy bots; `/ws?free=1` → `new Game({ free: true })`, `freeAction`/`freeSwitch`/`freeSpawn`/`freeRespawns` in game.js. Straight into the action phase, clock frozen, no round ends, the dead respawn after 3 s, N / B (`opNext`/`opPrev`) switch to the next/previous of all 30 operators where you stand (changing side moves the bots to the other side). Small hint at the bottom (`#freeHint`). Never saved. `node tests/freeplay.js` checks it on every map.
- Tutorial (he asked): a TUTORIAL tab in the menu (phases, roles, information, pinging) with two playable lessons, attacking and defending.
  Each runs in its own private match on the server (`/ws?tut=1` → a `new Game({ tut: true })` in server.js; `tutAction` in game.js) against
  two slow bots on Harbor Office; operator select and preparation clocks are held until the coach says go, nothing is saved. The coach
  box is `public/js/tutorial.js` (steps with `done` checks on the snapshot's `tu` info; Space continues/skips).
- Ping anything with T / middle click / a click in a drone or camera (he asked): `pingTarget` in main.js names what is under your aim
  (enemy → the old red spot, else a gadget/camera/drone, the objective, else the first wall/door/barricade/drone hole along your aim, else
  GO HERE / LOOK HERE). Server `mark` sends a labelled marker to the team and a PING line in team chat with the room; 4 pings per 3 s.
- Profiles go by name, no passwords (he asked): the same name (any capitals/spaces) is the same profile on any computer (`login(name)` in server/store.js). Two people cannot play as one name in the same match (`taken`). Old per-browser duplicates are joined by name at start-up (`mergeDuplicates`, backups `data/*.before-merge`). Tests import `tests/_tmpdata.js` first so they never write to the real `data/`.
- Playing with friends: the lobby shows "Friends join at http://<wired LAN IP>:6262" (`/api/addr`); the scoreboard (Tab) has a PING column
  (each browser measures its round trip every 2 s and reports it).
- Vaulting (he asked): Space (`vault`, controller: click left stick) climbs over low furniture (`T.LOW`, not the open drop by a balcony), windows (`map.win`; bodies can no longer walk through a window, `bodyBlocks` in physics.js) and `T.RUBBLE` (the waist-high stub left when bullets or melee knock a soft wall through; explosions, hammer and torch leave a clean hole, a knife hit clears a stub). `findVault` in physics.js finds the landing (obstacle within 12 px, at most 2.2 cells deep). Server `startVault`: ~0.6 s carried along a fixed path (no shooting, gadgets or aiming), then 0.35 s `recoverUntil` (no shooting or aiming); the vaulting player gets `vt` to play it smoothly. Bots path over vaultable cells and vault (`noVault` remembers ones that fail). `node tests/vault.js` checks it.
- Abilities all work. Floors are joined by stairs, and by floor hatches (he asked, "Floors part 2"): `placeHatches` in mapkit.js puts up to 3 per upper floor (2x2, biggest rooms, clear floor above and below, not near a defuser spot; `map.hatches`/`hatchAt`/`hatchBelow`). Tiles `T.HATCH` (walkable floor) → `T.HATCHR` (defender holds E on it, uses a reinforcement) or `T.HOLE` (melee ×3, shotgun/DMR shots aimed at it, hammer, torch, breach charge / cluster / nitro; plasma cutter also opens reinforced). A hole drops you to the floor below (`openHatch`/`holePortal` set `map.portal`), a shot aimed into it carries to the other floor (`aimedHatch`/`shotThroughHatch`), anyone who can see into it sees ~2 m round the other side (hatch viewers in `teamViewers`), and sounds through it are barely muffled. `node tests/hatches.js` checks it. Rail Depot has no room that fits one yet.
- Fewer breakable walls (he asked: too many ways into a site): `hardenWalls` in mapkit.js runs on every map after it is built. Each straight wall between two spaces is one wall; a site room keeps its partner wall + one more (inside first), other inside walls ~40% and outside walls ~25% stay soft (hash of map id, same every round), the rest become `T.HARD` concrete (`map.hardened`). Drone holes can sit in hardened walls (`T.HARD` + `dhole`). `node tests/softwalls.js` prints the counts per site room.
- Smarter bots (he asked): `server/bots.js`. Skill `game.botLevel` 0–3 (`BOT_LEVELS`, lobby `botLevel` message, free play `level`, snapshot `bl`; `SKILL` table = reaction/aim, tutorial always Easy). Roles per round (`ROLES`/`roleFor`: entry, support, flank, intel / anchor, roamer) and a lasting `p.persona` (aggr, patience). Breach plan (`BREACH_TOOLS`/`planBreach`/`doBreach`), revives (`downedMate`), arc gun on gadgets, callouts via `game.mark` when a human is on the team. `node tests/bots.js` counts it all and checks Expert beats Easy.
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
    Angled and curved walls: `K.walls(points, thickness)`, `K.seg`, `K.arc(cx, cy, r, a0, a1)`, `K.round(x, y, r, dir)` (rounded room
    corner), `K.chamfer(x, y, n, dir)` (45° corner) and `K.outside(poly)` (cut a building corner back to outdoors) — all in building-frame
    cell units (12.5 = middle of cell 12). The cell stays a wall tile, but `map.shape[k]` holds its solid parts (convex polygons, world px);
    physics `resolve`/`castSight`, server `hitscan`, `pointSolid`/`circleBlocked`, mapdraw `wall`/`slopeEdges` all respect it. Never run a
    shape through furniture, doors or stairs (the kit warns: it leaves a gap). `node tests/shapes.js` checks sight/bodies/bullets on Harbor.
    (`K.droneHole(x, y)` adds one by hand); drones (radius 3.5) pass, people don't, reinforcing the wall closes it. Drones have 1 hp (`hp: 1`): any bullet (lag-compensated like bodies via `recordHistory`), melee, arc or blast breaks one (`droneLost` puts the pilot back in their body); defender bots shoot drones in sight unless someone stands behind (`enemyDrone` in bots.js). `physics.js` (movement, collision, line of sight, ray casting),
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
