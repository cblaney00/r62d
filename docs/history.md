# R62D work history — dated batches

Moved out of CLAUDE.md on 2026-11-16, word for word. Each section is one batch of his requests, with code names, tests and lessons. Add new batches at the end. Search with grep.

## Batch of 2026-11-05 (second)
- Fewer alerts + death card (he asked): no off-screen ! marks; spotted = small faint triangle. `#deathCard` (main.js `deathCard`, shown while dead from the `killcam` message: `kop`, `km` metres, `wall` (server `this.shotPens` set in hitscan), `team`, `self`, `dnBy`); `causeOf(w, op)` in shared/operators.js explains a gun / ability (first sentence of its desc) / gadget (`CAUSE_TEXT`). Blasts are named by `blastName` in game.js (owner's ability, else gadget).
- BULWARK sprints with the shield up (`canSprint` in `mods`; riot shields can't); sprinting counts as jogging for `shieldPose` (`moving >= 2`). `node tests/sprint.js`.
- Side colours on clothing (he asked: attackers orange, defenders blue, by side, not by team): `SIDE_COL`, `accentsOf` (`ACC_SETS`: band / vest / gloves / pack, rotated per operator) in sprites.js; armbands bigger and by side. Ring is still by team.
- Feed groups (he asked): INDOOR, OUTDOOR, DRONES, UTILITY (`FEED_GROUPS`/`feedGroup` in main.js, same sort in server `feeds()`), `.cgrp` sections in `#cambar`.

## Batch of 2026-11-02 (part done; plan in docs/batch-22.md)
- Riot shields: `RIOT` in shared/operators.js (aegis/visor/ram on Onyx/Brisk/Hammer, bastion/glass/thorn on Rampart/Solace/Wraith, the 3rd primary). Server `p.riot`, `hasShield`, per-shield arc (`riotArc`), speed, aside time, bash; snapshot `ri`. `node tests/riot.js`, balance: `node tests/riotbalance.js N`.
- Starter attachments: `defaultAtt(w, op)`; `cleanAtt(w, a, op)` gives it when nothing was chosen.
- Bots: `shotClear`, `linedUp`, `checkAngles` (no spinning), `botCams` (defenders on cameras), 'space' defender role, `intelOf`; pro defence plans give each job its own way in (end of `playbook`). `facingCell` skips stairs/side glances at shields. `node tests/stuckbots.js --level N`, `node tests/revive.js`.
- Maps: `siteWindows` in mapkit.js adds windows to site rooms. Pro practice: 200 rounds per version (`ROUNDS_PER_VERSION`).
- Killcam: server `recordCam` (15 Hz, 6 s), shot log (hitscan wrapped at the end of game.js), `judgeKill` (BS rating + bug checks), `sendKillcam` (direct `killcam` message); bugs saved by `store.saveBug` to `$R62D_DATA/bugs`. Client `public/js/killcam.js` (`openKillcam`), F or `#kcBtn` while dead. `node tests/killcam.js`.
- Impatience (he asked: bots stood around; experienced ones less affected; mostly so rounds don't go stale): `impatience()` in bots.js (non-pro, ACTION, not planted): stayed within 3 m with no enemy seen for `limit` = (3 atk / 4 def) + patience×(4/6) + rank×0.8 s, or stuck with no path (`ai.noPathT` from `moveTo`) → a play (attackers: drop waits, flank via `flankPoint` or a fresh `ai.push`; defenders: new `ai.hold`, bold ones a room from `intelOf` near/roam; roamers a new roam spot). Paranoia: alone (no mate within 8 m) after a noise → `checkAngles` sweeps while moving. Roamers with no route pick another spot (`roamFail`/`roamBad`).
- Bots push as a team (`spacingMate` in bots.js: 1.5 m apart in a corridor, ~2 m and a staggered swing through the other half of a doorway; `node tests/spacing.js`, was 26% on top of each other, now ~2%). TV director holds shots 7 s+ and only cuts for a much better one.
- TV both teams (he asked): `T.sqTime` screen time per squad (fades over ~2 min), `share(sq)` × 60 bonus for the team owed time; `teamViewers` adds every alive player of both teams as a viewer (`tvSq`) in TV, and draw() fills each team's vision polygons in its colour (0.13 alpha) on `#over`.
- Esports TV `tvDirector`: anticipation (enemy distance + closing speed), never cuts mid-fight, killer after a death, clutch/streak bonuses, opening map shot (`ovUntil`), boredom rotation.
- Dead connections: `server/ws.js` pings every 5 s, drops after 30 s silent or 1 MB unsent (that was the 12 GB on Lando's server; zombie TV/free games kept running). Practice worker `resourceLimits` 512 MB. `node tests/deadclient.js`.
- Phones: `html.touch` lobby = top tab strip; Settings pages (now for every screen, see the second batch below). Not done: Lando LAN (his firewall). Slow mouse: play.sh sets Hyprland `input:accel_profile flat` while the kiosk window is open and restores it after (Firefox Wayland truncates sub-pixel relative motion, nsWindowWayland.cpp `relative_pointer_handle_relative_motion`).

## Batch 23 (done; notes in docs/batch-23.md)
- Weak breachers: Hammer 4 slugs, Ferro `HAMMER_CD` 2.5 s and one swing clears T.BARRI/T.BEAM/T.DSHIELD or an unreinforced hatch (still no walls), Salvo 5, Torque 4 discs at 60. Bots: `BREACH_TOOLS` has sticky (`blow`: set off from the wait spot) and saw, no hammer (Ferro swings in `botAbility`); `proPickOp` puts `HARD_BREACH` first only when the plan opens a wall, and a soft breacher whose plan wall is reinforced uses `planBreach` instead.
- Key layouts (he chose the games): `PRESETS`/`applyPreset` in keys.js, buttons `#keyPresets` in Settings → Keys. `node tests/keypresets.js` checks no key does two jobs. Game text names keys with `label(id)` (tips: `{id}`, `tipText`), never fixed letters.
- TV viewer requests (he asked: up to 3, must play, one per role per side): `tvPick.req`/`#tvReq` in main.js, server `this.tv.req`, `requestPick` (amateurs) and the front of the pool in `proPickOp`. `node tests/tvrequests.js`.
- TV instant replays (he asked: full screen ~6 s, fade-in/fade-out times, smooth): server `tvKill` (why it's big) → `tvClips` sends `tvclip` 1.2 s later; client `T.seen` (did the camera catch it), `T.calm` (nobody mid-fight), `public/js/tvreplay.js` (`offerReplay`/`tickReplay`; slow motion round the kill, eased camera, gold wipe, ≥18 s apart) drawing with `drawClip`/`poses` from killcam.js. `st.tvAllReplays` forces them for screenshot tests.
- Camera bounce (he said: "super bouncy when you look around"): Crosshair mode leads from `freeAimPoint()` (world), not the screen cursor (feedback loop); no aim-distance zoom for bodies; slower lead/zoom glides.
- TV team talk: `tvTalk`/`planTalk` in bots.js (15 s `TALK_TIME`, requests weighed by frag rank, `spread` bigger at low ranks), `node tests/tvtalk.js`. Trench plant cover / Lens site-floor periscope in `botAbility`; `shotClear` checks 300 px past the target.
- BALL KNOWLEDGE: `public/js/knowledge.js` (`#bkPage`), data from `training.opx` (per op: rounds, wins, kills, deaths, skill kills, skill uses, headshots, opening kills; recorded in train-worker.js from PREP) and `training.ops`; `/api/training` returns both. PATCH WATCH thresholds in `patchWatch`.
- Don't start long background runs (e.g. a 20-minute pro practice) without asking him.

## Batch of 2026-11-02 (second): six items from his list
- Defender outside (he asked): server `p.outside` (T.GROUND under a living defender in PREP/ACTION) → snapshot `ou` (ids); attackers get `#outWarn` at the top ("⚠ DEFENDER OUTSIDE · ARGUS · NEAR WEST GARDEN", nearest `atkSpawns` name) from `drawOutWarn` in main.js, with `audio.ui('alert')` when the count rises.
- Settings rebuilt (he chose sections down the left): `#settings` = `.setSide` nav + `.setBody` pages (`.setPage[data-p]`: sound, aim, keys, screen, xhair), `showSetPage` remembers `r62d-setpage`. Each row is `.srow` (`.sl` name + plain hint, `.sctl` control; not `.sc`, that class is the scoreboard). Keys table grouped by `KEY_GROUPS`. The old phone-only page split is gone (all screens have pages).
- Drone keys (he asked): 6 = `drone` action → server `droneKey` (put out / drive / back to body; attack only), 5 = `view` → `openFeeds` (never deploys). On a drone or camera Q / E (`leanL`/`leanR`) send `camPrev`/`camNext`. Controller/touch button 13 is `droneOrCams` → old `view` event (`toggleView`, still used by bots and tests). `node tests/feeds.js` checks 5/6.
- Settings sliders all have a typed number box (`input.num` added next to every range in `#settings` at start-up in main.js; `DIV` shows sensitivities as 1.00; synced every 250 ms while Settings is open). Text size applies on `change`, 70–160%, and `--uiz` never exceeds what fits the screen (`room` in `fitUi`).
- Lean is a toggle by default (`leanMode`, `r62d-lean`, profile setting `lean`; Settings → Mouse & Aim → Leaning: Toggle/Hold); `st.leanT` resets on death/down.
- Pros: `proPickOp` draws from every operator of the player's job (favourites ×2, practice `opWeight`², last round's pick ×0.35; `p.pro.lastOps`). Eight more plays in `playbook` (attack pinch, late, window, lurk; defence turtle, bait, tworooms, hunter); plan choice falls off gently (`1 / (1 + i*0.3)`).
- Bigger maps (he asked: ~1.5× floor space, not rectangles, he chose 1.5×): each building got new wings written in negative/extended building-frame coordinates (floor frames grew): Harbor North Wing (hook round a loading yard, own stairs), Villa West Wing (3 floors, rounded end), Depot Station Wing (steps out past the east wall, platform + train), Embassy Annex (L round a garden, 3 floors), Lodge Spa Chalet (separate, cut corners, glass walkway + skybridge), School South Block (upside-down T: pool with balcony, theatre), Dust Town (Spice Warehouse, Cistern Hall, Hotel kitchen wing, Tea House, Car Wash, back street). Indoor floor 1.39–1.58×.
  Lesson: a wing's walls drawn after a door on the shared wall cover it, so doors/windows on a shared wall go AFTER the wing's `box`; `node tests/openings.js` catches a covered opening. Watch for "a sloped wall runs into furniture" lines from any test.

## Batch of 2026-11-03
- One reinforcement = the cell + `REINF_HALF` 1 each side (3 cells, he asked for smaller; was 2 each side). Bots reinforce over prep, not at once (he saw walls go solid as he walked by): `reinforceNext` + `ai.reinfN`/`reinfT` queue at the top of `botThink`. `node tests/botreinforce.js`.
- Chat hidden on splash/lobby (CSS sibling rule). Mouse taken automatically when playing (`st.autoLockN`, 3 tries a match; play.sh sets `dom.user_activation.transient.timeout` 86400 so the last menu click still counts; Firefox also allows it in DOM fullscreen).
- Fog speed: no grey copy any more. The fog step draws the colour map (`st.rend.c`) and `#fog` has a CSS `filter: grayscale…`; the stairs view dulls with a dark wash. (ctx.filter on map changes made his GPU Firefox slower over time.) Confirmed on his screen 2026-11-03: 60 fps, ~6–7 ms a frame on High (was ~25).
- Esports TV bans: `tvBanStep`/`isBanned` in game.js (`this.bans`, `banRun`, `BAN_GAP`), `tvBanPick` in bots.js; snapshot `bn`/`bq`. Picking screen `tvDraft` in main.js (`#tvDraft`, `html.tvsel` hides webcams). `node tests/tvbans.js`. TV viewers count as joined in `screens` (the lobby used to show behind).
- Esports TV loads separately (he asked): its client code is `public/js/tv.js` (director, cards, `tvDraft`, bubbles, casters, re-exports tvreplay.js), fetched by `loadTv()` in main.js the first time `switchMatch` gets a tv (`TV` is null until then; main.js calls `TV.*` only while `st.tv`). Leaving keeps the server match paused 20 s (`heldTv`/`held` in server.js, `R62D_TV_HOLD_MS`): reopening with the same picks reuses `st.tvHold.key` (`/ws?tv=1&key=`) and resumes it. `node tests/tvhold.js`.
- TV camera cones: snapshot players `cf` (TV only), `tvCamCone` cache; watched cameras become viewers. Casters: `public/js/casters.js` (`castEvent`/`castPhase`/`castTick`, `#tvCast`), Pro level only.

## Batch of 2026-11-03 (spawns, Ball Knowledge cards)
- Safe spawns (he asked: attackers died as the round began): `makeMap` gives the ground floor `PAD` 20 more cells on every side (building-frame coords unchanged, `padGround` carries the usual ground out, roads widen 3 cells), `finish` runs `coverSpawn` on each atkSpawn: moved over open ground to ≥ `SPAWN_BACK` 30 cells from the building, then van/container slabs (`spawnCover` props, T.TALL) toward the nearest wall, the building's middle and whatever inside cells still see it (`exposed`). Defender bots: `keepInside` in bots.js `moveTo` keeps their goals indoors in PREP and the first 15 s of ACTION (not near their own site). `node tests/spawnsafe.js [rounds] [--why]`.
- Ball Knowledge cards: click opens one in place spanning 3×2 cards (`S.open`, `detail()` in knowledge.js; tips are [text, example] pairs).

## Batch of 2026-11-03 (Ball Knowledge)
- Bots headshot: in a fight `p.aimX/aimY` follow their aim (it used to stay where the last throw went, so `onHead` failed). Per sighting `ai.oh` (go for the head, `head` in `SKILL`/`proSkill`) sets `ai.os` (offset across the body); when not going for the head the crosshair point is kept off it. Copper ~12% of kills … Pro ~39%.
- Ball Knowledge: train-worker counts skill uses from the full count (defender bots place traps inside `beginPrep`); `opx[8]` = rounds the uses were counted in; old uses/headshots reset on load (`x.length < 9`).
- Solace bots stim hurt teammates; pro jobs with `clear` (a window cell) shoot its boards off before the go; new attack play `collapse` in shared/pros.js.
- Measuring: `node tests/probe.js <level 0-7> <matches> [map] [--json]` (side wins, headshots, per operator, plans); `node tests/strats.js <level> <matches> [--json]` / `--merge files` (way into the site, entry time, ways used, defenders on site, first kill, plant state). Findings: first kill and defenders on site matter most; planting is fine (the "Defuser disabled" reason hides wins by elimination).

## Batch of 2026-11-03 (outdoor play)
- Upper windows (he asked, R6-style vertical play): `windowViews`/`windowFoot`/`windowState`/`wallGhost`/`peekSeen`/`floorOff` in shared/map.js. Up to `WIN_REACH` inside an outside upper window (one with a rope) you see the ground floor below through a cone from just outside the wall (`WIN_RANGE` 15 m, he chose), as wide as the opening from where you stand; nothing through intact boards, a `WIN_SLIT` slit per bullet hole (he asked: as limited as the planks). Both ways (he chose): the peeker shows on the ground just outside the wall (`wallGhost`), seen only from inside their view and through a hole only within `WIN_HOLE_SEE` 6 m; anyone on a rope/ledge shows on the ground under them. Server: `hitscan` hits those copies, a shot out of an upper window sets `this.winCarry` and `shotOutWindow` carries it on down on the ground floor. Bots: `visibleEnemy` (exported) both ways, `shotClear` lets `win` targets pass the void. Client: `teamViewers` adds `kind: 'window'` viewers you face, `drawWindowView` (ground drawn into the dark outside, moved by `floorOff`), `wallGhostSeen` + "▲ 2F WINDOW"/"▲ ON THE WALL" copies, `winAimed` lets the crosshair go out over it, camera may follow (`st.winBox`), `drawWindowMarks` = plates on the ground under each upper window (BOARDED/HOLES/OPEN/BLOCKED as last seen from below, `st.winKnown`; he asked so attackers know which windows may be watched). `node tests/windows.js`.
- Run-outs (he chose R6's rule): banner at once, spotted for attackers after `RUNOUT_SPOT` 3 s outside in a row (`p.outT` in `tickPlayer`).
- Yard cover (he asked: safer and riskier ways in): `addYardCover` in shared/map.js (run by `buildMap`) measures each ground way in's approach (`APPROACH` 9 cells) against the upper windows' views and puts containers/dumpsters (`yard: 1` props, T.TALL) until about half the ways in are under `SAFE` 30% exposed; the rest stay exposed on purpose. `m.yard` is the report.
- Screenshot tests: free action `tile` (R62D_FAST only) sets map cells (and a hole) to open/board a window.
- Server load (he asked: Lando's server sounded like a jet): measured with `node tests/perfmatch.js [map] [seconds] [level]` — a 10-pro-bot match is ~1.5% of one core, idle ~0.2%. The noise was pro practice running flat out (160% of a core for up to an hour after every version): `train-worker.js` now works `R62D_TRAIN_DUTY` (0.15) of the time and rests the rest (~38% of a core, 200 rounds still ~15 min). Bot `findPath` reuses its buffers (stamps, flat typed heap; paths identical, ~20% quicker). Map building: `propAt` in mapkit.js is a grid and `coverSpawn`'s distance table is made once per map (130–290 → 26–75 ms, maps identical). `MapRenderer(map, tiles, scale)` honours scale: Map Knowledge draws at 1, Playbook at 0.6.
- Round length (he asked: a bit shorter, still room for intel and creativity): action 2:40 (`DUR.action` 160, was 3:00), 5 s between rounds (`roundEnd`), prep stays 30 s, defuser 45 s. Bot timings that meant "a minute in" use `DUR.action - 60`; the pro roamer is back on site at 1:30 left (`until: 70`). Measured: bots finish rounds in ~1 min median (pros 90% under 1:47), so 2:40 still leaves people time to drone.

## Talking to the bots (see docs/voice.md)
- Bots and casters write in chat; nothing plays. Voice is scrapped (he decided 2026-11-04: microphone, recogniser and recorded voices are gone; don't bring them back unless he asks). Bots understand team chat: `shared/commands.js` (`parseCommand`), `botHear`/`botCmd` in server/bots.js. Lines: `shared/comms.js`. `node tests/comms.js`.
- Ping wheel (he asked; League-like look, our own art): `public/js/pingwheel.js` (`PINGS`, `drawWheel`, `drawPing`, `drawBadge`), key `wheel` (X, took over the talk key, saved keys carry over). `openWheel`/`closeWheel`/`firePing` in main.js; drag is held in `st.wheel`, your aim stays still; no drag = the old smart ping. Server `mark` carries `pk` (`PING_KINDS`), same wait between pings as before (`markOk`), `botPing` in bots.js gives the bots orders. T still pings at once. Not on controller or phone. `node tests/pingwheel.js`.
- Map (he asked): key `map` (Caps Lock on every layout), `toggleMapV`/`drawMapV`/`mapBox`/`mapClick` in main.js, `st.mapV`. Picture from `st.rend` (what you know), redrawn each second; people and pings each frame; enemies only from `st.foesSeen` (who you see now). Walking works while open; aim and gun wait.

## Server only while open (2026-11-03)
- He asked: the server is only up while the game is open. `stop_server` in play.sh stops it after the window closes and nobody has been connected for 20 s. So don't leave a server running after testing or restarting. Daily pro practice (`trainCheck`) now only runs while the game is open and no match is on; POST /api/train likewise.

## Bot view (2026-11-03)
- He asked: on Esports TV bots stared off angles, then snapped at contact. `angleOn` in bots.js (pt if visible, else the corner on the way to it, else a nearby way in; used by pro `watch` and heard noises), `pathLook` (walking looks along the path), `checkAngles` falls back to the longest view. `node tests/angles.js [matches] [--level N]` measures it. Open: pros on a hold are further off at first contact than before (median ~45° vs ~23°), walking bots better (~31° vs ~49°).

## Windows program (2026-11-03)
- R62D is also its own program (he asked; the browser version is unchanged and shares all game code): `desktop/` = Electron wrapper.
  - `desktop/main.js` = starter (never updates itself): window (full screen, F11 or `r62dApp.toggleFull`, remembers windowed in `userData/windowed`, no menu = no Ctrl+W/R), loading page, `updates.js`, then runs `desktop/app.js` from the newest game copy (falls back to the bundled one if it fails). `R62D_DATA` = `%APPDATA%\\R62D\\data`.
  - `desktop/updates.js` (he asked: update on every start): GitHub releases of cblaney00/r62d tagged `b<n>` with `R62D-update.zip` (n = `git rev-list --count HEAD`); downloads, checks the sha256 digest, own unzip, `%APPDATA%\\R62D\\game\\<n>`; skips one whose `electron` differs (needs a fresh download). 6 s timeout, offline = play what is there. `R62D_RELEASES` for tests.
  - `desktop/app.js` (start screen, he chose): PLAY = server bound 127.0.0.1 (`R62D_BIND`; lobby hides the join address and OPEN TO LAN via `/api/addr` `local`), HOST = `openTo('0.0.0.0')` in server.js, JOIN = `find`: Lando's homelab `http://192.168.1.76:6262` first (`R62D_HOMELAB` for tests), UDP broadcast "R62D?" on 6264 (server.js `answerFinders`, not when local-only), and on the VPN (10.10.0.x) every address asked; 1 found = join, more = short list, none = message + type an address. He said: only joinable on Lando's homelab / home network, never the internet (no router port opening).
  - `desktop/preload.cjs` (`window.r62dApp`), `desktop/start.html`. `quitGame` in main.js calls `r62dApp.quit()`.
- Build: `bash desktop/build.sh` (node on PATH) → `build/R62D/R62D.exe`, `build/R62D-windows.zip` (full, 147 MB), `build/R62D-update.zip` (game only, ~0.5 MB). Electron `EV` for Windows from GitHub, checksum checked, cached in `build/cache`. The .exe icon is put in by our own `desktop/seticon.mjs` (rcedit was refused by the safety check). Release: commit + push, then `sudo -u insideabush -H bash desktop/release.sh` (gh release `b<n>`, --latest).
- Tested under wine (he allowed it): `R62D_PORT=6271` + `--remote-debugging-port=9333 --no-sandbox --disable-gpu` on an Xvfb screen as insideabush, prefix `~/.local/share/r62d/wine-test` (`WINEDLLOVERRIDES=mscoree,mshtml=` skips the mono prompt); driven over the DevTools port. Not yet run on real Windows.
- No installer: he decided the zip is fine (2026-11-03).
- Main menu (he asked for an overhaul, Risk of Rain 2 style, 2026-11-10; I chose the design): `#lobby.home` = big R62D title + big choices (`#mnav` `.hnav`: QUICK MATCH, JOIN A GAME, FREE PLAY, TUTORIAL, ESPORTS TV, INTEL; then PROFILE / SETTINGS / QUIT), name box `#join` on the right until you have a name (`askName` lights it up and goes on to the page after, `st.wantTab`); each choice is a full page (`#lobby.paged`, `setTab`/`PAGES`/`pageBack` in main.js; top bar = BACK, title, your card; Esc = BACK; CONTROLS backs to INTEL via `PAGE_UP`). INTEL (`#tab-intel`) = cards opening Operators, Armory, Map Knowledge, Playbook, Ball Knowledge, Controls. Quick Match: maps, both teams wide, bot rank + buttons bottom left, gold START MATCH bottom right. `#corner` is hidden over the menu. Phones: the six choices in a 3 × 2 grid with captions.

## Batch of 2026-11-03 (bot orders, lag)
- Bots obey (`node tests/botorders.js` passes on every map): in `moveTo` the "other half of the doorway" only applies before entering it, no wall swing with anyone within 30 px (`inWay`; the swing lands on them), SOLDER doesn't weld under an order, walking on the spot for 4 s tries another route (`ai.anT`).
- Lag (he said it got a little laggy): `findPath` prices each cell once per search (`CC`/`CS`), `moveTo` keeps its path when the goal shifts ≤3 cells and looks again every 2–3 s, at most `PATHS_A_TICK` 3 searches a tick. HUD writes go through `setText`/`setCls`/`setHTML` (no write when unchanged). `node tests/perfmatch.js`: Harbor 5.5% → 1.9% of a core.
- `classList.toggle(x, a || b)` with b undefined flips instead of setting: that was the flashing killcam button. Use a real true/false.
- `node tests/feeds.js` fails now and then (random operators), the same before these changes; `tests/stuckbots.js` too. Not looked into.

## Outdoor scenes and random map (2026-11-03)
- Outdoors (he asked; he chose solid cover): `shared/outdoors.js` `OUTDOORS[map]` = per spawn name a scene in that spawn's own frame (u sideways, v toward the building): `cover` (the two kinds `coverSpawn` uses, must fill an 8×3 slab), `ground`/`road`/`path`/`marks` (painted), `pieces` ([kind, u, v, lu, lv, block]: 1 solid, 2 low, 0 scenery; shifted or mirrored if they don't fit). `dressOutdoors` runs in `finish` after `coverSpawn`, then scatters per map and rings the floor with `edge`; report in `map.outdoors`. New drawings are `public/js/outprops.js` (`drawOutProp`, the `default` of `drawProp`). `FL.SNOW` (lodge: all grass becomes snow). Spawn names are the keys, so renaming a spawn needs the scene renamed. `node tests/outdoors.js`.
- RANDOM map (he asked; he chose: a surprise until the match starts): lobby `map` message with id `random` sets `game.randomMap` (snapshot `rm`), `startMatch` rolls a map other than the current one; picking a map switches it off. Free Play's card rolls on the client at `freeGo`. `RANDOM_CARD` in main.js. `node tests/randommap.js`.

## Batch of 2026-11-04 (long view, sniper scope, reach circle, shared guns, TV wide shots)
- Long view + sniper scope (he asked; his answers in docs/sniper-wip.md): down a long sightline the view slides out the way you face. Sniper Scope (`sniper` sight, only DMRs with rpm ≤ 300: Longbow, Pike): `#scopeVeil` (blur + dim round a clear lens, `scopeVeil()` in main.js, plain wash on Low), reticle in `sightLook`, normal crosshair hidden when `me.at` > 0.6, ADS starts at `ADS_START.sniper` 10 m. Shift while scoped = steady aim, Settings slider `steadySens`. GPU Firefox may lag on the blur: ask him.
- Aim-in distances by sight (he asked, 2026-11-06; +25% on 2026-11-09): `ADS_START` iron/red dot 5, holo 7, prism 11, scope 16 m; held wall: `wallHeld`/`st.wallHold`/`WALL_HOLD` 1.5 s in main.js (bullet stop cell's joined wall cells; blue = `wallBlue()`, then `adsReset` snaps the crosshair onto the bracket at any distance, he asked), marker = bracket in `crosshair()` (orange `#ff8a3d` / blue `#4fb3ff`); sniper = as far as you can see (second-longest of 5 sight lines in `adsReset`, up to its reach). Reticle always on the real screen: after the floor-edge clamp the camera block projects the crosshair through `tilt.project` (look.js) and slides the view so it is `AHEAD`×0.7 inside the edges.
- Sniper lens radius `scopeLensR` = 0.1 of the short screen side (he asked: a third of the first size).
- Sniper lens magnifies (he asked, he chose the lens only): `LENS_ZOOM` 3, `lensMag(at)`, `magnify`/`lensPt` in crosshair.js; main.js `scopeLens` draws map + #game into `#lensA` and the blackout into `#lensF` (greyed by CSS like #fog) inside `#scopeLens`, and magnifies #over in place; head zones go through `lensPt`. Armory magnifies its canvas the same way.
- Aim-in snap is a set distance per sight (he asked): `adsReset` puts the crosshair at `ADS_START` (sniper 20 m) whatever it was; a nearer wall stops it unless 2 of 5 lines over ±2.5° pass (door frames). Armory `adsAim` the same (clamped to the backstop).
- Less jumping view (he asked): `ENV_HOLD` 0.45 s before a body's room-size zoom takes a new size (`st.envBigT`); Crosshair mode keeps you (80 px) and the crosshair (AHEAD × 1.3) on screen in the camera TARGET (cx, cy, before the follow glide), the old hard `keep` only at the very edge (AHEAD × 0.8, tilt crops edges); `fitBoth` sizes the view to hold both on each screen axis; crosshair wall fade glides (`st.xhFade`). Measuring: rAF sweep of `aimTo` in free play logging cam speed (headless Firefox frames are uneven, ~100 ms ones, so single spikes after them are not real).
- Reticle never off screen (he asked 2026-11-06, he chose zoom): the fit block in the main.js camera sizes the view to hold you + crosshair (`fitBoth`) up to `FIT_MAX` 2000 world px, then `keep` slides; `freeMove` caps `aimOff` at the floor edge (`floorLim`, no hidden travel); `onScreen(x, y, m)` pulls a screen point inside the tilt-cropped screen (cursor/pad modes, last clamp). Drones use the same Crosshair-mode fit/keep with reach `DRONE_PING_R` 10 m (he chose; also in cursor/pad modes via `cursor()`).
- Reach circle: `AIM_REACH`/`aimReach` in shared/operators.js (metres per sight, hip 18 … sniper 48), `reachOf` in main.js (replaced `FIT_H`), faint dashed ring past 82% of reach in `crosshair()`; Armory uses the same.
- Shared gun setups: `resolveLoadout(op, l, guns)` + `own` in `cleanLoadout`, `store.setGun`, profile `guns`, `loadout` message `gun: {w, a}`, tick box `.attown` in ops.js. `cleanLoadout` must always return `own` (a missing one crashed free play switching). `node tests/sharedguns.js`, `node tests/freeguns.js`.
- TV wide shots: `tvDirector` picks `T.ovFloor` (floor weighed by players, fights ×3, plant/defuse; changes after 1.2 s clear lead) and `T.ovPts` (players there, those near enemies first); goes wide 5 s on a standoff (both sides close on one floor, nobody firing) or when quiet, `T.nextWide` 18–26 s apart (15 s after the opening shot, `T.opening`). main.js TV overview + `tvShotBox` use them.

## Faster pro practice (2026-11-04)
- He asked: a lot faster, more power allowed, and practice with each new gameplay change. The practice version is `PLAY_VERSION` in server.js (a fingerprint of every .js in server/ and shared/), not the git commit, so menu/art/sound changes don't trigger it. `TRAIN_WORKERS` threads (cores/4, 1–6, `R62D_TRAIN_WORKERS`) share the rounds at duty 1 (`workerData.duty`; `R62D_TRAIN_DUTY` still overrides). 200 rounds ~1 min on his PC (was ~15).
- The real saving: `angleOn` (which corner a bot watches) ran a full `findPath` and was 63% of practice; it now passes `cap` `ANGLE_CAP` 2500 + `near` (returns the way to the closest cell reached). `siteIntel` is cached per map build (`INTEL` WeakMap in shared/pros.js). Measure with a bot-only loop: ~0.35 ms a tick (was ~0.8).


## Batch of 2026-11-05
- Ground far below (he asked: the air round upper floors and the roof was black): `makeBelow`/`drawBelow` in mapdraw.js (the ground floor is drawn first, copied once at 1/5 size, dulled, box-blurred, indoor cells painted as roofs); void cells of floors above ground show it in the map picture, and the fog step draws it past the floor's edge (`st.belowOut` skips the black `floorRect` fill).
- Armory sniper: `drawSightLook` (moved from main.js `sightLook` to crosshair.js) shared with the Armory; armory.js `sniper`/`steadying`/`sway`/`veil` (`#armVeil`, same CSS as `#scopeVeil`), aim-in jumps to the targets' distance, options `steady`/`low` from main.js.
- `AIM_REACH` prism 36, scope 44, sniper 64 m (he asked; red dot/holo unchanged).
- Operator select (he asked): role icons `RI`/`roleIcon` in main.js (`.rIcon`), cards of the chosen role fill `.selLeft` 3 across with the ability line (`.more`).
- Rope: Space at a window swings in, smashing boards (`ropeWindowBoarded` in shared/map.js, server `startVault`), never up to the roof (sprint key goes up). Hip first shot: `HIP_FIRST` 0.022 rad cone in `spreadCone` (×(1-at)). TV: rings/armbands by side (`tvRing`, drawOperator `ring`; tv clip names by side). Pro stack waits: go × `DUR.action`/180, re-spot every 7–12 s (`ai.spreadFrom`).
- Hatch from below (he asked, he chose a small patch always): `hatchSight` adds `mask.lim` (opening + `HATCH_UP_SEE` 1 m) when looking up; physics `canSee`, `maskSees` and `drawHatchView` honour it. Aim-up pose (he chose: pose only): `aimUpHatch` in shared/map.js (crosshair on a hatch above, open: its 1 m ring), snapshot `au`, own `st.aimUp`, drawOperator `up` (short raised gun, bore, head back with face); `public/looks.html?up=1`. `node tests/hatchup.js`.
- Pros explore and learn loadouts (he asked: try new things, chase what is strong; 600 practice rounds): practice picks plans, operators, guns and attachments by `guess` in server/training.js (a draw from how good each might really be: little-tried things get wide guesses, winners high narrow ones). `training.guns` ('op|gun'), `training.att` ('gun|slot|choice'), `training.pro[name]` {ops, guns, att}, all [rounds, wins, kills, deaths], recorded in train-worker.js; `proLoadout` in bots.js (via `game.botLoadout(op, p)`) picks a pro's guns/attachments from them (wider guesses in real matches). `playVersion` moved to training.js; `node server/practice.js N` runs N rounds now into `$R62D_DATA` (not while the server runs). PLAYBOOK: click a player → `patchCard` in playbook.js (THIS PATCH: operators, guns, attachments on the main gun, team plays, each with a plain reason from the numbers).
- Practice never runs during a match (he asked): `matchOn()` in server.js, checked every 2 s while it runs. `playVersion` leaves out server.js, practice.js, training.js, train-worker.js, store.js, ws.js (`NOT_PLAY`), so plumbing changes don't reset practice.
- OPEN TO LAN follows the VPN (he asked): `/api/addr` reads the networks fresh each time, homelab VPN (`wg-homelab` / 10.10.0.x, `homelab: true`) first when up, other VPNs next, then cable, Wi-Fi; container/VM networks left out. `lanFill` in main.js redraws the dialog every 2 s while open (warning when the VPN is off); the lobby line refreshes every 3 s.

## Batch of 2026-11-05 (defender setup)
- Defender setup (he asked: fewer on site, rooms leading to it, no boarding yourselves in, rotations, busy prep; he chose bots only, usually 2 on site, maps unchanged): `defSetup` in bots.js (once per map build: `held` rooms = siteIntel `near`, `holes` rotation holes = 2 soft cells between a site room and an indoor room/corridor, `reserved` cells never reinforced, `siteBoards`/`outerBoards`/`traps`), `botPrep` now only plans `ai.tasks` (walk-to jobs, nearest first) run by `prepWork` (PREP + first 12 s of action unless heard), `reinforceTarget` (claims per map), `siteHot` (spotted enemy in/by the site or `game.lastDeath` there) → space/roamer `ai.rotated`. Def `ROLES` 2 anchor, 2 space, 1 roamer. Pros: 'layers' play, most plays 2 on site, turtle ×0.3, rotate on `siteHot`, every job but anchor rotates. `node tests/defsetup.js [level] [rounds]`.
- Health/snipers/headshots (he asked): `ARMOR_HP` 150/132/120 (+20%). `oneShot` on a gun (Pike, Saker) = a body hit with no wall in between kills (server `hitscan`), only `scopedIn` (sniper sight, `adsT` ≥ 0.6; he asked for a nerf after a prism Pike). `HEAD_AIM` 3 (was 4.5; drawn head still 4.5, he chose the middle two-thirds). Scope glare: `scopeGlare` in main.js (enemy `ad` + `aa` sniper, within `GLARE_ANG` of pointing at you, clear `castSight`, no smoke; `st.fakeGlare` for screenshot tests). Saker LR: `saker` in WEAPONS/SPRAY/gunart `G` (stock 'thumb', `brake`, `tan`: sprites.js drawGun keeps it tan)/audio `GUN_OWN`. `node tests/sniper.js`. Leftover ideas: docs/notes-next.md.
- Site vote (he asked; he chose: no overtime exists, so all sites reopen once each was played; binds people too; chat lines): `siteVote` in bots.js (called at the end of `nextRound`, not tutorial/free) = each defending bot `plainGuess`es the defence win rate per open site from `training.plans` (spread 1 for pros, wider by rank), says its pick, the leader says the result; `game.sitesUsed` (pushed in `beginPrep`), `siteOpen(n)` (also guards the `site` message), snapshot `su`, picker buttons `.used`. `node tests/sitevote.js`.

## Rank ladder (2026-11-06)
- He asked: Pros best, Silver/Gold = average casual, Diamond = dedicated effort, Champion = top 0.8% (he should stand no chance), Copper/Bronze still dumb. Aim times are his: from first sight (10 m, surprised) to the crosshair on the body with the reaction done, Copper 1.5, Bronze 1.1, Silver 0.9, Gold 0.8, Platinum 0.7, Diamond 0.5, Champion 0.3 s (`SKILL` react/settle/shake in bots.js; Pros ~0.2 s via `proSkill`, reactions kept ≥ 0.17 s for `tests/pros.js`). `node tests/aimtime.js [n]` measures them.
- Game sense by rank (`EAR`, `loud`, `WANDER`, `TRADE`, `WALLBANG`, `rankHabits`, `thinWalls` in bots.js): Copper/Bronze hear less, ignore team spots, reload at 85%, run in loud, wander off alone; trades for everyone (`game.proTrade` is now set on any enemy kill; Copper/Bronze charge, Silver+ walk in pre-aimed); Platinum+ back out of a losing fight; Gold+ (rarely) to Pros (often) shoot through ≤2 soft walls at spotted enemies within 12 m. `node tests/ladder.js [matches per step]`: each rank vs the one above (8 a step: 54–68% of kills to the higher rank; ±4% is luck).

## Look overhaul (2026-11-06)
- He asked (game felt flat, "a board game playing itself"; he chose fixed tilt + lean, raised walls, lamps + flashes, cinematic): `public/js/look.js`.
- Fixes after he played (all four he reported): only boxy things stand up (`BOXY` prop kinds, `riseOf`; round trees/rocks raised as square cells looked like slabs); he still saw walls snap between colour and grey, so walls in colour are now clipped to `sightClip` (vision shapes pushed 12 px on and raised at heights 0 / 0.7 / 1, like the walls), drawn over a full grey copy in `#fog` (`raise(c, "fog" / "lit")` in main.js); cars/crates/shelves (T.TALL) get their own clip, `sightClip(..., m)`, where a sight line ending in one is carried through to its far side (he asked: a car seen in part lit up whole; `litWalls` is gone); angled wall faces get their outward side from the piece centre and skip edges against more wall; indoor light ambient 0.64, neutral dark 0.5 (was 0.4, blue). Check on his GPU: Firefox as him on wayland-1 with `--remote-debugging-port`, `tests/shoot.mjs`; `grim` as him to see his screen; test hook `__r62d.aimTo(x, y)`. `lightMap`/`applyLight`: per-cell light (rooms ambient 0.4, ceiling lamps every ~9 cells flood-filled through openings, window daylight) as two 1-px-a-cell canvases stretched over every drawn part in mapdraw `regionPart` (`this.lm`, `looks.light`). `drawRaised`: wall/TALL cells get sides + tops raised by `h` 0.045 of the distance from `st.cam` (world space, so Rotate aiming works); cells in sight (`litWalls` from the frame's vision polygons, `vpolys` in draw) go on `#over`, the rest into `#fog` so its CSS filter greys them (`raise(ctx, which)` in draw). `tilt`: `#world` (wraps mapLayer/game/fog/scopeVeil/over) gets a `matrix3d` (7° + lean from screen speed + spring kick from own shots `tilt.kick` and `fx.shake`, scale 1.075); mouse positions go through `tilt.untilt`; `tilt.flat()` in menus. `html.tilt3d` adds the far-edge haze to `#vignette`; `#edgeBlur` backdrop blur on High/Ultra (`gq.blur`, `html.edgeblur`). Switches: `FX_OPTS` tilt / lean / walls3d / lights / blur. Low graphics: no raised walls (`raised: false`). Muzzle light r 115.

## Batch of 2026-11-09 (KESTREL, marker on people)
- KESTREL dart is thrown (he asked; he chose a little off, clear sight only): `useAbility` 'dart' makes a flying ent (`fly`, `ang`; ±0.1 rad, ±10% distance, `DART_MAX` 8 m, `DART_SPEED`), the 'dart' tick sticks it 3 px short of the first wall/barricade, then pings enemies within 170 px on its floor in `los` (smoke blocks). `node tests/oldops.js` checks stick, sight and scatter.
- Orange/blue marker stops on people (he asked): `st.rings` (everyone drawn but you), `freeAimPoint` stops `see`/`shot` at a `RING_R` 13 circle between you and the crosshair (`q.person`; not when the crosshair is on them); `wallHeld` holds on `'p'+id`; `adsReset` puts the crosshair on that person.
- Aim-in distance by gun and sight (he asked: gun the bigger part): `adsStart(sight, w)` in shared/operators.js = `ADS_OWN[w]` or `ADS_GUN[cls]` (iron-sight metres, 2-11) × `ADS_SIGHT` (1-1.8); sniper still `ADS_START.sniper` / sight-line rule. main.js `adsReset` and armory.js pass the gun.

## Batch of 2026-11-11 (status icons, TV flash, bullet trails)
- Status effects (he asked; he chose: shown to the side that caused it, TV sees all): server `effect(q, kind, dur, by)` in game.js sets the field the game reads (`EF_FIELD`: blind/stun → `stunUntil`, slow, snare → `clampUntil`, daze, deaf) and `q.ef[kind] = [until, side]`; snapshot players `ef` = `efOut(p)` [[kind, s left, side]]. Every stun/slow/clamp/daze/deaf goes through it. Client `drawStatus` in main.js (badges over the head, upright via `UP()`, ring runs down, `EF_COL`), drawn in the markers-above-the-blackout loop for people in sight or teammates. Free action `ef` (R62D_FAST only) for screenshots. `node tests/status.js`.
- Esports TV flash (he chose ring + glow): the `stun` event never whites out a TV viewer (`!st.tv`); a TV `boom` of kind stun adds two `fx.ping` rings; blinded players glow white on TV.
- Bullet trails (he chose: only in sight; a new Ammo slot): `fx.trail`/`drawTrail`/`TRAIL_LIFE` 0.45 s in fx.js, on #game under the fog; made fainter after he saw it (core ≤0.6 px, ≤0.42 alpha). `ATTACH.ammo` (none = Standard, `subsonic` notrail + range 0.8, `hot` dmg 1.05 / kick 1.1), 4th entry of `ATTACH_SLOTS`, every gun (`AMMO_ALL`); `gunMods` `notrail` → shot event `nt` → only the old 2-frame streak. `attCode` has 4 parts (old 3-part codes read as standard). Armory uses `drawTrail` too.
- `tests/prepff.js` fails now and then (1 in 3 or 4), same before this batch.

## Game modes (2026-11-12, he asked; plan in r6-todo.md)
- `shared/modes.js` `MODES` (menu order: QUICK MATCH, UNRANKED, RANKED, then FUN MODES: oitc, gungame, infected, zombies with `ready: false` until built). Server `game.mode` (lobby message `{t:'lobby', a:'mode', id}`, snapshot `md`), `game.rules` (tutorial/free/TV = `CLASSIC`), `game.ranked` is now `rules.ranked` (the old `ranked` message still works). Sides: `atkSquad()` = `attackSquad(rules, round)` (swap every round, or at half after 3 then every overtime round); `roundsToWin` (first to 4, 5 once it is 3-3; snapshot `ot`, `wr`).
- Quick Match help: `preBarricade` (2 site doorways from `defSetup(...).siteBoards`, exported from bots.js), site revealed at `beginPrep` (+ `found` card), client `beginnerHelp`/`tipNow` (`#tipNow`, `#leftCount`) only when `s.md === 'quick'`.
- Unranked/Ranked bans: `playerBanStep`/`playerBan`/`banning()` in game.js before round 1's picks (order ALPHA atk, BRAVO atk, BRAVO def, ALPHA def; `BAN_TURN` 15 s for a team with people, first click counts, time up = no ban; bot-only teams use `tvBanPick`); client `banPick` overlay (`#banPick`), banned cards greyed/struck in operator select. Snapshot `bn`/`bq` now also outside TV.
- Menu: `MODE_TAB` (play/unranked/ranked pages = the one lobby set to that mode, title follows `s.md`), FUN MODES page `renderFun` (`#funGrid`). The RANKED: ON/OFF button is gone.
- Compass: route moved to `shared/compass.js` (Dijkstra, 8-way, aims at the furthest route cell you could walk straight to, metres = real route length, stairs/hatch first with ▲/▼; needle glides). `node tests/compass.js` walks every spawn → site on every map following only the needle. `node tests/modes.js` checks the rules.
- Fun modes One in the Chamber / Gun Game / Infected: `server/arena.js` (`ARENA`, `LADDER`, `arenaStart`/`arenaTick`/`arenaKill`/`arenaDamage`/`arenaSpawn`, spawn spots away from and out of sight of enemies, 2.5 s respawn, 1.5 s spawn protection), hooked in game.js wherever `this.arena` appears (side(): free-for-all gives everyone their own squad `2+i` for the match, put back by `arenaEndMatch`; Infected = squad 0 survivors / 1 infected). No skills, gadgets, drones, going down. Bots: `arenaThink` at the end of bots.js. Snapshot players `ar` [kills, lives, gun step, infected, out], common `ar` {m, w, why}. Client: `arenaObjective`/`arenaScores`/`arenaTable`/`arenaPlace` in main.js, `html.arena` hides gadget/drone/team panels. `node tests/arena.js [map]`.
- ZOMBIES (he asked, Black Ops 1 style but all ours; he chose a New England harbour town): map `shared/maps/lantern.js` "Lantern Point" (`MAPS.lantern.zombie`, left out of `MAP_LIST`; 3 floors, sea all round via `sea` props, the kit's pad ring sealed as sea; zones 0-5 behind bought gates; `map.zombies` = gates/start/spawns (with `wake` zones)/guns/perks/crates/power/forge). Rules `server/zombies.js` (`ZB`, `PERKS` IRON HIDE / QUICK HANDS / SECOND WIND / DOUBLE BARREL, `roundSize`, `zombieHp`, flow field `field` toward standing people, `zombieThink` tears window boards (`setBoards`, 6 a window) then vaults in, `zbUse` = E to buy/repair, `zbStation`). Zombies are `p.zombie` players on squad 1 (people squad 0); game.js hooks where `this.zb` appears (people can't vault out of windows, guns/knives don't break the boards, no friendly fire, regen after 3 s). Client: `drawZombie` in sprites.js, `drawZbWorld`/`zbPrompt`/`zbHud`/`zbTable` in main.js, `html.zombies`, sounds in audio.js `play` (board, gate, perk, powerOn, forge, crate, zbRound, groan...). Helper bots use `arenaThink` (pick each other up, stay near a person). `node tests/zombies.js [seconds]`, `node tests/reach.js --map lantern`, `node tests/stairs.js lantern`.
- Zombies = Black Ops 1 rules (he asked 2026-11-13: identical gameplay and scaling; Kino's own layout/look declined, the town stays ours): server/zombies.js header lists every number (`roundSize`, `zombieHp`, `zombieSpeed`, `spawnDelay`, points 10/60/70/100/130, power-ups `POWERUPS` with the 2 % + growing points mark drop rule, last stand `zbDown`/`zbUp`, six `PERKS`, solo SECOND WIND 500 x3, grenades 2 +2/round, crate spin + take window, Forge take-back, board points cap 500, stuck zombies `respawnZombie`, latecomers join next round). Headshots on zombies are ×`ZB.headMul` (never the siege one-shot: hitscan branch `this.zb && q.zombie`). Wonder weapon `surge` (WEAPONS `zb: true`: kept out of Armory/free play/tests, crate-only via `CRATE_RARE`, burst `zbSurge`). Test shortcut `{t:'zbdev'}` only with R62D_FAST. Fun-mode bots search rooms instead of knowing where everyone is; Infected survivors hold a room (bots.js `arenaThink`). Measured with bots: Infected survivors win ~3/7, Gun Game ~3 min, One in the Chamber ~1.5 min (bots knife a lot).

## Smooth roofs and the 3D rope view (2026-11-13, he asked)
- Roofs: the fit zoom (`st.fitH`) grows at once but only shrinks after 0.5 s, gently; `winAimed` has a dead zone (`st.winAimedT`); the camera's allowed box glides (`st.camBox`, kept 0.6 s after a window view ends); the camera's sight lead and room zoom use `edgeSight` (stops where your floor ends, so open air past a roof edge doesn't swing the camera). Measured by a headless sweep across the roof edge: 4 back-and-forth jerks before, 0 after.
- Ropes on every outside wall: shared/map.js `addRopes` adds a drop ledge along every straight outside wall run above the ground; window ropes widen to their share of the run, runs without windows get plain wall ropes (`wall: true`, `cells: []`, `inside: null`; `windowFoot` returns null for them, `ropeAtWindow`/`ropeWindowOpen` false). Sideways neighbours `r.left`/`r.right`; server `tickRope` carries you onto the next stretch. 83–100 % of upper outside walls covered (gaps: angled walls, no ground below). A shot out of a window goes down once 1.5 cells past it (it used to fly along the new ledge strips). Inputs `rw` (along the wall), `rv` (up/down a floor, edge), `inv` (upside down, edge; `p.rope.inv`, snapshot `rp` 3, mine `ro[5]`, `ro[6]` = from). Thrown gadgets and breach charges work while hanging (`event` gadget rule, `tickPrep`). `node tests/rope3d.js`, `node tests/rappel.js`.
- Rope camera (he chose 2026-11-14: the separate 3D scene was too jarring a change of art style; he picked "tilted top-down"): `ROPE_3D = false` in main.js switches the 3D view off (code kept). On a rope `ropeFace`/`ropeCam` ease `st.rt` 0..1: `st.rot` turns so the wall is ahead (up the screen), the camera leans toward the wall (0.34 of the view) and in (view ×0.78), `tilt.extra` (look.js) adds `ROPE_TILT` 34°, and raised walls are raised away from an eye point behind you (`eye`, `ROPE_RAISE` 0.07) so they stand up toward you; `freeMove` turns mouse moves by `st.rot`. Climbing in, letting go or dropping glides back. Free climbing (he asked 2026-11-14: no floor-by-floor lift; he chose smooth + diagonal, R6's level rule, very steep window tilt, and ropes visible from the roof so a low peek gives you away; sideways play should beat vertical): E at the base puts you on the wall at ground height (`p.rope.h` = head height on the stretch's floor, `ROPE_HEAD0`); pushing toward the wall climbs, away goes down (bots/tests send `rc`), sideways is the physics slide, sprint climbs ×1.6, `ropeShift` moves to the stretch above/below, past the top onto the roof, down at the ground off the rope; `ropeLevel` (head in `ROPE_LEVEL` 0.26–0.74, upside down lowers it `ROPE_INV`) = the only time you and people inside that wall see/shoot each other (`ropeHidden` in hitscan, bots `visibleEnemy` incl. the window-down view, client `vis`/`wg`, your own view turned outward when not level), climbing in needs it. Snapshot players `rr`/`rz`/`ry`, mine `ro[7]` height `ro[8]` level. Client draws each climber's rope from the roof down (every stretch above, own floor while the head is below the lintel) with an orange ROPE label for enemies; `ROPE_TILT_WIN` +22° when level beside a window (`st.rtW`). Test shortcut free `hang` (R62D_FAST). `node tests/climb.js`. His next idea: more tilt for breaching, outside play, spotting gadgets (r6-todo.md).
- The 3D rope view: `public/js/rope3d.js` (OFF since 2026-11-14, see Rope camera above) (three.js 0.170, `public/js/vendor/`, MIT), driven by `rope3dFrame`/`r3on` in main.js for an attacker on a rope: builds the wall line round you (all floors) and the rooms behind its windows as instanced boxes (`surface` brick/plaster/concrete textures), people your side can see (`teamSees`: the same sight both ways) as sprites from `public/js/opart3d.js` (`opSprite(op, view, pose)`: front/back/left/right × stand/crouch/down/hang/hangInv, each operator's own colours, helmet colour sampled from their top-down picture). Camera close over the right shoulder; mouse = `rope3d.look`; crosshair ray → `rope3d.aim()` → `st.aim` + `aimOff` + `st.r3aim` (sent as ax/ay); a wall right in front aims along the camera instead. W/S/A/D/crouch become `rv`/`rw`/`inv`. Gliding in/out 0.45 s (ceilings above your floor hidden while it looks down); `#world` hidden while fully in 3D; `#r3x` crosshair. Test handle `__r62d.r3()`. GPU (headless gamescope, docs/performance.md): ~84 fps in the rope view, ~90–104 top-down.
- Bots rappel (he asked 2026-11-13): `windowPick`/`windowPlay` in bots.js (`WIN_CHANCE` by rank, `game.windowChance` forces it): climb to a window of a site room, shoot peep holes in boards, hang beside it and peek the tight angle (sometimes upside down), shoot with normal bot aim, smash in at `goAt`. `node tests/ropebots.js [matches] [map] [level]` reports climbs, peeks, sightings, kills from/on ropes (both ways now: 11 vs 21 downs/kills in 4 matches a map), stuck ropes. Climbers in top-down are drawn hanging (`drawHanging` in sprites.js, `hangWall` in main.js; snapshot rp 1 up / 3 upside down). Done 2026-11-13 (second session): the 3D view shows what top-down would show your side (main.js `r3sees`/`r3things`: smoke/gas puffs, gadgets/drones/cameras as their top-down pictures on the floor or wall, decoys, blasts with light + shake, bullet sparks; `r3overlay` = own canvas `#r3fx` for pings via `rope3d.project`, `hitMark`, `ptsPopups`, `screenFx` with the hurt arrow turned by `rope3d.facing()`); the look follows the game (`floorPics`/`groundPic` = the map picture via main.js `r3pic`, colours sampled from it, `massing` = rest of the building + yard cover, only boxy things stand up via look.js `riseOf`, fixed `LAMPS`, `SKY` per map); camera 1.7 m out / 0.8 m to the side, swaps to the window's side (`winSide`), aiming in moves it to your map spot at the wall (= the sight rules), own body fades over the crosshair. Test-only free action `ent` (R62D_FAST: gadget `ty` or `boom` kind at x, y). Screenshot recipe: scratchpad rungpu.sh style, docs/performance.md (headless gamescope). He has not played the 3D view yet. Operators in it are real 3D models (he asked 2026-11-13: much better, high resolution, in line with top-down): public/js/opmodel3d.js `makeOperator(op, gun)` builds one in code from the top-down data (uniformOf colours + a tiled pattern texture, accentsOf/SIDE_COL armbands and accents, OPERATORS helmet/colour, VEST cut, PACK back item, `H` = each operator's own headgear from the HEADGEAR descriptions, skin/hair picks, the gun from gunart.js `G`); `root.pose(name, t, moving, aim, lean, sprint)` = tactical stances (he asked: like people with thousands of hours on firearms, R6-style): bladed stance, rifle butt in the shoulder pocket (`userData.butt`), low ready / aimed with cheek on the stock / high port when sprinting, deep squat crouch, prone, down, lean roll, hang/hangInv; upper body by one matrix `U` from the hips, limbs by two-bone `reach`, `placeB` turns limb textures so the dashed pattern line runs down the front. Faces mostly covered (he chose): `FACE` per operator (gaiter, glasses, balaclava, respirator, surgical mask), `headBase` keeps bare skin plain (no cartoon eyes). Patterns as top-down: jacket `clothTex`, sleeves/legs `limbTex` dashes (SLEEVE); `mergeStatic` merges head/chest/gun parts; `ownMaterials`/`setOpacity` for your own fading body. Look at them on public/models3d.html (?from=&n=, ?ops=a,b, &pose=, &view=front|back|side|turn). The old flat opart3d.js is gone. Bodies v2 (he asked 2026-11-13: athletic, human, a specific body type each, nothing robotic or puppet-like; better clothing/equipment textures and colours): each operator is one continuous sculpted body, `SkinnedMesh` lofted in rings (`loft`: torso hips/waist/belly/ribs/chest/lats, neck, arms deltoid/biceps/forearm, legs glutes/quads/calf) on a 19-bone skeleton (`BI`), shaped by `BODY` per operator (height, woman, mass, muscle, shoulders, belly, legs; from each bio: Ferro demolition = heavy and powerful, Rally marathon runner = lean...); posing sets bone world rotations (`setW`, limb frames `fq` against the rest frame `qArmB`), IK with `reach`; vertex colours darken creases. Kit rides on bones (vest/pack on the chest bone, belt and hip pouches on the hips, kneepads, armbands (open `ring`), sleeve patches, gloves, boots). Surfaces: `surf(colour, kind)` = shared greyscale detail + normal maps (`detail`: fabric weave, cordura, MOLLE webbing, leather, shell), colours toned by `tune`. `vest()` wraps the sculpted torso (open bands for cummerbunds, hi-vis, jersey hoops). Look (he asked 2026-11-13: it runs fast, make it better; a reliably playable ~85 fps is all that matters, small swings are fine): ACES tone mapping, sun shadows following you (`SHADOW` map size by graphics level, none on Low), gradient sky that also lights the models (`skyLight`, PMREM), 4x wall textures with concrete seams; `noteFrame`/`Q` in rope3d.js = the keeper: lowers picture sharpness (pixel ratio, max `MAXPR` by level) when one frame in ten misses 85 or the screen's own pace, undoes steps that don't help; the 3D view rebuilds only when the map changes (`m.cv`, counted in main.js) instead of every 0.5 s (that was a hitch). GPU tests share his card, so numbers swing ~±6 fps between identical runs.

## Everything in perspective (2026-11-13, he asked; he chose everything at once, trousers tinted per operator)
- One rule for all things that stand up, the same as the raised walls: a point at height z (wall = 1 = 3.2 m) is drawn pushed away from the eye by (p - eye)·h·z. look.js `persp`/`setPersp(eye, h)`/`liftOf(x, y, z)`/`lifted(ctx, x, y, z, fn)`; main.js `draw()` sets it once a frame (eye and `RH` incl. the rope camera, 0 when raised walls are off). Killcam/TV replay/galleries stay flat unless they set it (looks.html `persp`, `eye`, `walk`, `pose`, `aim`, `tilt`).
- Operators (sprites.js): no more leg limbs; baggy deep-crotch trousers (`lowerBody`, 6 slices z 0→0.29, feet blobs merging into the hips, soft eased stride) in a dark neutral tinted from the operator's clothes (`pantsOf`); torso column 0.29→0.43, torso art at 0.45, arms/gun 0.42, head 0.53 (×0.66 crouched, ×0.18 prone/down/slide). Hanging climbers lifted by their rope height (`zb`). Head zones and person rings (`st.heads`/`st.rings`) are where they are drawn; `sendInput` un-lifts the crosshair point for head checks (`persp.h * 0.5`). People up on furniture are lifted 0.28 and drawn again on #over after the raised furniture (`st.upDraws`).
- Gadgets/drones/cameras/birds/defuser: `GZ`/`gadgetZ`/`liftDraw` in main.js (shadow under anything above 0.08).
- look.js raised pieces: low boxy furniture (BOXY list, `T.LOW` height 0.28; round things stay flat), window sill 0→0.28 and lintel 0.69→1, door lintel 0.72→1, barricade boards; pieces have a base height `f0` so their faces run f0→f.
- Measured: ~110–118 fps in free play with 9 bots on the GPU (headless gamescope); `tests/aim.js`, `climb.js`, `rappel.js` pass.

## More volume (2026-11-14, he asked: "go hard", more 3D to the 2D; smooth climbing; detailed building sides; smooth window entry)
- The eye (the point things stand up away from, look.js `persp`) sits `EYE_BACK` 0.75 view heights below the screen middle, like the tilted camera would see it, so everything (you too) shows its front; walls stand `RAISE_H` 0.06 per world px from it. Rope camera: `ROPE_EYE` 1.9 view heights behind you, `ROPE_RAISE` 0.13 (a low over-the-shoulder angle), glided by `st.rt`; letting go / climbing in glides back slowly (`ropeCam`, rate 1.9 out, 4.5 in).
- Operators are solid: `column()` in sprites.js (two ellipses joined along their sides, shaded across) builds boots, legs, hips, belt, jacket, plate carrier, neck and head under the usual top art; hanging climbers stand upright against the wall (`hang`, `bodyA` = the wall), a hand up the rope, back plate and pack as a block. Menus/killcam/Armory draw with their own perspective (`withPersp`, `showcase` = three-quarter view for the Operators page).
- Building sides: look.js `facade()` carries every outside wall of an upper floor (and the roof's edge, `under`) down storey by storey (wall, glass window, doorway, faces with negative heights), and in the rope view the storeys above (group 2, `cellAbove`, faded by `st.rt`). `deco()` draws surface lines on lit faces only: brick courses + joints, concrete formwork + tie holes, plaster plinth/cornice outside and skirting inside, window frames/bar/glint, board gaps, sill lips. Low tops (sills) are drawn before faces (`lowTops`); boards have no top.
- Lit walls: `sightClip` sweeps the (thinned, `thin`) sight outline from the lowest to the highest height drawn (ends + one band per edge, all wound one way); on a rope `addSpots` keeps the wall in front of you in colour.
- Climbing height glides: `st.ropeH` (yours), `rz` interpolated in `interp` (others).
- Floor gadgets/defuser stand on a solid body (`GB`, `gadgetBase`, `liftDraw(..., base)`).
- Frame rate (headless gamescope, his kind of GPU): standing ~125-132 fps (as before), on a rope ~92-102 (was ~150; the rope view draws much more).
- Rope view, round 2 (he played it 2026-11-14): walls in colour only where the cell in front of them is seen (`seenGrid` from the frame's sight shapes, grown 1 cell; `raisedFrame(..., seen, spots)`), drawn back to front in `BAND` 48 px bands from the eye (furniture, then walls, per band); this floor's lit pieces still clipped to `sightClip` (sweep 0..1 only); storeys below/above (`fac`/`up`) and the outside wall round a climber (`spots`) by the seen grid alone. `tilt.update` grows its scale until all four layer corners are off screen (no lit sliver). `groundBelow` in main.js draws the ground floor's picture under an upper floor's outside walls, scaled toward the eye by `1 - RH*storeys` (`gnd` faces → `rf.ground`). Climbers hang from a hip harness (tether + carabiner, rope drawn up the wall face in perspective, both hands on the gun). Rope camera: `ROPE_ZOOM` 0.5 (applied before the crosshair fit), `ROPE_SIDE` 0.12 over the right shoulder, no sight lead, the fit on a rope = 2.6 × your distance to the crosshair, keeps you (not the crosshair) in shot. `winAimMarks`: dashed lines from your eye past the window's two edges (orange when the crosshair is outside). F slides down (`ROPE_SLIDE` 0.45 s a storey), Space climbs/swings in. Leaning works on a rope (physics `stepMove` rope branch).
- Lean and legs (he asked: natural bend, balance, footwork, real biomechanics): `hipShift(p)` in sprites.js (hips shift against the lean, sway over the weighted foot when walking), the torso columns bend from the hips to the leaning shoulders, the lean-side foot steps out.
- Rope camera, round 3 (he asked: aiming far made walls super tall, at the wall super flat; tight when peeking, wide otherwise): the eye's distance comes from `st.ropeBaseH` (the view before rope zoom and the crosshair fit, glided), so aim never changes the perspective; `ROPE_RAISE` 0.1, `ROPE_EYE` 1.6. `st.rpk` (glides 0..1: level with a window you hang at) blends `ROPE_ZOOM_NAV` 0.12 (getting about) to `ROPE_ZOOM` 0.38 (peeking), leans the camera further in (0.3 → 0.44 view heights) and makes the crosshair fit tighter (2.6 → 1.35 × your distance to it). Rope frame rate ~85-93 when not peeking (wider view).
- From watching him play (2026-11-14; frames kept in screenshots/his-play-2026-11-14): `groundBelow` now draws the blurred view far below (`drawBelow`: buildings as roofs; the raw ground picture showed rooms and desks through the roof); `drawWindowView` (looking down out of an upper window / off a roof edge) is shrunk toward you by `1 - persp.h*storeys` (`st.winKp`; shrunk toward you so directions stay true; `sendInput` scales the crosshair point back when `winAimed`) so it lines up with the walls going down. Ropes: no automatic detach (bottom: stay clipped in at ground height; top: stay on the wall); F slides down and unclips; Space climbs in only in `ropeVaultZone` (shared/map.js: the middle ~35% of the window) and level; at the top of a roof wall, not level, Space goes over onto the roof (prompt "ONTO THE ROOF"). Roof bots press Space at the top and F to leave (bots.js `roofPlay`). `tests/roofbots.js` and `tests/ropebots.js` crash now and then in `hitscan` → `damage` (seen before these changes too; not looked into).

## Batch of 2026-11-14 (evening; his 18 items, item 7 scrapped by him)
- Fun modes: dead in a free-for-all mode (One in the Chamber, Gun Game: squads `2+i`, no mates) you spectate `st.killedBy` (set from the `kill` event), else anyone up, else your own spot (`s.ar` branch of the spectate block in main.js). Before, `view` was null: whole map lit, far out (his "map zoomed in, characters tiny"). Test-only `{t:'dev', a:'die'}` (R62D_FAST) in game.js.
- Team colours: `public/js/teamcol.js` (`COLS` ally/enemy/atk/def as CSS vars `--ally`, `--allyL`..., `setCols`, `SWATCHES`, `BOT_PAIRS` + `squadCol`/`squadName`); `SIDE_COL` in sprites.js reads `COLS`; Settings page COLOURS (`.swatches`, `renderCols`, saved in profile `cols`). TV: pros `PRO_TEAMS[].colour` (Northwind `#9b5cff` purple, Ironclad `#ffe03a` yellow; he chose 2026-11-15: never green, black, white, orange, red or blue), bot pair `game.colPair` → snapshot `cp`; `tvRing` returns the squad colour; TV score boxes/comms get `--tc` (tv.js tvHud).
- Bots lean away from cover (`leanSide(game, p, a, tgt)` in bots.js checks the leaning head sees the target); `node tests/leanside.js`.
- Pro drills, patch notes, pro views: see docs/drills.md (`server/drills.js`, `shared/maps/drill.js`, `drillThink`/`setPro` in bots.js, `addDrills`/`learnStyles`/`drillMul`/`DRILL_STYLE` in training.js, `server/opinions.js`, `shared/patchnotes.js` — add a line there for every gameplay change). Ball Knowledge tabs (`TABS`, `renderMore` in knowledge.js; `drillSkills` exported for playbook.js `drillsOf`/`takeOf`). `makeMap` allows no upstairs (no roof). `MAPS.drill` is `zombie: true` so it stays out of `MAP_LIST`.
- Rope aim-in: `st.rads` (aimed in on a rope) → no `adsZ` widening, `st.fitH` held, view ×(1 - `ROPE_ADS`), `aimOff` capped to the view, camera leans in a bit more.
- Rope framing blends by `st.rt` (was a switch at 0.5: the zoom pumped going over onto a roof); `st.fitDown` frozen while `st.rt` glides.
- Hatch / stairs views a storey down/up in perspective (`kp` = 1 ∓ persp.h; `st.hatchKp` boxes turn the sent crosshair back in `sendInput`). `groundBelow` (main.js) now also fills all open air round an upper floor/roof (`solidRuns(fi)` evenodd clip, `sc` sight clip in the lit pass); storeys counted from `m.groundFloor`.
- Light shading: look.js `lightMap` returns `lv`/`grad`; `faceLight` shades raised faces by where the light comes from; a soft contact shadow on the floor away from the light (in the `dark` canvas).
- Names over teammates never bigger on screen than at a normal zoom (`nk` in draw).
- tests/roof.js and tests/rope3d.js climb the current way (rc up, `vault` event at the top).
- Later the same evening (his live notes while playing):
  - Bodies: look.js `liftBody` caps a body's own height at `persp.cap` (main.js `BODY_CAP` 300 world px from the eye, lifted in the rope camera); sprites.js `LZ` = wall-rule base (rope height `zb`) + capped body; head zones and the sent head point use the same (`sendInput`).
  - Rope camera: `ROPE_ENV` fixed framing size (no room/sightline zoom on a rope), the crosshair fit never grows on a rope (`need = fb * (1 - rtw)`), `aimOff` capped to the view; `freeAimPoint` on a rope: no wall stops (`see = shot = l`), `adsReset` does nothing on a rope; `ROPE_TILT_WIN` 0 (he said the extra tilt squeezed the picture).
  - Lean on a rope: sprites.js `TILT` 0.42 rad round the hip point (`tiltPt`), no sideways shift.
  - Climbing out: shared/map.js `ropeOutAt` (attacker just inside an upper window with a rope, facing out) → server `startVault` vault with `rope` → hang level at the end; client Space sends it. Window helper `winGo`/`drawWinGo` in main.js, `#winGo` (gold = Space works, grey `.wait` = what is missing). Sprint ×1.6 along the wall (physics rope branch). `node tests/ropeout.js`.
  - mapkit.js `windowJambs`: `JAMB` 2 wall cells each side of every window are concrete.
  - Thinner-looking walls: look.js `WALL_INS` (0.2 cell), `thinOpen`/`wallIns`; faces, tops (runs carry `iN/iS/iW/iE`), doorway tops (`DOOR_TOP_A` 0.5 see-through) inset; mapdraw.js `thinStrips` paints the neighbouring floor into the strips; lightMap gives wall cells the darkest neighbouring room's light. `st.ghostDraws` + `GHOST_A` 0.38: people you see redrawn faintly over the raised walls.
  - `tests/spawnsafe.js` fails on Dust Town (defender bots outside in preparation) since before this session; not looked into.
  - Defenders' preparation area: shared/map.js `prepBox(m, site)` (`PREP_PAD` 12 cells round the site rooms, every floor but the roof) → `game.prepBox` (beginPrep), `mods.box` for defenders in PREP; physics `stepMove` wraps `stepMoveFree` and slides along the box edge (`inBox`: also no T.GROUND); bots `boxGoal`; client draws PREPARATION AREA from `me.m.box`.
  - Rope reach: `ROPE_REACH_X` 8 m added to the rope crosshair cap and to `st.trackHH`; on a rope the camera keeps the crosshair (not you) inside, `onScreen` margin 0.28 of the screen height.
  - Smoke: drawn on #over (after the blackout) when you have a line to the cloud (`clear`), into `smokeCv` at 1/`SMOKE_DIV` size, `SMOKE_COL`.
  - Furniture: look.js `FURN` (kind → [height, 'legs'|'solid', side colour]), `propGrid`/`furnOf`, `legsOf` (shadow at floor, 4 legs, top edge) in the block builder; `furnTop` for people standing on furniture (main.js `fTop`).
  - Window boards: their top comes from the map picture (look.js pieces, `base[0] === 122`), and window lintels are half see-through like doorways (`lintel`, `DOOR_TOP_A`).
  - Boards seen from the side: look.js `boardLook` (stage from `m.hp`, holes from `m.holes` placed along the face), deco 'w' cracks by `F.st`, `G.holes` dark punctures; board tops in `G.under` (drawn before the wall tops). The drawn map is `st.rend.map` (st.known), not st.map.
  - Tilt zoom: look.js tilt.update finds the covering scale exactly (`fits`, bisection) and glides `this.sc`; sway `calm` on a rope. Rope aim: shared/map.js `ROPE_AIM`/`ropeAimLimit` (server input handler, client `ropeOf` in main.js).
  - On a rope the upper body turns with the aim (sprites.js: `ctx.rotate(aim - bodyA)` before the back gear when `hang`), hips and legs stay to the wall.
  - Body heights (sprites.js): shoulders/torso art 0.41, jacket top 0.40, arms 0.38, neck 0.40-0.45, head 0.44-0.49 (was 0.45/0.44/0.42/0.44-0.49/0.48-0.53); main.js rings 0.37, heads 0.49, sendInput 0.46. Rope wall: main.js `ropeWallSpots` (whole stretch + neighbours as seen spots).
  - Marker: `freeAimPoint` returns `mk` (the wall/person before the crosshair where bullets stop; on a rope cast from 2 cells out so the wall you hang on is skipped). He does NOT want it past the crosshair. `wallHeld`/blue snap use `q.mk`, `drawBracket` shared.
  - Marker barrier (freeAimPoint `mk`): sight ray (soft walls/boards count) + LOW furniture higher than your eye (`EYE_H` by pose / 3.2 vs `furnTop`; prone sees under `underAt`), exact edge by bisection; `mk.nx/ny` = the face hit; `drawBracket(ctx, gx, gy, ux, uy, tx, ty, now)` along the face; `WALL_TILES` includes BARRI/BEAM/LOW for the blue hold.
  - Preparation area: only Dust Town uses the site box (`game.prepSiteBox`, outline via mods `boxShow`); every other map: all non-roof floors (inBox already forbids open ground), and `startVault` refuses a defender vault out of it in PREP.
  - Raised-wall area follows the tilt (main.js: screen corners through `tilt.untilt` → `wx0..wy1`, at most 4× the flat box). Window lintel: only its top see-through (`seeFace` = doors only); board tops (`G.under`) drawn before the faces.
  - Aim smoothness: crosshair gap glides (`st.gapShow`, 70 ms, opens at once); bots' hand drift `handDrift` (bots.js: piecewise steady drift, 0.1–0.18 s, ±0.145 × shake rad/s).
  - Outdoors: mapdraw.js `groundDetail` (blotches + per-ground-kind marks, from `hash`), textures.js radial gradients fade to their own colour (black left grey rings). Outside walls: look.js deco for `F.e` faces (grime, drainpipe/vent/lamp/sign by cell hash).
  - Quick Match pre-boards credited to the defenders (`this.by` round `preBarricade`).
  - Rope wall order + starting boards (2026-11-14, he saw crates through the wall and boards popping in): on a rope the outside wall group (`fac`/`up`) is drawn after the lit bands (main.js raise, look.js `drawRaised` `outer()` last in the `all` pass); `beginPrep` boards windows with `this.by = 'all'` → snapshot `cb` 3 = known to both sides (client `applyKnown` accepts 3); `cellSeen` counts `st.wallSpots` as seen on a rope.

## Graphics pass + VPN check (2026-11-15, he asked; he watched nothing, I played it on his GPU in headless gamescope)
- The full draw order, bottom to top, is `docs/layers.md`. Keep it current.
- Vehicles are raised as their own body (look.js `VEH`/`vehOf`: insets, corner cut and paint per kind, matching mapdraw/outprops pictures, dark tyre band), railings as a rail on posts (`railOf`): raising whole cells lifted the ground round them ("cars on platforms", he saw). Container/dumpster sides now their painted colours.
- Views onto a LOWER floor (stairs down, hatch down, out of a window) are drawn before smoke and the raised walls; views onto a HIGHER floor after them (`drawStairView(..., up)`, `drawHatchView(..., up)`). The stairs view is clipped to the stairwell strip (`STAIR_SEE` 4 cells past the far end, 2 cells each side), label at its far end.
- Upper floors: the camera may go 0.6 of the view past the floor's edge (the ground below fills it), like phones.
- Outside staircases have a style (`stair(..., sty)` in mapkit.js; `STAIR_STY`/`styledStairs` in mapdraw.js, raised sides `RAIL`/`stairRails` in look.js): Harbor `steel`, Depot `rust`, School `green` fire escapes, Embassy balcony `stone`, Lodge `timber`, Embassy/Villa garage `ramp`. He said: depends on the map, fit the building and the stairs' position.
- New checks: `node tests/solidsight.js` (no sight line through a solid wall or between floors), `node tests/vpnplay.js [lagMs]` (two players join over this computer's VPN address with lag and play into a round). VPN state 2026-11-15: wg-homelab up, handshaking; Lando's homelab R62D (192.168.1.76:6262) was not running; firewall 6262 open here. Over plain http a controller may not work in some browsers (the Gamepad API wants https); keyboard and mouse are fine.

## Up-to-date sweep (2026-11-15, he asked: every menu tab, the tutorial and anything a player touches matches the current version)
- Opened every menu page headless (no errors). Fixed stale text: tutorial coach (rounds/modes, 2:40, sprint/slide/lean, ping wheel/map, free rope climbing, unlimited barricades, prep area), the TUTORIAL page info (modes + an UP AND DOWN box), Controls page (prone, lean, vault, slide, ropes, camera lock), loading tips (one-run tutorial, ropes, hatches, ping wheel, camera lock, dead zone), Map Knowledge rope text, Crosshair aim hint. When adding a feature a player uses, also update: tutorial.js STEPS, index.html `.tutInfo`, `renderControls`, `TIPS` in main.js.

## Pros' complaints + TV director pass (2026-11-15, he asked)
- Pro opinions (server/opinions.js) judge fairly now: main guns against their side's main guns (kills and wins), operators against their side's average (500 rounds), attachments against the other choices for that slot, plus a 'sides' view. Anvil Slug 66 damage, Drummer LMG 21 dmg / 800 rpm. Findings and the side imbalance (attack ~44%): docs/balance.md.
- Esports TV director (`tvDirector` in public/js/tv.js): distances in the building frame (`localPos`; a floor between = `VERT` 140 px) so fights on stairs, through hatches, windows and from ropes count; sight between enemies (`los`) makes contact more urgent; in preparation attackers are scored at their drone (`drones` from snapshot ents `ow`); ropes +10, level with a window +26; a plant or defuse starting is cut to at once unless the current player is mid-fight; busy actions weighted (plant/defuse 120, revive 60, setting up 20 in prep).

## Batch of 2026-11-15 (evening, he asked)
- Attack should win 45-55% on every map (his range; docs/balance.md has the measurements; `tests/probe.js` prints per-site results, `R62D_TEST_TRAINING` = a copy of real practice for trained pros, `R62D_REINF`/`R62D_PREP` test knobs).
- Villa: south balcony along the Kids Room with glass doors (`U.door(19, 41, ...)`), north terrace + stone steps into the Master Bedroom.
- Rat spots (he asked: places to hide that punish not clearing angles; he did NOT want a stealth/visibility rule): mapkit.js `ratSpots` puts a tall cabinet one cell off a corner in bomb-site rooms and rooms a door away, leaving a 2-cell nook no doorway sees (`map.rats`). Defender bots sit in one sometimes (`ratHold`, 25%, pros 15%); attackers who know the map check them (`threatPoint`).
- +3 defender cameras a map (`addCams`/`EXTRA_CAMS` in shared/map.js: biggest camera-less rooms a door from a site; wallMount mounts them).
- Long hallways (he asked: at most 2-3 super long indoor angles in the game, Dust Town free): `K.baffle` (mapkit.js, brick, `keepSoft` so hardenWalls never turns it to concrete) chicanes in Harbor Main Hall, Embassy Tunnel and Upper Corridor. Kept long: Harbor 2F Corridor, Embassy Grand Corridor, School Upper Corridor. `node tests/longsight.js [metres]` (20 m: must PASS with ≤3).
- PERCH: the bipod is gone (he said it made no sense); Overwatch (`overwatch`, `OVERWATCH` in constants.js, ent `watch`): a locked 30°/30 m/20 s cone where he aims, drawn for his team (main.js markers section, world coordinates), pings defenders who enter it (once per entry). Bots lock it on their held angle.
- Plant anywhere within `PLANT_R` 5 m of a bomb marker inside its room (`plantBomb` in shared/map.js; server, prompt, `plantArea` outline in main.js); the defuser lands where planted. `node tests/plantzone.js`.
- Defuser request: `defreq` message in operator select (`p.defReq`, snapshot `dq`, REQUEST DEFUSER button in `#siteChoice`); beginPrep gives it to a random asker, else anyone; reset each round. `node tests/defreq.js`.
- Fixed a server crash: `ropeFall` for a climber killed mid-move between rope stretches.
- Lodge east balcony (Office door + breakable `baffle` wall, window removed: it made the balcony a shooting gallery) and west balcony (Games Room); School second green fire escape into the Staff Room and a Library → Clock Room staircase; Depot rust walkway + steps into the Manager Office.
- Default loadouts = the pros' meta (he asked): `server/metaloadouts.js` (`computeMeta`/`refreshMeta`) fills `META` (shared/meta.js, the shipped copy) from practice; the server refreshes it at start-up and after practice and serves `/api/meta`, which main.js loads into META; `defaultLoadout`/`defaultAtt` in shared/operators.js use it. Operators page tags them PROS' PICK (gun) and ★ (attachment). His profile Inabush had its saved loadouts and gun setups cleared (backup `profiles.json.before-meta-defaults-2026-11-15`).

## Batch of 2026-11-15 (late, he asked)
- Ball Knowledge: every tab lists most to least % (guns by rounds won, attachments by `rec`, maps by attack win %, drill pro cards by drills won; operators already were).
- Revive reach `REVIVE_REACH` 34 px on the server (the client prompt is 26 on interpolated positions, so the server is a bit more generous); `node tests/revivetrap.js` revives on every trap/gadget kind.
- Main menu `⬇ DOWNLOAD FOR WINDOWS` (`.dlNav` in `.hsmall`): links to the newest GitHub release's `R62D-windows.zip` (`releases/latest/download/...`), so a friend can play on their own computer with no VPN. Hidden in the program / kiosk (`html.inapp`, set from `inApp()`) and on phones. Release a new build (`desktop/release.sh`) when the download should catch up.

## Replays (2026-11-15, he asked; he chose: whole matches, only Quick Match / Unranked / Ranked, watched like Esports TV, video = the whole match)
- Server `server/replays.js` (in `NOT_PLAY`): `startRec` (end of `startMatch`; only those modes, not tut/free/tv, and only with a person playing: `p.sock`, tests set `g.recBots`, so pro practice never records), `recFrame` (end of `broadcast`: `common` + `m` = every alive player's `mine`; `mine` is built for all while `this.rec`), `stopRec` (MATCH_END after one last broadcast; `resetToLobby` = abandoned, kept if a round finished). Files `$R62D_DATA/replays/<id>.r62d` (gzip lines: header {r62d, v = playVersion, map, mode, date}, then snapshots) + `<id>.json` card. `prune`/`listReplays`: newest 3 of the current gameplay version, others deleted. ~1 MB for a 6-minute match.
- Playback `ReplayView` (server.js `/ws?replay=<id>`, `replayViews` ticked in the snapshot step on the real clock): join → `welcome` (tv: 1, map at the start) + `rpinfo` {d, rounds}; snapshots like Esports TV with `you` = followed id + their `mine` and `rp` {at, d, p, s, e}; frames skipped at high speed merge their cells/holes/events. Messages `{t:'rp', a:'pause'|'speed'|'seek', v}`, `{t:'tv', a:'follow'}`; seek sends `rpmap` (map rebuilt from `buildMap` + every change since that round's `mv`). HTTP `/api/replays`, `/api/replay/file?id=` (download .r62d), POST `/api/replay/open` (an uploaded file, kept in memory, refused if out of date).
- Client `public/js/replay.js` (`initReplay`, `renderReplays`, `#rpBar`, `#rpDl`, `key`, `onMsg`/`onSnap`, `window.__rp` for tests): REPLAYS in `#mnav` → `#tab-replays`; WATCH = `switchMatch(null, null, {replay: id})` (`st.tv.replay`, `html.replay`, connect mode 'replay'); main.js `takeMap` = the welcome map path, reused for `rpmap`. Keys: Space, ←/→ 10 s, , . speed (before TV's 1-0/A/M). Video: `getDisplayMedia` (needs a click and a secure page: localhost or the program) + `MediaRecorder` webm from a seek to 0 at 1× until `e`, `html.rprec` hides the bar, REC tag 3 s + title, Esc cancels. Windows program: `setDisplayMediaRequestHandler` in desktop/main.js gives its own window (+ loopback sound) — only in a new full download, not yet tried on Windows.
- `node tests/replays.js` (record, follow, speed, pause, seek = exact map, end, open file, keep 3, out of date). Headless video test: Firefox prefs `media.navigator.permission.disabled` + `media.navigator.streams.fake`, and a `tests/shoot.mjs` step with `"act": true` (user activation).

## Android app + Windows build 476 (2026-11-16, he asked: a mobile download so he can play on Android)
- `android/` (see android/README.md): a ~70 KB APK, built without Gradle by `android/build.sh` (SDK tools from `android/sdk.nix` through Nix), signed with `~insideabush/.local/share/r62d/android-release.jks`. Start page finds games on the phone's networks or takes a HOST code, then shows the host's game in a full-screen web view (`window.r62dApp` bridge: quit, exit, nets, version). Phones can't host.
- Main menu `⬇ ANDROID APP` (`.dlAnd`, `html.android` from the user agent in main.js): shown on computers and Android phones, hidden in the apps. `desktop/release.sh` builds and attaches `R62D-android.apk`.
- Not run on a real phone or emulator (no KVM here); start page tested in headless Firefox against a server: finds it, joins it, refuses a wrong code.

## Roof hatches over top-floor sites, wider resting view (2026-11-16)
- He chose "attack from the roof" for the weak upstairs sites: see docs/balance.md (2026-11-16), `siteRoom` hatches in mapkit.js, `ROOF_SITE` in bots.js.
- Resting view 20% further out (he asked; he chose: only the room-size resting zoom, for your character and Esports TV / replays; not drones, cameras, the rope view or phones; the long-sightline zoom-out and the aim-far fit keep their limits): `REST_ZOOM` 1.2 in main.js, applied to the body's room-size `want`.

## Android app plays the whole game (2026-11-16, he asked: no computer needed; phones get the rest of the game when the app opens)
- public/phone/ (server.js, shim.js, node/*), the app's file serving + game packs updater (MainActivity.java), PLAY ON THIS PHONE on the start page, `tests/phonehost.mjs` to try it on a computer. Details: public/phone/README.md, android/README.md.
- Packs carry `"android": 1` in desktop/build.json (`ANDROID` in desktop/build.sh). The old app (build 476) can't update itself: main.js asks it once to download the new one.

## Phone controls for two thumbs (2026-11-16, he asked: play it with thumbs, maybe a gyroscope; fix what two thumbs can't do)
- `tests/thumbmatch.mjs` plays a whole Quick Match by two simulated thumbs on the phone version (tests/phonehost.mjs) and counts moments a third thumb was wanted; `SCENARIO=fix node tests/thumbs.mjs` checks the fixes with a dummy.
- Found: AIM had to be held (a third thumb in a fight), AIM/CROUCH were under the aiming thumb, auto aim precision is not thumb precision, chat covered the left buttons, the Quick Match START was below a phone screen.
- Fixed: AIM is a tap switch (sprint turns it off) and sits with CROUCH above LEAN for the left thumb (`lb` buttons in touch.js / style.css); auto fire (`autoShot` in main.js, `r62d-autofire`, on by default on phones) fires while the aim is within the aim help's 0.06 rad of a seen enemy; gyro aim (`gyroMode`/`gyroSens`/`gyroInv` in touch.js: turn rate round gravity from `devicemotion`, applied in `pollPad`, default while aimed in); phone chat = last 3 lines at the top middle, `#leftCount` smaller; Quick Match bottom bar pinned on phones.
- Compass (he asked, same day): the bomb site's name and floor beside the needle (`.cmpSite`/`.cmpFl`, "YOU 1F" when you are elsewhere); on the bomb's floor it points straight at the nearest bomb, from other floors along the route to the stairs or hatch (label says which). HOIST with grapples left: open hatches are ways up (`hoistLinks` → `C.cmpUp` in shared/compass.js). Hatch overlay `drawHatchMarks`/`hatchUse` in main.js: Breach Charge / Nitro Pack carriers, EMBER, DEADFALL see hatches in their floor; HOIST sees ceiling hatches (not HAMMER, SALVO, FERRO: they hit hatches directly). Phone: compass left of centre, chat right of it.
- Phone USE is a tap that carries on (plant, defuse, reinforce, revive) until done, tapped again or you move (`useLatch` in touch.js, `busy` from main.js).
- CROW (he asked, same day): the skill key again lunges once the blade is ready (melee still does); `lg` in his own data (marked id, s to ready, s left); a blade mark over every enemy he sees and always over the marked one, with the distance, green inside `LUNGE_M` (now in shared/constants.js) and LUNGE READY / BLADE OUT / GET WITHIN text. `node tests/newops.js` checks the second press.
- Aim marker (he asked, same day): `freeAimPoint` refines the marker to the hit cell's true edge plus the drawn wall inset (`wallIns` from look.js) and keeps the hit thing's height (`mk.z` = half of `furnTop`), drawn there; `WALL_HOLD` 0.6 s (was 1.5); `blueUtil` = an enemy camera / drone / gadget within ~1.2 m of a blue marker (or just ahead on the aim) in clear sight: blue ring + label, `adsReset` snaps onto it (`__r62d.adsReset` for tests).
- Phone zoom = PC zoom (he asked, same day): phones default `viewMul` 1 (was 1.35) and get `REST_ZOOM` like computers.

## Change history document (2026-11-16, he asked: every change by date, very detailed, viewable in Google Docs, kept up to date in Documents)
- `tools/changelog/make.cjs` builds `~/Documents/R62D Change History.docx` from the git history (Part 1, by day, his requests and everything else that changed the game; planning/idea-list commits skipped by `SKIP`) and the Done list of r6-todo.md (Part 2, oldest first). Day summaries in `tools/changelog/days.json`: add a line for each new day when its work ends (days without one get their first changes). `tools/changelog/update.sh` runs it as him (docx npm package kept in ~/.local/share/r62d/tools); `.git/hooks/post-commit` runs it after every commit (not in git: recreate it if the clone is new), play.sh runs it with `--if-old` when the game opens.
- Phone buttons as pictures (he asked, same day: the word buttons on the right were big and in the way): `ICONS` (inline SVG) and `HELP` in touch.js, small round buttons (`.tbtn.ico`, 50 px; FIRE 80; USE/VAULT 64; top row 42), a ? button (`help`) opens `#tHelp`, the guide naming every picture (a tap closes it). `SCENARIO=fix node tests/thumbs.mjs` shoots it.
- Window glass (he asked, same day): `windowGlass` in shared/map.js (outside windows, `m.glass` per cell, built with the map), server `glassBreak` (first damage: damageCell, holeCell, destroyCell, barriShot, barriHit) → event `glass` (cells) and welcome `gl` (already broken); client: `audio.shatter`, `fx.shatter`, `glassGoneAt`; drawn by mapdraw `glassPane` (flat, over the boards; scattered shards only once gone) and look.js `PANE` pieces (see-through face with the existing 'g' glass detail).
- A / D sprint (he asked, same day: should work exactly like W and S): `sprintBack()` in main.js now also covers sprint + A or D with no W, sent as sprint + W alone (left/right/down cleared, keys turned to the aim by `moveTurn`), so the server and prediction treat it as a forward sprint where you aim. W + A / W + D diagonals are unchanged. Checked: syntax, and stepMove sprints toward the aim at all four angles.
- Phone screens checked (he asked, same day: nothing cut off or on top of something else in a match; operator select / loadout not squished): `tests/phonescreens.mjs` plays into a bot match by thumb at 914×412 and 760×360 and lists cut-off text, HUD pieces overlapping each other or the touch buttons, and squished cards. Fixes in the "Phone screens re-laid" block at the end of style.css: no portrait rows on the score bar (counts beside the scores), compass under it, kill feed under the round buttons, chat (2 lines) just above the right thumb's buttons, tip between the FIRE buttons, smaller drone bar / round banner; `#allies` was zoomed twice (inside `#hud`) and sat on the ammo; touch count badges were clipped; the objective-found card's animation ended half off the top (all screens); the select header is slim so 5 role cards and the loadout fit.
- Operator select order (he asked, same day): step 1 is the site (defenders: whoever locks it in decides, no vote; a team of only bots still votes) or your spawn (attackers): server `m.t === 'place'`, `placed(p)` / `needPlace()` (not tutorial, free play, TV, fun modes), `siteLk`, snapshot `pd` / `slk`; `pick` and `role` wait for it. The loadout panel shows no operator until you pick one: before that `showSelMap` draws every floor with the sites (or the spawns), tap to choose; `placeList` is the left column. Attackers can switch operator in preparation (pause → CHANGE OPERATOR, `openReSel`; server `prepSwap` re-equips but keeps the drone / waiting body); defenders can't, and nobody can in the action phase. Test: `node tests/selectflow.js`; roles/spawns/vpnplay send `place` first.
- Phone free play and steering (he asked, same day, before a first-impression play): free play's OPERATORS · GUNS · BOTS button couldn't be tapped on a phone (the touch zones took the touch) — touch.js `grab` now clicks a page button under the finger (`#freeHint`, `#cambar`, `#kcBtn`); the free play panel fills a phone screen with taller operator buttons; the hover zoom on operator cards is off on phones (it stuck after a tap and cut the picture). Steer after sprint (`st.steer` in `pollPad`): after a phone sprint the move thumb keeps turning the crosshair with you, across stops and while firing from the hip, until you aim in; a thumb on the aim side wins. Checks: `tests/phonefree.mjs` (panel, two switches, steer, pause) and `tests/phonescreens.mjs`, both now also flag cut-off icons.
- Phone aim reach (he asked, same day: couldn't aim far enough on a phone): the touch aim used the old pad crosshair, kept on screen (~8 m at full push). Now `touchFar()` / `padPointW()` in main.js: the aim stick reaches as far as a mouse with that sight (`reachOf`: hip 18 m, scopes further), the camera fit (`tFar` beside the free-aim fit, 1.45× room for the thumb buttons) zooms / slides to keep it on screen, and AIM puts it at the sight's aim-in distance (`adsStart`). `tests/phonefree.mjs` pushes the stick out: 18 m.
- Round 2 loadout bug (he found it, same day, ranked): picking the same operator as last round left the select map up. `fillDetail` (ops.js) only refreshes when `d.dataset.op` matches, and `showSelMap` replaced `#selLoBody`'s HTML without clearing it; it now clears `dataset.op` / `_refresh`. Checked in headless Firefox (old: map stays, fixed: loadout shown); `tests/selectflow.js` passes.

## Full test pass + shotguns, loadouts, gun bars, phone fixes (2026-11-17, he asked)
He asked for another full test of every mode from every perspective, then (same session) for: no skill explanations on
the operator-select cards; phone loadout guns not squished (his phone: Galaxy Z Flip 7, ~960×411 sideways); shotguns
that are deadly up close and weak past a room, with a real spray, used by the pros; nobody carrying 3+ guns of one
type (Onyx had 3 LMGs); nicer gun stat bars that keep similar guns apart; and why his phone had no ? button.
- Test pass: all ~110 `tests/*.js` (8 at a time), a hidden-browser playthrough of Quick Match, Unranked (bans), Ranked,
  One in the Chamber, Gun Game, Infected, Zombies, Free Play, Tutorial, Esports TV and every menu page at 1280×720 and
  1920×1080 (cut-off check), and the phone screens at 960×411 / 760×360. The playthrough script lives only in that
  session's scratchpad; its pieces (wait for loading, pick/ban until the round starts: the `bn` list is [op, ...] pairs)
  are worth rebuilding the same way.
- Found and fixed: the "Objective found" card was drawn through the big PREPARATION PHASE title (`siteFound` waits for
  `st.bannerT`, a tick later so the title can start first; on phones it sits below the clock, `html.touch #siteFound`);
  the Quick Match tip line sat under the death card (`beginnerHelp` hides it while `#deathCard` shows); the home
  screen's PROFILE · SETTINGS · QUIT · downloads row squeezed into "PROFIL SETTING" (`.hsmall` wraps); Zombies' clock
  read 0:00 forever (server `zbInfo` sends `el` time survived and `bt` the wait for the next wave); the phone title
  screen ignored test taps (it now also starts on a touch `pointerup`); three operators (Haze, Brisk, Strider) started
  with a primary that wasn't in their own list; `tests/vpnplay.js` walked both players into a wall (now back and forth).
- Shotguns (`tests/shotguns.js` prints the damage of an aimed and a hip blast at 1-15 m and checks his rules): the
  pellets used to fly in an even fan, so at 4 m only one or two hit (Breaker: 18 damage at 4 m, 8 blasts to drop
  someone). `shotOffset` now bunches them towards the middle (`choke` per gun, higher = tighter), every pellet sends a
  shot event (`tracerPellet`; the extra ones carry `pl` and draw a brief streak, `mainPellet` keeps the old three
  trails), and each shotgun has its own `fall`. He chose: the pump one-shots within about 4 m. Now Breaker one blast
  to 4 m, two across a room (7 m), 5+ past 10 m; Tusk one blast to 2 m; Hedge to 2 m; Stub to 2 m; Quill two blasts
  out to 5 m with the longest reach; Anvil unchanged. `forgetReworked` (server/training.js, `REWORKED`) drops all the
  pros' old shotgun results once, so practice tries them fresh; bots holding buckshot take the sidearm past 10 m and
  go back under 5 m (bots.js, `ai.sgSwap`).
- Loadouts: `tests/weapons.js` fails anyone with 3+ guns of one type. 17 operators got a new primary, 19 a new
  sidearm (third pistol → an MP: whisper/hatchet on attack, gnat on defence). Onyx: Mule, Tusk, K4 + the Aegis shield.
- Gun bars (he chose "just nicer bars"): `gunRating(id)` in shared/operators.js works out Power (aimed hit / blast at
  3 m), Fire rate, Reach (damage left at 10/20/30 m), Handling (aim time + recoil + hip spread) and Mobility, then
  spreads each over 1-10 half by size and half by rank, so no two guns show the same five bars. Drawn as ten slanted
  segments in the gun type's colour (`GUN_COLOR`), the type label in the same colour. The Armory's shots-to-kill uses
  `aimedDamage` for shotguns.
- Phone gun pictures: drawn for a 270×84 box and stretched into the narrow phone card; now drawn for the box they sit
  in (`drawPics` in ops.js; the height is on `.wpic`).
- The ? button: the phone app updates only from GitHub releases; the last one (b487) was made before the ? button
  (commit 489). A new release from this session carries everything.

## Phone controls by priority, AIM on FIRE, gentler aim stick (2026-11-17, he asked)
He found phone play hard: the picture buttons covered too much of the screen, the aim stick was too sensitive, and the
phone must have every aim feature the computer has. He chose: buttons sized and placed by how often they are pressed
(AIM bigger), a small AIM on the bottom right of each FIRE, the old left-thumb AIM removed.
- Layout: the "Phone layout by priority" block at the end of style.css (sizes before `--tz`): right FIRE 76, left FIRE
  62, AIM 44/38 on each FIRE's corner (`ads` / `adsL` in touch.js `BUTTONS`, one switch: `setAds` lights both);
  crouch / reload / swap 46 on an arc round the right FIRE (crouch moved over from the left); skill / gadget / melee /
  ping 38 on an outer arc; USE / VAULT and the camera arrows 54 left of crouch; top row 36; lean 40 by the left FIRE.
  On phones the objective card sits lower with a smaller floor plan (`html.touch #siteFound`).
- Aim stick: `stickSens()` (touch.js, `r62d-sticksens`, default 0.7, Settings "Aim stick sensitivity"): the thumb
  travels `R / sens`, the push is curved (finer near the middle), and main.js `pollPad` eases `padAng` towards the
  stick (rate 22 × sens, × Aiming-in sensitivity aimed in, × Steady sensitivity when steadying) instead of jumping.
- Steady aim on phones: scoped in with the move thumb off (`st.padStill`) counts as steadying (`steadying()`), as
  holding Walk does on a computer. Far aim, aim help, aim-in snap, lean and ping already worked on the stick.
- Tested: `tests/thumbs.mjs` (AIM via the FIRE-side button, firing, crouch, reload, swap, drone, tilt) and
  `tests/phonescreens.mjs` at 960×411 / 760×360 (only the intended FIRE/AIM overlap left).
- From now on he wants a GitHub release after every finished version (CLAUDE.md standing decisions).

## Phone aim stick with an acceleration zone, tested with simulated human thumbs (2026-11-17, he asked)
He asked for acceleration (a fine-aim inner zone, an outer zone that accelerates when you clearly want to go far) and
for me to craft the best scheme for two human thumbs and a gyroscope, with a handicap for the simulated thumbs.
- `public/js/aimstick.js`: the stick's rules as pure maths (`newStick`, `stepStick`, `reachFrom`/`stickFrom`,
  `TUNE`), used by main.js `pollPad` on phones (`st.stk`, touch.js now reports `rsOn` while a thumb is on the stick).
- `tests/aimstick.js`: simulated thumbs (0.2 s reaction, bell-shaped flicks 0.12-0.27 s, 12 % / 3° misjudgement,
  corrections by eye every ~0.15 s, ~0.5 px tremor; gyro = slow, noisy wrist nudges) bring the crosshair onto an enemy
  at 3, 8 and 15 m. `SWEEP=1` tries combinations of `TUNE`.
- Tried: 'old' (shipped stick), 'accel' (acceleration zone only), 'hybrid' (relative fine aim with pointer-style
  acceleration; slower for human thumbs, too many small corrections), 'steady' (acceleration zone + tremor damping).
  Chosen 'steady': the inner 75 % of the stick covers the first 45 % of the reach (fine aim), the last 25 % climbs fast
  to full reach; a slow thumb is followed smoothly (`CALM` 4/s, more aimed in / steadying / lower setting), a fast one
  at once; a new touch starts from where you aim. Body held 0.2 s: 3 m 100 % (old 98 %), 8 m 79 % (old 39 %),
  15 m 10 % (old 6 %); headshot holds at 3 m 56 % (old 0 %); shake roughly halved. Far shots still need the gyro (on
  while aimed in by default) and aim help.
- Later (he asked: "body at up to 25% at 15 m"): far misses were both sideways and in distance, because a wobble out
  in the accelerating zone moves the crosshair a lot. `stepStick` now filters direction and distance separately and
  calmer out there (`FAR_A`, `FAR_L` 0.25); the sweep (`SWEEP=1`, kept only settings that held 3 m ≥ 97 % and 8 m ≥
  75 %) also picked ZONE 0.7, NEAR 0.55, OUT 1.2. Body held: 3 m 100 %, 8 m 82 %, 15 m 41 % (old stick 6 %).
  tests/aimstick.js now fails under 25 % at 15 m.
- Later (he asked: fine movement needs more room, the outer feel is good): `TUNE.TRAVEL` 1.5 (touch.js `Ra`): the thumb
  travels 50 % further, all of it added to the fine zone (ZONE 0.8; the outer zone keeps its ~27 px and slope, NEAR
  0.55). The first 20 % of the reach now takes 47 px of thumb (was 28). `SWEEP=inner` in tests/aimstick.js; the
  simulated tremor is in screen px. Thumb test: 3 m 100 %, 8 m 78 %, 15 m 38 %.
- White slashes beside the phone buttons (he saw them): the menu buttons' parked shine (`button::after`, skewed, off
  to the left) showed because `#touchUI .tbtn` has `overflow: visible` for the count badges; hidden on touch buttons,
  with the tap ripple.

## Phone combat round 3: close aim, fixed stick, pre-aim, sway, defuser line, ACTION button (2026-11-17, he asked)
- Close-range aim cut out: the stick's dead spot (0.08 of the stick, ~10 px with the longer travel) froze the crosshair
  near you. Now only a thumb still resting where it landed is ignored (`moved` in aimstick.js), the raw thumb vector
  (`rsRaw`) is used, and the phone crosshair can come in to `AIM_MIN` 24 (46 on a computer).
- The aim stick sits in one place (`#tsRight` in style.css: 330 px in from the right, 200 up, times `--tz`; faint until
  held); a thumb anywhere on the right half drives it from where it lands. (It had been hidden for good after the first
  return to the menus: setTouchVisible added `hidden`; removed.)
- Scope sway (`scopeSway` in main.js): none within 12 m of the aim point, eases in to 0.007 by 30 m (was 0.011 at any
  distance).
- Pre-aim while moving (he: "important to pre-aim everything and that is proving very difficult while moving"): with
  the aim thumb off the stick the crosshair stays on its spot in the world (`st.hold` in `pollPad`) while you walk,
  strafe or crouch; sprinting or walking up to it lets go; touching the aim stick ends post-sprint steering; aiming in
  keeps a pre-aimed spot (sniper scopes still snap out). `SCENARIO=preaim node tests/thumbs.mjs`: 0 px drift.
- Defuser: on phones "DEFUSER CARRIER" was drawn under the ammo count; `body:has(#status:not(:empty))` moves the ammo
  and the team list down.
- ACTION button (he asked: one button for whatever the game prompts, to cut clutter; he chose PING as the default and
  JUMP in PING's old slot): touch.js `use` button, always shown, live icon + word (`word` from the prompt in main.js:
  PLANT, REVIVE, VAULT...; else PING). Hold actions latch, vault and ping are pressed while the finger is down. JUMP
  (vault input) is a new button with its own icon. Camera arrows moved left of ACTION.
- Next (in r6-todo): sight lines shaking while the camera moves smoothly (drones and on foot).

## Phone close aim: no freeze near you, limits shown (2026-11-17, he asked)
- He found the crosshair froze when brought close to the operator. Measured with `SCENARIO=close node tests/thumbs.mjs`
  (records distance / angle every frame while a thumb pulls in through the middle and circles it): it could not come
  nearer than ~34 px (`AIM_MIN` 24 screen px ≈ 1 m), and the shake damping turned it so slowly near the middle that a
  thumb crossing over made it crawl round the side (0° → 71° → 112°...) instead of crossing.
- Now: phones use `TOUCH_MIN` = `PLAYER_R` + 5 world px (main.js), and in aimstick.js `near` (stick output under
  0.15, i.e. within ~1 m) lets the direction follow the thumb almost at once and the length catch up faster. Kept that
  narrow: a 0.3 zone cut 3 m head hits from 58 % to 34 % in tests/aimstick.js; at 0.15 they are 58 % again.
- Limits shown (he asked: any barrier must show in the UI): `crosshair()` draws a dashed white ring with a dark edge
  at the inner limit as the crosshair nears it, and a fainter one at the end of the reach once `padReach` > 0.9.
- Result: distance goes down to 14 px, the angle flips 0° → 180° straight across.

## Glass HUD look everywhere; phone aim stick lower (2026-11-17, he asked)
- He asked for the right joystick lower, its centre in line with RELOAD, same left-right place: `#tsRight` bottom
  `119px * --tz - 62px` (RELOAD: bottom 96 + 23). Measured in `SCENARIO=close tests/thumbs.mjs`: both centres at y 298.
- He asked for more life and texture in the UI, phone and computer, nothing left out; he chose "Glass HUD" (frosted
  see-through glass, soft sheen on top, gentle glow round the edge) for everything. All in `public/glass.css` (loaded
  after style.css; the Android and Windows builds copy all of `public/`). Recipe in its `:root`: `--g-sheen`/`--g-dome`
  gradients, `--g-grain` (a static SVG noise tile), `--g-rim` inset highlights, `--g-glow`. Elements keep their own
  tint colour and get the sheen + grain as background images (`!important` where style.css uses `background:`
  shorthand). `--panel` is now 0.66 see-through; big pages and Settings stay 0.96 (words behind showed through).
- Covered: phone buttons (FIRE red, AIM blue, ACTION gold, badges), both sticks (glass ring + bead), the help card;
  the match HUD (clock, team score tiles glowing in --ally/--enemy, objective, health tube, ammo, gadgets, kill feed,
  chat, camera bar, scoreboard, death card, tutorial coach, Esports TV cards, stair view, Zombies points/perks), the ping
  wheel (rims drawn in pingwheel.js); every menu button/panel/card, inputs, Settings, page heads, XP bars, loading bar.
- Speed rule: no `backdrop-filter` over a match. `html.inmatch` (main.js `screens`, = joined) switches the real frosted
  blur off; it is used only on small menu panels (pause/quit dialogs, profile chip, join card) outside a match.
- Measured in headless gamescope on his GPU, empty free play, 1600x900 High, glass on vs off (same page, the
  stylesheet disabled), 3 rounds: 128 vs 131 fps average, 1% low 76 both (noise). With 5 bots fighting the numbers
  swing 60-140 either way, so measure empty. `tests/uicheck.js` with glass on vs off: no new cut-off text at 1280x720.

## Phone rope drag aim; thin site finder (2026-11-17, he asked)
- On a rope a phone now aims like the computer's Crosshair mode: the aim thumb (or a dragged FIRE) drags the crosshair
  (`freeMove`, which turns the drag for the rope camera's `st.rot`), `ROPE_DRAG` 2 crosshair px per thumb px at aim
  stick setting 0.7, slower aimed in / steadying. `pollPad` sets `st.rdOn` (body, alive, `me.ro[0]`, not a camera):
  on the way in `aimOff` starts at the current crosshair; on the way out `padAng`/`padReach` come from it. Every
  "Crosshair mode" check is now `freeLive()` (= the old `padOn && freeAimOn() && !gpRecent()`, or `ropeDrag()`), so
  the rope view's reach, camera slide and wall rules all apply. touch.js reports the aiming finger as `rsPx` (with a
  number per new finger, so a new touch never jumps). `SCENARIO=rope tests/thumbs.mjs`: on the rope drag is on, a 60 px
  drag moves the crosshair the same way on screen, a new thumb holding still moves it 0. `__r62d.scr()` added.
- The site finder (`#compass`) is one line: an 22 px needle (18 on phones), site, floor and distance in a row; 28 px
  tall on a computer (was ~70). Now glass too.

## Phone match text much smaller (2026-11-17, he asked: the rappel hints and any text that large)
- A block of `html.touchplay` sizes at the end of style.css (#hud is also zoomed by `--hudz`, ~0.8). Measured with
  `BIGTEXT=<file> SCENARIO=rope tests/thumbs.mjs` (lists on-screen text of 15 px or more): before, ammo 44 px, health and
  scores 27, clock 25, operator 19, the rope hint 16; after, no words at 15 px or more, ammo 29, scores 21, health and
  clock 19. Also smaller: round banner, CLIMB IN box (#winGo), objective-found card, players left, progress label,
  out-of-bounds warning, end screen title, Zombies round and points, death card.
- The phone prompt sits between the left thumb's buttons and the aim stick (left 238 px, right = the stick's left edge,
  divided by --hudz), wrapping onto two lines. `promptText`'s `mv()`: on phones the rope hints say STICK ↕ / STICK ↔.

## Sage glass; look check on phone and computer (2026-11-17, he asked)
- "Sage green is my signature color": the glass is tinted sage instead of grey. `glass.css` `:root`: `--sage` #9caf88,
  `--g-tint`, `--panel` rgba(20,30,23,.66), sheen/dome/rim/grain carry sage; every cool blue-grey glass colour mapped
  to a sage one (AIM's blue kept). Role colours stay: FIRE red, AIM blue, ACTION/on gold, teams --ally/--enemy.
- Look check (he asked: aesthetic issues on mobile and pc): screenshots of every menu page and the match at 1366x768,
  1280x720 and a 914x412 phone (`tests/shoot.mjs` steps, `tests/thumbs.mjs` default / menus / rope). Fixed: scoreboard
  and end board .9 solid (the map showed through); `.overlay` dim .86; phone drone/camera view: arrows (`.t2/.t3`) left
  of the aim stick, `#viewlabel` above them between the left buttons and the stick, `#cambar` under the score
  (`!important` over free play's "above the hint bar" rule); ⟲ TILT (`.t6`) was pinned to the top by the top-row rule.

## Phone buttons on top of each other (2026-11-17, he asked: the "cancel lean" button conflicts with FIRE)
- The lit lean button got the class `act`, which is ACTION's class: its size and place rule moved the lean button onto
  ACTION, right beside the right FIRE. Now it is `leaning` (touch.js `touchContext`, style.css `.tbtn.lean.leaning`).
- Both AIM buttons hide when you are not on your own body (drone, camera, downed; the server only aims on a body). On a
  667x375 phone the camera ◀ sat on the left AIM. The ▶ to ◀ gap (`.t2`) is zoomed with --tz, so they don't touch on tablets.
- `tests/phonebuttons.mjs <port> <url>` (set up like thumbs.mjs): every button shown at once on 7 phone/tablet sizes,
  on a body (lean lit either way, ACTION with a word, tilt) and on cameras; prints buttons that overlap, sit under 6 px
  apart or leave the screen. Expected: only AIM on FIRE's corner (on purpose) and the 6 px top row.

## Phone fire rings (2026-11-17, his idea)
- FIRE ×2 and AIM ×2 gone on phones: a red ring round each stick (`#touchUI.rings .tstick::before`, glows with `.firing`).
  A thumb past `FIRE_IN` (1.12 × the stick's travel) shoots until back under `FIRE_OUT` (1.0). He picked: quick tap on
  the aim stick = aim in/out; double-tap and hold the move stick = sprint (the edge push sprint is Buttons mode only).
- Lesson: the aim stick is absolute (distance = reach), so a flick through its far zone threw the crosshair to ~2.3× its
  distance (257 → 600 px in the test). The distance is now taken from 120 ms before reaching the ring.
- Lean buttons moved right in Rings mode (they touched the move stick's ring); ring inset 14 px so the aim ring clears ACTION.
- Tests: `SCENARIO=rings node tests/thumbs.mjs` (shots on each ring, steady distance, aim turns, tap aim in/out, landing on the
  ring, double-tap sprint, two thumbs); `tests/phonebuttons.mjs` counts the rings; phonefree/thumbmatch use Buttons mode.

## Fire rings v2 and polygon buttons (2026-11-17, he asked)
- He found pulling a stick all the way shot by itself. Now a stick being steered never shoots, covers its ring while held,
  and the ring is its own fire button (a finger put down on it). Thicker ring (28), bigger sticks (60, full run at 74).
- New layout (his idea: fitted polygons of different sizes, most-used closest to the sticks): `public/js/touchlayout.js`.
  Inner band round the aim stick: crouch, reload, swap, skill, gadget; outer band: jump, melee (camera arrows above them
  on cameras); ACTION a corner piece; lean/tilt pieces round the move stick; top row interlocking hexagons.
- Lessons: an unclipped button with its own hit test (`polyHit`) keeps count badges visible; the old HUD checker
  (`tests/phonescreens.mjs`) compares boxes, so its button-vs-button lines are false alarms now — `tests/phonebuttons.mjs`
  measures the real shapes. Moved for the layout: the team list clear of lean, the coach hint and chat clear of the cluster.
- Tests: `SCENARIO=rings tests/thumbs.mjs` (a pulled stick never shoots; a finger on either ring does; drag-aim on the right
  ring; tap aim in; double-tap sprint; two thumbs), `tests/phonebuttons.mjs` 7 sizes clean, phonefree (Buttons mode) OK.

## Readable small print in every menu (2026-11-17, he asked)
- He asked that no text in the menus, the options and free play's operators / guns / god mode panel be too small to read,
  on every version (phones may differ from the PC). Measured first with the new `tests/textsize.mjs`: at his 1280×720
  window the menus shrink to 80% (laid out for 900 tall), so 11–13 px print showed at 8–10 px; on phones menus shrink to
  0.56–0.64 and text showed at 4–9 px (the free play panel and pause menu were shrunk twice: inside #hud, and the
  pause/quit `.overlay` and its `.menu` both zoomed).
- Follow-up (he asked): the corner buttons (fullscreen/settings/leave) keep their old size (#corner left out of the floor); free play's panel has a bigger floor (`#freeOps { --minpx: 15px }`, 13 on phones).
- Fix: every font size in style.css is `max(<size>, var(--mf))`. `--mf` is 0 except inside the menu panels (end of
  style.css), where it is `--minpx` (12.5 px PC, 12 px touch) divided by the menu zoom, so the HUD and phone buttons are
  untouched. `small`/`kbd` get the floor too. New CSS must keep the `max(…, var(--mf))` form.
- Layout follow-ups: free play panel scrolls as one page (sticky title/CLOSE), gun rows wrap; phone Settings fills the
  screen and its rows wrap; pause/quit menus scroll if taller than the screen; phone map names wrap.
- Test: `node tests/textsize.mjs <port> <outdir> <url> pc|phone` (phone = the phone Firefox profile; `MIN=11.9` for phones,
  `RULES=1` names the CSS rule) — 0 small text on both, and its cut-off list (tests/uicheck.js) has nothing new.

## Sniper scope sight line (2026-11-17, he asked)
- Scoped in with a sniper scope, the screen outside the lens is darkened and blurred (#scopeVeil), which hid whatever
  stood between you and the target. Now a clear lane (44 px, soft edges) runs from your operator to the lens: two extra
  CSS mask gradients on #scopeVeil (a stripe along the line, a band from you to the lens; `mask-composite: intersect, add`),
  their positions worked out in `scopeVeil()` (main.js). Checked in a test browser with the veil tinted red.

## Reticle = your gun's sight (2026-11-17, he asked)
- The crosshair is no longer a setting: `drawReticle(ctx, sight, x, y, spread, k)` in crosshair.js draws the sight on
  the gun you have out (iron sights: front post in a rear notch; red dot + faint ring; holo broken ring + dot; prism amber
  chevron + side bars; 2× scope fine cross with range ticks; sniper adds thick posts). He asked: easy to see, not in the
  way, a little see-through (82%), not too big or small (×1.35 a pixel, dark edge). Spread still opens them up.
- Settings → CROSSHAIR page removed (old saved `xh` profiles are ignored). The holo ring, prism chevron and 2× scope ticks
  are gone from `drawSightLook` (on the reticle now); its red-dot bloom, scope edge darkening and sniper lens reticle stay.

## Look-alike guns redrawn (2026-11-17, he asked)
- Five pairs looked nearly the same; the second of each got a new picture (`G` in gunart.js): Tandem (sand, new `skeleton`
  stock, vented `shroud`), Auger (no stock, orange `stripe` band, curved mag), Trestle (olive + wood, new `pan` magazine on
  top, also in hand in sprites.js), Heron (steel blue, black thumbhole stock, brake), Needle (black, new `target` long thin
  barrel with a weight, wooden grip). Checked side by side in a test browser.

## Esc closes the free play panel without pausing (2026-11-17, he asked)
- Esc closed #freeOps, but the auto mouse-capture in `frame` took the mouse back on the next frame while Esc was still
  down; the browser read that Esc as "let go of the mouse", and `pointerlockchange` opened the pause menu. Now the
  auto-capture waits until Esc is released (`st.escDown`) and 0.4 s more (`st.escAt`). Checked in a test browser.

## Aim-in distances spaced out (2026-11-17, he asked)
- Iron sights felt too far, the 2x and sniper too close: `ADS_GUN`/`ADS_OWN` (shared/operators.js) 15% nearer,
  `ADS_SIGHT` stretch widened (reddot 1.15, holo 1.35, prism 1.8, scope 2.5; was 1.1/1.25/1.5/1.8). K4: iron 5.1 m,
  red dot 5.9, holo 6.9, prism 9.2, 2x 12.8 (was 6 / 6.6 / 7.5 / 9 / 10.8). Sniper: its 5 sight lines fan ±1.3° instead
  of ±2.5° (main.js `adsReset`), so a door frame cuts it short less often.

## Movement 13% slower (2026-11-17, he asked)
- `M_S` in shared/physics.js: run 2.6 → 2.262, sprint 4.2 → 3.654, Shift-walk 1.4 → 1.218 m/s (crouch, ADS, prone,
  slide, drones untouched). `tests/stairs.js` PASS, `tests/sim.js --only harbor` PASS.

## Pro practice on the slower-movement version (2026-11-17, he asked)
- Two `server/practice.js 600` sessions on the real data (backup: `pro-training.json.before-2026-11-17-practice`):
  1200 rounds on this version, drills 483 → 842. The first session only added 60 drills (one thread's worth, cause not
  found; a throwaway rerun and the second session each added the full 300): after a practice, check `drills.n` grew by
  60 per thread. Pros' takes: Dust Town (attack 61%) and Embassy (59%) worst maps, the 2× scope on the Trestle LMG too
  good, bodies too thin, bullet trails.

## Phones and Windows get the pros' knowledge (2026-11-17, he asked: "release ... so mobile gets it")
- Practice only ran on his computer; phones (no practice) and new Windows programs had blank pros. Now desktop/build.sh
  and android/build.sh copy his `pro-training.json` into the build as `server/pro-seed.json` (gitignored, never
  committed); `seedTraining` (server/training.js) uses it when it has more rounds than the local knowledge; phones fetch
  it in public/phone/server.js. Tested: an empty data folder starts with 47,651 rounds, 842 drills, 10 pros' views.

## Operator select fixes, phone and computer (2026-11-18, he asked)
- Role chooser (`#roleBar.choose`): each role card shows every operator's portrait (`.rbOps`/`.rbOp`, `portraitCached`)
  instead of a list of names; while choosing (`#select.roleChoose`, set in main.js) the big map hides and the five roles
  sit side by side (grid), on PC and phones, so nothing scrolls. `.choose.place` (the spawn list shares #roleBar) keeps
  its column.
- Phone op cards lost their picture at 760x360 (text squeezed the canvas): picture keeps >= 46%, role line hidden on
  touch, name/skill one line. LOCK IN was off screen at 760x360: header left side shrinks, spawn chips wrap, small map
  max 22vw. Role tabs cut "BREACHER" (PC 1280, phones): tabs size to their text, tighter spacing, no icon on phones.
- Swept with tests/phonescreens.mjs (2 phone sizes), tests/textsize.mjs (all menus, 4 sizes; now skips #corner, which he
  wants kept small) and PC select shots: no new cut-offs (the loading screen's drifting picture is expected).
- Also found /tmp/claude-0 chowned to insideabush (new Claude chats refused to start) and 104 GB of leftover test
  browser profiles in /tmp; fixed and cleaned, rule added to CLAUDE.md.

## Faster loading (2026-11-18, he asked)
- Measured with `window.__loadTimes` (runLoading now records [title, step, ms] per step). Start, 1920x1080 headless:
  fonts 0.2 s, title map 1.3, map pictures 1.9-2.0, guns 0.5, operators 0.3, GPU 0.1 = 4.7 s, then PREPARING SOUNDS
  1.3 s after the first click.
- Map pictures are kept on the device: `thumbLoad` (main.js) stores each as WebP in localStorage under
  `r62d-thumb:<id>:<hash of tiles/floor/flAt>:<game version>` (old entries for that map removed); a changed map or a new
  version draws afresh; no version (phone without one) = no store. Second start: map pictures 0.84 s, total 3.5 s.
- PREPARING SOUNDS screen removed: `initAudio`'s background prewarm builds the gunshots and footsteps (now the scuffs
  too) a few at a time while you are in the menus.

## Phone pre-aim survives quick flicks (2026-11-18, he found it)
- A quick flick of the move stick counted as a sprint (FIRE buttons: pushed past 1.45 radii; rings: a fast tap-flick can
  read as the sprint double-tap), and any sprint set `st.steer` (turn with your movement) and cleared `st.hold` until the
  aim stick was touched. Now `st.sprT` times the sprint and only one held > 0.35 s (`sprLong`, pollPad) does either.
- New `tests/preaimflick.mjs` (rings + buttons: aim, walk, 4 quick flicks → still `hold`, no `steer`): PASS.
  `tests/phonefree.mjs` needed a scrollIntoView before tapping an operator (the panel scrolls as one page since
  2026-11-17); its steer-after-sprint checks pass.

## Phone aim stick: smooth pickup (2026-11-18, he asked)
- The aim stick is absolute ('steady' scheme): its centre was put under the landing thumb, i.e. "aim close to me", so the
  first move sent the reticle racing from where it was towards that (measured: ~400 px for a 25 px thumb move after
  aiming far out). Now touch.js places the stick's centre so the landing spot already is the current aim
  (`onAimStart` hook from main.js: padAng/padReach as a stick vector via `stickFrom`); after that it is the same stick.
  The quick-tap aim-in is measured from the landing point (lx, ly). The knob shows where you aim.
- (Tried first: an offset that melts away with thumb travel in aimstick.js; it dragged the reticle sideways as it
  melted — dropped.)
- Tests: `tests/preaimflick.mjs` now also checks pickup (25 px thumb → ~25 px reticle, was ~400) in rings and buttons;
  `SCENARIO=rings tests/thumbs.mjs` all as wanted.

## Steady sightlines, flat floors round furniture, bots as people, pick-up, WRAITH, homelab (2026-11-18, he asked)
- **Sightlines shook** while the view moved: `visionPolygon` (main.js) spaced its rays from `v.ang` (your aim), so turning
  or dragging the camera under a still cursor moved every ray and the shadow edges crawled (drones too: their full circle
  started at the aim). Now the rays sit on a grid fixed to the map (`k·2π/M`, same density as before) plus exact rays at
  the cone's edges, and where two neighbouring rays land > 18 px apart the edge is found by halving the gap 5 times
  (only your own view). `tests/sightjitter.js` (a shoot.mjs step): edge movement per frame while only turning, old vs new:
  body 0.05 → 0.00 px, drone 8.99 → 0.00 px; 0.12 ms a frame for the shape. `window.__r62dVis` is its hook.
- **Floor looked raised round furniture**: tables (`legs`) and solid furniture lifted their whole cells' picture, floor
  margin included. Now `propBody` (mapdraw.js, `R.body`) measures each piece's own picture once (opaque pixels, not its
  shadow) and look.js raises only that rectangle: `legsOf` (legs, edge and the dark shadow under it on the piece's own
  outline) and the new `solidOf` (a block of that size). Tops are one plain rectangle copy per piece (`r.rc`, `r.rows`):
  a clipped shape per row cost the graphics card 10% (measured). Crates and pillars keep their cells (they fill them).
  The cell-edge contact shadows by furniture (mapdraw regionPart) and the lamp light stopping at furniture cells
  (`lightMap` passes / raised) are gone: each piece casts its own shadowRect. GPU (headless gamescope, High):
  Villa 111 → 117 fps, Lodge 88 → 106 fps while turning.
- **Bots**: `shared/botroster.js` — 70 everyday bots, ten per rank (silly names low, handles high: his pick), each with a
  style line, aggr/patience and habit multipliers (`habit(p, k)`: wander, trade, wallbang, ear, peek, roof, window), a
  favourite job per side (`roleFor`, 65% of rounds) and favourite operators (`botPickOp`, 55%). `botIdentity` (bots.js)
  picks an unused one of the bot's rank and again when the rank changes (from `assignPros`). The lobby shows a bot's
  rank and, on hover or tap, its style (`br`/`bs` in the snapshot, lobby only). `tests/botroster.js`.
- **Pick-up** (his rules: hold Use ~1 s, any time, own gadgets only, not once gone off or damaged): `PICKUP` in game.js,
  `pickTarget`/`pickUp`, busy kind `pickup`; the shield is tracked in `p.shields` (tiles go back to what they were); a
  station's pool, a catcher's catches etc. go with it (`p.stash`) to where it is placed next. `mine.pk` tells the client
  (prompt "HOLD TO PICK UP ..."). `tests/pickup.js`: 18 kinds, PASS; a teammate never sees the prompt.
- **WRAITH** (he found it): battery 8 with 4 s scans let him scan twice, and it refilled in ~23 s. Now battery 4: a scan
  starts only from full, any scan empties it, `SCAN_RECHARGE` 50 s back to full; bots wait for a full charge.
- **Homelab "IP not working"**: nothing in the game blocks anyone (listens on 0.0.0.0, no address checks). From his PC on
  the VPN, 192.168.1.76:6262 answered "connection refused": the R62D service on Lando's mini-server is switched off
  (`r62d.enable = false` in nixos-config hosts/mini-server/homelab.nix on main; turning it on is on the unmerged branch
  `blaney/homelab-r62d-on`). That is a config change for Lando. Game side: `/api/addr` now puts `R62D_PUBLIC_URL` (the
  NixOS module sets it to http://192.168.1.76:6262) first with its own join code; before, the homelab showed its own
  unreachable 192.168.100.x address and code.

## Prone poses, rope wall surfaces (2026-11-18, he asked)
- Lying down: `lyingLegs` (sprites.js) draws two real legs; server `p.pose` ('snipe'/'sit' from moving forward/back
  against the aim) → snapshot `pn` 1/2; client blends `a.sitK`, `legRoom` shortens legs at walls. `tests/pronepose.js`.
- Rope view, part 1: `ropeLook` + `drawTex` (look.js) fill outside faces within 12 cells of the rope with pattern tiles
  (brick, plaster, concrete, glass, boards) mapped per face. Not done yet: the hanging operator, the ground/grass near
  the wall foot, and the "swoop through the frame" window entry (his pick); `tests` helpers in the scratchpad were
  mkrope/mkhang (rope shots: tp to a rope, F, W/S; climb-in needs moving in front of the window first).
- Rope view, finished (2026-11-18): wall tops get the `SURF.t` stone tile on a rope (drawColl, one fill per colour);
  window jambs (plaster) textured too. Climber (sprites.js hang branch): harness straps, buckle, rim light, figure-8 +
  gold screwgate at the belay loop with the rope tail hanging below, boots pushing off in turn (`walk`). `groundTufts`
  (main.js): standing grass blades and gravel at the wall foot within 11 cells, fixed by cell hash, same perspective as
  the walls. Window entry swoop (his pick): `st.swoop` set when a vault starts off a rope; `ropeCam` holds then
  smoothsteps `st.rt` (SWOOP_IN 0.35 / HOLD 0.5 / END 1.2 s), `st.swoopZ` pushes the view in, `screenFx` draws the frame
  growing past the screen and a soft vignette. GPU (headless gamescope, Embassy rope): 135 → 136 fps, unchanged.
- Window swoop, take two (he said 10% of the execution): `swoopT()`; while crossing (the server's vault time) the rope
  eye comes in to 5% of its distance (`ROPE_EYE * (1 - 0.95 swoopZ)`), +9° tilt, view 34% tighter, and the camera is
  pinned on you (st.cam blended to you + 0.3 view heights into the room, before the eye, while `st.swoop`); a 0.18 s beat;
  then a 0.95 s rise (rt smoothstep). After it `st.swoopTail` 1.6 s: slow follow (3.5/s), no 420 px snap, and the camera
  limits after the follow ease in (`camA`/`tailK`). Measured with `st.meScr` (your screen spot, 0..1): centred through.
- Phone stick settle (MOVE_SETTLE 150 ms / MOVE_SLIP 12 px / MOVE_DEAD 0.14, ring only beyond 1.1 stick radii) and no key
  chips on phones (style.css end). Found, not caused by this: tests/thumbs.mjs SCENARIO=rope reports the rope aim drag
  moving the crosshair 0 px, also with the stick code from before (to look into).
- Bugs found on the way, fixed (2026-11-18, he asked): roof bots swung at a roof hatch from the edge spot out of melee
  reach (14 px) forever: they now step in until `hatchNear` reaches it. A bot on the roof outside the squad's roof plan
  (a HOIST grapple) stood there all round: `roofPick` now adds it to the plan or makes its own. Bots held over a hatch
  or beside a window up to ~50 s: capped at 25 s. tests/stuckbots.js prints each stuck bot's plan; what is left is a
  PERCH sniper holding an angle (by design). The phone rope-drag "0 px" was the test's thumb landing on a button
  (tests/thumbs.mjs now uses the aim stick's real place): drag works.
- Phone zoom (he asked, 2026-11-18): on phones "How much of the map you see" starts at 70% and goes 40-120%
  (`VIEW_RANGE` in touch.js, saved as `r62d-view-phone` so phones with an old saved value get the new start too).
  Computers unchanged (80-200%, 100%).
- Crosshair size (he asked, 2026-11-18): `drawReticle` (crosshair.js) is 20% smaller and takes a size `sz`; main.js
  `xhSize` = view part (`XH_REF_H` 470 × REST_ZOOM / viewH, 0.45..1: shrinks only past the widest resting view) ×
  distance part (1 within 3 m, −2.5%/m, down to 0.55). The gap is NOT scaled: still the true cone (his pick).
- Phone heat / Low (he asked, 2026-11-18: Samsung A35 warm after a few minutes; old Low unplayable): `FRAME_MIN` in
  main.js skips frames on phones past 60/s (the A35 screen is 120 Hz). `GFX.low` = Medium's picture (scale 0.8, fog
  0.4, shading, map 2, raised walls) with parts 0.4 / smoke 8; Auto starts phones on Low.
- Rounded corners and the camera hole (he asked, 2026-11-18, Flip 7): style.css end: `--sl/--sr/--st/--sb` = max(8 px on
  phones, env(safe-area-inset-*), the app's measured `--as*`); `html.touch #ui` is inset by them; ring-layout touch
  pieces and sticks get a margin of them (÷ --tz). Android `measureInsets()` (MainActivity) sends the cutout's safe
  strip and 0.3 × each rounded corner's radius as `r62dApp.insets()` / `onInsets()` (touch.js `applyInsets`); needs
  the new APK, older apps fall back to env() + 8 px. `CUTOUT=l,t,r,b,R node tests/phonescreens.mjs ...` paints the
  hole and corners on the screenshots and lists anything in them (34,0,0,0,40: none).
- Smaller phone buttons (he asked, 2026-11-18: everything but the sticks smaller, the middle more open): touchlayout.js
  bands B1 94-136 / B2 140-172 (were 94-150 / 156-196), ACTION 140-236, lean 94-128, icons ×0.82, top hexagons 17
  (was 21); the aim stick centre RC (-232,-128) (was -250,-140; `#tsRight` right 172 / bottom 68 to match).
  tests/phonebuttons.mjs: no overlaps on 4 sizes.

## 2026-11-18 (later): controls reset, saves, phone sticks, round-start hitch
- He asked: his controls back to defaults. PC profile `Inabush` (profiles.json; backup `profiles.json.before-controls-reset-2026-11-18`): keys, sens 100/60/50/50, aim free (v2), lean toggle. Phones: `public/phone/shim.js` forgets keys, sensitivity, aim/lean and touch settings once (`r62d-ctrlreset-1`, only on a phone that already has profiles), so the game starts from defaults. Phone tests that set touch settings first set that flag.
- Saves: every device already kept its own (PC `~/.local/share/r62d/data`, Windows `%APPDATA%\R62D\data`, phone localStorage). Now `server/store.js` writes pending changes on exit/SIGTERM/SIGINT/SIGHUP, the phone's `public/phone/server.js` on `pagehide`/hidden (they were only written every 3 s).
- Phone sticks (fire rings): `zoneOf` in touch.js: only the sticks themselves aim/move; on the red ring or up to `NEAR_RING` 26 px outside it shoots (outside the aim ring: no drag aim); anywhere else nothing. Knobs start in the middle (aim: `k0`/`aimKnob`, the smooth pickup kept; move stick no longer jumps under the thumb). Sticks 10% bigger (`STICK` 66/97/77, `MOVE_R` 81, CSS 132 px), button bands moved out 9 px. `SCENARIO=zones node tests/thumbs.mjs` checks all of it (PASS).
- Round-start hitch (code review): `buildMap` built every map from scratch each round (23-149 ms, server and every browser; twice on a phone). Now built once per map and deep-copied (`copyOf`, 0.5-1.7 ms; copies proven equal to fresh builds). `siteIntel0` (pros.js) asked the room list for every map cell per way in: now a site cell mask/list, 30.5 → 6.2 ms per site, identical results. Server ticks over 33 ms per match: 3 → 0-1.
- Game updates (code review, same day): the snapshot's shared end (everything after a player's `you`/`mine`) is compressed once per broadcast and joined to each player's small compressed start (`Socket.sendJoined` in server/ws.js; raw deflate ending in a sync flush can be concatenated). 0.82 → 0.28 ms per update for 10 players, no client change; `node tests/wsjoin.js`. Browser per-frame tidy-ups were measured and left (drawing dominates). Table in docs/performance.md.

## 2026-11-18 (evening): stair rails, stair height look, aiming in near enemies, the pros' takes
- Stair rails (he asked; he chose sides blocked both ways): `stairEdges`/`railBlocked` in shared/physics.js: per cell
  the sides a body may not cross (1 n, 2 s, 4 w, 8 e): a flight's long sides and its closed end on each floor (lower
  floor open at the bottom, upper at the top); `moveCircle(..., rails)` takes a step back on that axis unless airborne
  (a jump crosses). Bots: `findPath` skips rail crossings. `tests/stairsides.js` (217 tries), `tests/reach.js` floods
  with rails and lists nooks only a jump reaches (School 2F Library 33,17). Windows beside a flight: still a vault.
- Stair height (he asked: show rising / sinking, adding to the furniture look): `stairLift(map, x, y)` (shared/map.js)
  gives storeys climbed (lower copy 0 → 1, upper copy 0 → -1, smooth across the floor change); main.js draws it with the
  furniture marker scaled by height (`STAIR_RISE` 0.6 walls): rising = bigger, light ring, shadow; sinking = smaller,
  dark ring.
- Aiming in (he asked): `nearFoe`/`ADS_KEEP` (2 m): in `adsReset` (Crosshair mode) and the phone `aimReset` branch, a
  crosshair within 2 m of an enemy you see stays put (any sight). Checked in a browser: 0.8 m / 1.8 m off stays, away
  snaps out (1.7 → 9.2 m). The phone path is only syntax-checked plus the same helper.
- The pros' takes: see docs/balance.md (Dust fine, Embassy 40 → 48% with `siteSoft`/`barricades` map settings, Ox 36 → 33).
- From his played match (replay mwmebdy29wqh, Harbor, checked frame by frame with a scratch analyser: teleports, bodies in
  walls, rail crossings, stuck bots, health, game-time gaps; plus his /api/perf reports): (1) game updates went out
  15 a second, not 20: server.js and phone server.js reset `snapAcc` to 0 and lost the remainder; now it is kept
  (a real browser: 45 → 60 in 3 s). (2) MAGPIE bots tried the swarm on drones it couldn't take (other floor, smoke, already
  chased): 113 refusals in 6 matches → 0; `swarmPick` is shared by `releaseSwarm` and the bot. (3) Bots got a
  `pingwait` message every moment their ping was cooling down (40 in 5 s): none for bots now. Looked fine: HOIST's
  grapple and hatch drops (big jumps between floors), a roof bot waiting crouched by a hatch, him walking along a stair
  rail and in at the bottom. His fps 57-120 on Medium (dips to ~60 for a few seconds twice, script 11-13 ms then).
- Stairs by height and landings (he asked: a wider, position-based stairs view with a blind spot from the top, fewer
  spots watching stairs, roomier entrances; he chose: like real stairs, it stops bullets and bots too): `stairSees`
  (shared/map.js): the opening is the top `HOLE` 55% of the flight (the floor above covers the rest, as headroom
  allows), heights `STOREY` 108, `EYE_H3` 58/40/14, `BODY_H3` 40/28/10 px. From the top, standing, the whole flight
  shows within ~3 m of the edge; further back (or crouched ~2 m back) its bottom is out of sight; a climber at the bottom
  sees ~2 m past the top, halfway up the whole floor. `stairRoom` (map build): furniture off the 3 rows past every open
  stair end (railings, low walls, fixed things stay); landings with over `FAR_SPOTS` 250 far watch spots get up to two
  2x2 crate stacks 4-8 cells out where they cut most lines (worst landings 1109 → 589 far spots). Embassy after: 47%
  (133 rounds). Left: 26 stair ends with a wall 2-3 rows ahead (4 could take a doorway: Harbor 2 top, Villa 4/7 top,
  Lodge 5 top) — asked him.
- Doorways (he chose) straight ahead of the four stair tops that had a wall 2 rows ahead: Harbor stair 2 (U.door 67-69,28),
  Villa stair 4 (U.door 44-45,41) and 7 (G.door 2-3,29), Lodge stair 5 (U.door 47-48,42). ~62 rounds each after:
  Harbor 58, Villa 40, Lodge 35 (as before within noise; Villa and Lodge were already defence-sided).
- Operator select (he asked): clicking a site / spawn (list or map) sends the choice and `place` at once; `#lockBtn`
  hidden in that step, so LOCK IN is only for the operator + loadout step.
- HOIST (he asked): `hatchToBlast`: the grapple under a shut (not reinforced) hatch calls `breakHatch`, a frag-kind 'boom' (grenade loud) and noise, then climbs (+0.5 s); reinforced: deny, no charge. Bots too. `node tests/hoisthatch.js`.
- Drones (he asked): attackers get `p.drones = 1` at the start of the action (was +1 on top of the spare: up to 3);
  `putDrone` + `droneKey` (6 / phone DRONE, b 23): a drone from the pocket at your feet even with an older one out
  (it stays as a feed); none left: take back yours; `watch` drives any drone you own (5 / phone CAMS, b 24). Controller
  13 keeps `droneOrCams`. Bots: `checkDrone`/`hideSpot`/`droneCheck` in bots.js: the next room on their path that no
  teammate is in or has checked, time > 45 s, a drone to hand: get out of its sight (Platinum+), drive in, look 6-9 s
  (2.5-4.5 s below), back on hurt. Per 16 rounds: Copper 0, Silver 0.6, Platinum/Champion 4.8 checks a round, never more
  than 2 drones out per attacker. `tests/feeds.js` follows the new 6 (was flaky on the old rule). Embassy 51%, Dust 58%.
- Pro ideas (he asked): `formSuggestions` in opinions.js (see docs/drills.md "Ideas"), BALL KNOWLEDGE → PRO IDEAS
  (`renderIdeas`: most-backed first, then each pro). Practice counts `droneCheck`, `hatchBlast`, `stairKill`, `op_<id>`
  rounds and round endings (`training.ends`, `training.featV` per version). Practice found two bot gaps the ideas would
  have blamed on the game: pro defenders never used rat spots (now `ratTry` in their hold, ~1.2 per 100 player-rounds)
  and HOIST never met a shut hatch (now `hoistTo`: seeks one up toward an upstairs site; forced test 4/8 rounds). 1,400
  practice rounds on this version (600 + 800, ~4 min each). First ideas: School 3F Clock Room and Lodge 2F Games Room
  too hard for attack (33%), Dust A and Embassy B Vault too easy (64-67%), take out scope glare (0.1 per 100).
- Heights (he asked: no seeing over counters / chest-high things crouched, clearly under beds and tables lying down,
  by each thing's real size; he chose: bullets follow, some furniture can be shot through; no sight holes from it):
  shared/furniture.js `FURN_H` (top, gap, pen, see-through per prop kind, metres) → `map.fTop/fGap/fPen` (buildFresh);
  castSight's `low` may be an eye height (`EYE_STAND` 58, `EYE_LOW` 9; `viewEye(v)`: body views get `eye` by stance, cams
  86, drones 5); `furnLine` for people (client `teamSees(x, y, h)` with `HEAD_STANCE`, bots `visibleEnemy`); hitscan:
  bullet from the shooter's eyes to the target's chest, heights from the building's ground (storeys) so window and hatch
  shots work; solid stops, the rest `mult *= pen` (no hole). Unowned LOW cells are all ledges over air: see-through.
  `node tests/furniture.js`. Embassy 43, Harbor 48, Villa 40 after (pros, ~60 rounds).
- Defenders (he asked): one rat roll a round (`RAT_P` 0.11; non-pros ×1.5, pros by patience), crouched at the spot;
  ~6-7% of defender-rounds (he said that is fine). Platinum+ non-pro defenders stay +12 s on a hold and turn to what
  they hear (`ai.watch` = the noise). `tests/feeds.js` clears the borrowed bot's own drones first.
- Stairs view (he asked 2026-11-18: Harbor lobby stairs showed a sliver of grass from 2F; then larger and smooth, as if
  merging into the next floor): `insidePath(fi)` (main.js, cached per map/floor: cells not GROUND/VOID, shaped wall
  cells by their solid parts) masks the view of an indoor stair (`insideAt` at the landing) to the building plus the
  landing's live vision polygons (wound one way so they add up). `stairPeek` sets `v.t` (smoothstep of `stairLift`
  along the flight) and grows `v.pr` ×(1+1.2t); `drawStairView` grows the strip (4→10 cells past the end, 2→5 each
  side), soft edges by two `destination-in` linear gradients (no hard quad clip), wash 0.68→0.44, `kp` eases to 1 by
  the last step, canvas capped at 2048 px. Label on the landing (1.2 cells out). Screenshots: Harbor stair 1 from 2F.
- Phone + controller (he asked 2026-11-18): touch.js `padPlay()`/`usePadNow()`: on a touch device any real controller
  input (pollPad `realOn`) switches to it (`setTouchVisible` keeps the buttons hidden, feed note), a `touchstart`
  anywhere switches back; Settings "Playing with" → "Phone + controller" (`r62d-input` = 'pad', counts as `isTouch`)
  keeps it. pollPad no longer lets a connected-but-idle controller block touch play. Android `dispatchKeyEvent`: gamepad
  keys go to the WebView and count as handled (no B → Back fallback). Tested with a stubbed `navigator.getGamepads`.
- Outdoor zoom (he asked 2026-11-18: too far out outdoors): body view outdoors (`insideAt` false), no TV, no sniper aimed in: `want` capped at `OUT_H` 640 and `st.longV` off (so sight range 1100, not LONG_R).
- Diagonal sprint (he asked 2026-11-18, he chose screen directions): `sprintDiag()` in main.js (computer only, not on a controller/phone): sprint + one vertical + one horizontal key = a screen angle; `moveTurn` keeps the keys screen-relative, `sprintBack` steps aside, and the frame's aim is set to that angle so you face it and the server's sprint check (`sa` within 60°) passes. Tested: W+A → aim -135°, moved equally NW, sprinting every frame.
- Spawn aim (he asked 2026-11-18): frame(), before the aim block: key `${s.rd}|${me.op}` while alive (`st.spawnKey`, null when dead/TV); on a new key the aim is 2 m straight up the screen (-π/2 - st.rot): `aimOff`, `padAng`, `st.aim`, `st.dzAng`, and the pointer for Cursor mode. Tested: free play spawn → aim -90°, offset (0, -72).
- 8-direction sprint (he asked again 2026-11-18: never by the mouse on a computer): `sprintDiag()` now takes one key too (`mx || my`), so on a computer sprint + any move keys = that screen direction, faced; the sprint tip in TIPS and keys.js say so (phones keep "where you aim").
- Window climb (he asked 2026-11-18): `WIN_VAULT` 0.85 in server/game.js on window vaults (`to.k` is `T.OPEN`) and rope in/out (`vault.win`); public `vl` = climb progress 0-1; sprites.js `drawOperator` `p.vault`: gun hanging at the side in one hand, the other hand on the sill ahead sliding back as the body passes; no muzzle flash. Not screenshot-checked yet.
- Mouse 30% quicker (he asked 2026-11-18): `#sens` default 130 (index.html); `SENS_V` 2 in main.js: settings saved without `sv: 2` (profile) or without `r62d-sensv` (localStorage) don't load the four sensitivities, so everyone starts on the defaults once, then saves.
- Settings window (he asked 2026-11-18: 20% bigger, nothing cut off): style.css `#settings` 1200 × 792, side list 240 px; `tests/textsize.mjs pc`: 0 small text, no Settings cut-offs.
- HUD (he asked 2026-11-18): on a computer Cams & drones before Put out a drone in `#gadgets`; phones as before.
- Xbox layout (he asked 2026-11-18: lean on a controller, everything doable, R6's layout): gamepad.js `XBOX_ACTIONS` for a real controller (`gp === real` in pollPad; the phone's buttons keep `PAD_ACTIONS`), `PAD_HELP` rewritten (Settings table). pollPad: `st.padA` keeps what a press meant until release; L3/R3 = `padSprint`/melee, with LT held `leanL`/`leanR`; D-pad left/right = map/drone on the body, camPrev/camNext otherwise; X `reloadUse` (tap reload, held 0.28 s use); `st.padSpr` stays on until the stick lets go, LT/RT, crouch. Tested with a stubbed controller: L3 → mv 3, off on stop; LT+L3 → lean -6.
- HOIST (he asked 2026-11-18): LOADOUTS gadgets `['breach', 'stun']` (was stun / smoke).

## 2026-11-18 — less squish on a rope
- He asked: the view squishes vertically a little less when climbing a wall on a rope. `ROPE_TILT` (main.js) 34 → 25 degrees; look.js `tilt.update` `calm` now divides by 25 so the rope view's lean stays as calm as before.

## 2026-11-18 — smoother-looking sprint turns
- He asked: sprinting snaps your direction at once; keep how it works but make it look smoother. `st.aim` still snaps (server `k.sa`, the gun); a new `st.aimVis` (main.js, after `sprintDiag`) glides at `SPRINT_TURN_VIS` 24/s for 0.35 s after the sprint direction is picked, changed or let go, and is what your own body (`p.ag`) and your sight cone (`view.ang`) use. Shooting or aiming in ends the glide. Checked in a hidden browser: aim 0 → -45 at once, the drawn facing 0 → -31 → -41 → -45.

## 2026-11-18 — no white box on the window swoop
- He asked: climbing in through a window, a white rectangle starts small in the middle and grows to the screen's edges; remove it, keep the transition. main.js `screenFx`: the two window-frame outline strokes (and `st.swoopScr`, only used by them) are gone; the camera swoop and the soft edge darkening stay.

## 2026-11-18 — far aim speed past a ring
- He asked: from 7 m out a separate aim speed, +20% to start, both adjustable, a ring showing where it starts, aimed in or not; then: it can be negative. main.js `farFast()` (Settings `#farFast`, a % change −50..150, default 20 → ×1.2) and `farFastPx()` (`#farFastM`, 2–20 m, default 7) scale the mouse in the mousemove `freeMove` branch when `hypot(aimOff)` ≥ the ring (pointer-locked mouse only, not sticks or touch). crosshair.js `drawFastRing` (dashed sage, brighter when out past it) drawn in `crosshair()` and in the Armory (`O.fast`). Saved like the other sensitivities (localStorage `r62d-sens` slots 4–5, profile `farFast`/`farFastM`, phone shim list).
- He chose to remove the old Far aim sensitivity (`farSens`, ×0.5 past the normal view via `trackR`, both gone; armory.js too): it cancelled the new speed-up near the screen edge.
- Checked in a hidden browser (pointer lock stubbed): the same mouse move from 4 m → 11.0 px, from 9 m → 13.2 px (×1.2); at −30% 5.8 vs 8.7 px inside.
- Then (he asked): every control type and an On/Off switch. `#farOn` checkbox beside Far aim speed (saved: `r62d-sens` slot 6, profile `farOn`, phone shim). `aimDistW()` = the crosshair's distance from you whatever the style (aimOff in Crosshair modes, else `screenToWorld(cursor())`); `farMul()` scales the mouse `k` in mousemove (every mouse style: Crosshair, Classic, Cursor, Aim pad, Turn/Face/Rotate; trackpad too), the phone aim stick's `slow` for `stepStick`, and rope drag. A controller stick points the aim (`padReach = rs.l`), so `padCurve(l)` bends it: past the ring's tilt `rr` each bit of tilt goes farFast times as far, full tilt still = full reach. The ring shows for every style while on a body. Checked with a stubbed pointer lock and a stubbed controller: Crosshair 10.8 → 13.0 px (off: 10.8 both), Cursor 14 → 17 (off: 14 both), controller tilt 0.6 → reach 0.52 on / 0.56 off, 1 → 1.00 both.

## 2026-11-18 — phone + controller screen, the ? guide
- He asked (Lando on his phone with a controller): huge kill feed and HUD until he touched the screen, glass buttons oversized, chat front and centre; health and gun bottom right. Cause: touch.js `setTouchVisible` dropped `html.touchplay` (every compact phone match rule) whenever the touch buttons hid for a controller. Now `touchplay` follows "in a match" and a new `html.padplay` is on while a phone plays with a controller; style.css `html.touchplay.padplay` lays it out like a computer (#bl/#br bottom right, chat bottom left, prompt / view label / tip bottom centre, allies under the objective).
- Touch play (his choice): chat small in the bottom left above the move stick (`left: 96px / hudz`, clear of the ammo); kill feed the last 3 (4 reached the button arc).
- The ? guide (#tHelp): 4 columns, smaller icons, shorter descriptions (touch.js `HELP`); fits with no scroll at 914×412 and 760×360. Checked in headless phone Firefox (both modes, both sizes): no cut-offs, no HUD overlaps besides the button-arc ones the test always lists.

## 2026-11-18 — calm camera in fights
- He asked: the view flew about while he shot someone just after climbing in through a window (zoom, slide and jolt); he chose one size and a gentle follow. Cause: after a rope climb-in the swoop rise (0.95 s) + a 1.6 s slow `swoopTail` + the rope-to-room resize; and in any fight the lead (`leadV`, `sightLead`), room size (`envWant`/`envH`), `longV` and `fitH` kept changing.
- main.js: `FIGHT_HOLD`/`fightNear` (own shots, the trigger, `hurt`, shots starting within 12 m or passing within 8 m on your floor) set `st.fightUntil`; `st.fightK` in the camera block holds the size (envWant/envH/longV/sightLead/fitH shrink), slows the lead (2.4→0.5) and follow (14→6), 900 px snap limit. `swoopTail` 1.6→0.6 s, cut to 0.25 s in a fight; the swoop rise runs 4× faster when aiming or shooting after the crossing. ADS widening is kept.
- `tests/fightcam.mjs` (hidden Firefox): sweeping the aim while shooting, view size ×1.000 (calm up to ×1.07, before the fix ×1.25 shooting), camera travel lower; climb-in glide 0.13 s after shooting.

## 2026-11-18 — bots answer every ping
- He asked: more work on the bots' lines and answers to pings of all sorts; he chose: reply most times, varied, and do it. bots.js `botPing(game, p, pk, x, y, w, id)` now gets every ping (game.js 'mark' always, 'spot' as enemy): go/help/hold as before; omw (one comes along), watch (cmd `face`), enemy (`ai.heard` for all, one faces), danger (+ heard), open (`openPlan`: the cell beside the wall the bot can walk to, avoiding rope spots; cmd `open` uses `doBreach` with a tool or the knife, knife if the charge didn't open it; reinforced + no tool → ansNoOpen), a pinged enemy ent (`game.pingedEnt[team]`, `gadgetShot` always takes it, stepping aside if a teammate is in the line, `ai.pinBlock`), OBJECTIVE. Replies 75% via `replyQ`; Copper/Bronze use `FUN` in `sayTo`.
- comms.js: ansOmw/ansWatchPing/ansEnemyPing/ansDangerPing/ansOpen/ansNoOpen/ansCamPing/ansTrapPing/ansDronePing/ansSitePing/ansSiteDef/trapSeen + Fun versions; `LINES_MORE` widens the common calls. Bots call out traps (`trapSeen`) and say thanks after a revive (game.js).
- Fixed on the way: `doBreach` waits while a charge is being set (`p.prep`) instead of counting it as a failure.
- Tests: `tests/pingwheel.js` (every kind, replies ~75%, varied), `tests/pinglive.js` (all 7 maps: pinged camera shot, pinged wall opened; two tries each since bots are random), comms, sim PASS. `tests/rappel.js` shows 95 failures on the code before this too (not from this work).

## 2026-11-19 — nitpicky screen review
- He asked: a full, nitpicky review of every UI piece and control type; no fluff. He chose: full screen again on his Flip 7, only dodge the camera hole; brief messages on the left above chat; hints shorter and softer as level rises.
- Camera hole: the app (MainActivity `measureInsets`) now sends the cutout's bounding boxes (`holes`) and the edge insets are corners only; touch.js `applyInsets`/`dodgeHole` (every 0.5 s on phones, only when there is a hole) slides any overlapping piece sideways just clear of it (absolute pieces by `translate`, cards in a menu grid by padding so they stay in line; wide panels pass it to their children). A browser only knows the strip's depth: taken as a box in the middle of that edge. `window.__holeTest` fakes one for tests. --sl/--sr are now equal (corners only).
- Brief messages: main.js `addFeed` is a queue shown one at a time in `#feed` (`briefNext`, `briefPlace` puts it just above the chat's visible lines, measured, and the quick-match `#tipNow` above that); `IMPORTANT` notes stay clear, others get `--bk` (softer) and shorter from level 10 / 25 (`briefLevel`). `#viewlabel` folds to its first parts after 6 s (2.5 s from level 10).
- Also: map view `mapBox` (desktop: clear of corner buttons and the top line; phone: between the thumbs, hint under the map), ping wheel clamped clear of the score, numbered duplicate feeds (MY DRONE 1/2), Sound label, settings backdrop + solid panel, sage fx chips, `label.chk` alignment, free play gun pictures brightened, TV caster width, TV draft ? placeholder, phone tips filtered (`tipsNow`), phone `--minpx` 12.2 (12 rounded under the test's minimum on every page: 197 hits before), Zombies lobby text.
- Checked: tests/textsize.mjs pc + phone 0, tests/phonebuttons.mjs 35 states ok, screenshots of every menu page, free play states, Esports TV, Zombies; phone states with real touch taps over BiDi. tests/shoot.mjs retries a cut-short page load. Not covered: a real controller, rope view HUD, a real end screen of a siege match.

## 2026-11-19 — lighter on weak devices (bug + speed round)
- He asked: another bug finding/fixing round, new ideas to run lighter on weak devices without losing gameplay or the look, and simplifications only at Low. He chose (Low only): fewer tiny effects (no shell casings, no per-shot room glow), no camera tilt, calmer menus; NOT simpler body shading; bot practice off on phones (it already was: public/phone/server.js never practises).
- Same picture, every level: `#loading.hidden` is `visibility:hidden` with paused animations (its blurred drifting map and shine kept animating behind every match); raised walls reuse last frame's pieces when the eye moved < 0.05 px, the same cells are seen (`seenHash` of `seenGrid`), the bounds/height/rope look are the same and no wall changed (`st.rfMemo` in main.js `raise`); body shading is one size-1 gradient per colour and canvas placed by translate/scale (sprites.js `shadedFill`), the foot shadow one gradient per canvas (`footShadow`); fx.js lists are compacted in place (`keepAlive`) and capped (`MAX_TRACERS` 300, `MAX_LIGHTS` 40, `MAX_RINGS` 60, they had no limit), casings/chunks drawn without save/restore, bullet trails keep their gradient and fade by globalAlpha; the tilt skips its matrices and restyle when nothing moved by 0.001° (look.js `tilt.key`); `#mapLayer` transform written only when changed (`_tf`); the compass dial redrawn only when the needle moved; `setHTML` compares with the last text it wrote (`el._h`) instead of reading innerHTML; `briefPlace` re-measures only when its inputs change (`briefKey`); off-screen corpses skipped; `st.anim` cleared each round (it kept every drone/decoy ever seen); the 3D rope view's three.js (676 KB) is only imported when `ROPE_3D` is on (a stand-in `rope3d` object otherwise) and `rope3dFrame` returns at once; hidden page: screen timers skip their work and the AudioContext is suspended (`audio.hiddenPause`).
- Low (`GFX.low`): `tiny: false` (fx.js `muzzle` adds no casing and no room light), `tilt: false` (main.js sets `tilt.base` = rope/swoop amount, so the rope camera and window swoop still tip the view from flat; no lean), `calm: true` (`html.calm`: menus drawn 15/s instead of 30, the Operators portrait 20/s, slower loading drift). The dead `grey` preset key is gone.
- Looked at and left: capping input messages to 60/s (merging frames would change how your own movement is predicted), a slower lobby broadcast (tiny cost, other code expects it), simpler body shading (he declined).
- Checked: old vs new screenshots on High (same picture), Low in a hidden browser (0 casings, 0 shot lights, no tilt, calm, loading screen hidden), every map (and the Zombies town) with 6 bots while shooting (no page errors), `tests/fightcam.mjs` PASS, `tests/textsize.mjs` pc + phone 0, wsjoin/feeds/pickup/furniture/shapes/sim embassy PASS. New `tests/perfclient.mjs` (frame cost per PF section, standing and walking + spinning). Another chat's Godot test was using most of the computer, so the frame numbers this time are rough: raised walls standing on High 18 → 5 ms a frame headless.

## 2026-11-19 — crosshair reach +20%
- He asked: up the maximum reticle distance of all sights by 20%; he chose hip fire too. shared/operators.js `AIM_REACH`: hip 18→22, iron 20→24, holo 21→25, reddot 23→28, prism 36→43, scope 44→53, sniper 64→77 m. Everything reads it through `aimReach` (main.js `reachOf`, phone/controller reach, Armory, sniper glare range).

## 2026-11-20 — auto fire off, phone screen a quarter smaller
- He asked: turn off all automatic shooting options and make the mobile UI 25% smaller. Auto fire was the only one: touch.js `autoFire` now reads `r62d-autofire2` (default off, so phones that had it on start off; shim.js keeps it), still in Settings.
- touch.js `fitUi`: `PHONE_UI` 0.75 times --uiz, --hudz and --tz on touch devices. Menus never go under --uiz 0.5 on phones (below that their text, held at the minimum size by style.css --minz 0.5, spilled out of its boxes: tried and measured, 521 small texts / many cut-offs). Free play's phone operator cards 112 → 128 px wide for the same reason.
- Checked in headless phone Firefox: tests/textsize.mjs phone 0 small text and no cut-offs (only #loading's drifting picture past the edge, hidden anyway), tests/phonebuttons.mjs no overlaps (gaps exactly 2.5 px between some buttons), old vs new match screenshots.

## 2026-11-20 — phone bot chatter, 1V1, two small maps
- He asked: no bot chatter on phones unless Esports TV; a 1v1 mode like Jynxzi's 1v1s on small maps only; small 2-floor maps good for 1v1; then (mid-way) to playtest 1V1 hard, two passes, screens and play, and look for things bots never do that drills could teach. He chose: Siege's 1v1 rules, a suburban house and a lake cabin, in 5v5 too, the card in Fun Modes.
- Server chat messages carry `bot: 1`; main.js `addChat` drops them on `isTouch` unless `st.tv`.
- 1V1 and the maps: docs/1v1.md (rules code, `teamSize`/`smallOnly`/`fitMode`, bans every round, two reinforcements a defender, lone-defender prep priority, `soloMode` words, maps, tests, playtest numbers, drill ideas).
- Fixed on the way: mapkit `ratSpots` could put a hiding cabinet in front of a drone hole (both new maps; Harbor Office lost one hiding spot to it).
- Tests: tests/duel.js PASS, tests/duelstats.js (73 rounds: attack 45%), tests/duelshots.mjs (no page errors), reach/openings/stairs/stairsides/outdoors/compass PASS on all maps, sim house/cabin/harbor PASS, modes/wsjoin/arena/defsetup/botreinforce/feeds/pickup/furniture/shapes/randommap/ranked PASS.
- Later the same day: bots keep their personalities in 1V1 (checked), and the bot opponent now talks to you in all chat by how chatty it is (docs/1v1.md "Personalities and small talk", tests/duelchat.js PASS).

## Invisible walls (2026-11-20, he found one)
- He: "a wall between the place i was proning and the site that is invisible", right of A on Lakeside Cabin. It was the Den TV (1x3, standing sideways): mapdraw `tv` only drew a strip at the top of its box. Sideways TVs now draw whole (screen on the wall side); the cabin TV moved to (44,31) against the wall.
- A check of every solid prop on every map, drawn in a hidden browser and measured cell by cell (scratch script, like tests/shoot.mjs), found the same fault in: `crates` (always drew 2x2), `chairs` rows (w > h drew one seat), outdoor `swings` (a solid 3x7 drawn as a bar; now drawn with their frame and LOW). After: 0 under-drawn cells.
- Same day, later (all he asked): 1V1 bans have no clock for a person (`B.t = Infinity`, NO BAN = `ban` op `'none'`); Armory aim-in treats targets as people (armory.js `adsAim`, like main.js `adsReset`); defuser sounds (audio.js `defuserAlarm` chirp through `out()` range 2200, `arming` / `disarming` foley; measured with `measureMix`, which now lets a test put walls in the way); defuser countdown 45 → 35 s (tests/bombtime.js, `R62D_BOMB`); 1V1 round ends checked (tests/duelends.js PASS); the room line in the objective box (`fxOn('room')`, phones: `--objB` moves #bl under it); per-gun penetration (`PEN_GUN`, `penWalls`, `penBrick`, `furnPen`; docs/balance.md "Penetration").

## Pros practising on the main screen (2026-11-20)
- He asked: show on the main screen that the pros are practising, and let it be cancelled (he chose: stopped until the game is next opened).
- index.html `#proPrac` in the home footer (sage strip, STOP `#ppStop`); main.js `trainInfo` shows/hides it and the 4 s poll also runs on the home screen (`onHome`). server.js `POST /api/train/stop` sets `trainHeld` (stops the threads); `trainCheck` refuses while held unless forced by TRAIN THE PROS; `/api/training` sends `held`. The hold lives only in the running server, so it ends when the game is next opened.
- Checked on a spare port with throwaway data: stop holds, TRAIN THE PROS restarts; headless screenshot of the home screen at 1600x900.

## Phone move stick further in; cut-off text everywhere (2026-11-20)
- He: "the left joystick is too close to the edge… my thumb slides off the screen"; best default controls for every scheme; no cut-off text anywhere, especially phones.
- touchlayout.js `LC` 100,-100 → 140,-132 (style.css `#touchUI.rings #tsLeft` 74/66): a full push (MOVE_R 81) at --tz ~0.72 now ends ~50 px from the left and ~45 px from the bottom. tests/phonebuttons.mjs: no overlaps on all 7 sizes.
- Controls reviewed, unchanged: keys are CS2-style (his), controller R6 Xbox (his), trackpad preset (Space fires), phone fire rings and stick feel (his).
- tests/textsize.mjs now also tours ranked, every INTEL page and its tabs, the scoreboard, the map and the end screen. Fixed: Armory gun card picture 4 px too wide, folder titles and RELOAD; Map Knowledge layers one column on phones; Ball Knowledge header wraps; ellipsis names now wrap (#mapPick, TV cards, replays, phone objective line, phone operator names, op select skill names with a smaller picture); Free Play operator cards on phones. main.js `--objB` now follows a ResizeObserver. Ball Knowledge closed cards still report CLIPPED on purpose; #loading's drifting picture too.

## 2026-11-20: start zoom, the walk-in, phone sprint / AIM, buttons never hide enemies
- Outside zoom: main.js `OUT_H` 640 → 470 and used as the fixed outdoor view (sightlines no longer widen it; the crosshair fit still does). The spawn (`st.spawnKey`) resets envH/envWant/fitH/farS so each round starts at the resting size. Measured before: 591 tall outside vs 300-500 in rooms.
- Walk-in: server game.js `startIntro` / `introStep` / `endIntro` (INTRO 3 s, INTRO_TURN 0.45): at beginAction each attacker is put on the longest clear straight line back from their spawn spot (32 directions, leaning outward from the map centre, up to a sprint's 3 s) and moved along it directly (no physics: teammates side by side would push each other off their spots); mods `frozen` for everyone, inputs and events ignored, `p.click` cleared, tickEnts carries on, the clock waits; snapshot `it`. Not in the tutorial, free play, fun modes, drills. Client: `introNow()`, own body and aim ride along from `interp` like Esports TV, no input sent, no crosshair, the spawn crosshair placement after. tests/intro.js (all maps). Tests that waited for PHASE.ACTION now also wait for `introT` (28 files).
- tests/pickup.js counted every entity on the map (other things expiring made it fail by chance): now only the player's own. The mason dshield case fails now and then on old versions too (space to place it).
- Phones: touch.js sprint = a flick (FLICK_MS 230 from under FLICK_FROM 0.35 to FLICK_EDGE 0.95, path at least 80% straight), off below SPRINT_OFF 0.6; the double-tap and the tap-to-aim on the aim stick are gone; AIM is a ring piece on the aim stick's inner band at -176..-137° (touchlayout.js). A tap button now registers its finger (AIM, ACTION, ?): the same finger reported again when the other thumb landed flipped it back. tests/thumbs.mjs SCENARIO=rings updated.
- Phones, buttons never hide enemies: main.js `coverDodge` (touch.js `coverShapes`: stick circles with rings, button boxes): seen enemies (st.foesNow, filled while drawing), the sightline's far end and the aim stick's far point are pushed out from under covers by sliding the camera (towards the middle, at most 32% / 30% of the screen, never putting you under a button), in at rate 5, back at 1.5 after 0.8 s clear (held while anything is within 40 px). tests/phonecover.mjs (st.testFoe stands in for a seen enemy).

## 2026-11-20 — 1V1 meta test (he asked: which operators are so strong they should be perma-banned; "Wraith is an example")
- `node tests/duelmeta.js [rounds] [level] [workers] [--save f.json] [--add a.json,...]`: bot-only 1V1 rounds on the small
  maps in worker processes; each round each side gets its least-played operator (ties random), bans off, select 2 s. Win rate
  is moved onto a 50% scale for its side ("strength", because attack won 45%), Wilson 90% range; PERMA-BAN? = strength
  over 60% and its range above 55%. Checks every round that the given operator and its gear were kept. ~1 CPU-second a round:
  12,600 rounds took 11 minutes on 15 workers.
- Result (level 5, 12,600 rounds, ~400 a operator, ±4%): MASON 63%, SHUNT 62%, ECHO 62% (PERMA-BAN?); TALON 59, HUSH 59,
  HAZE 57, HOIST 56 (strong); weakest PERCH 36 (WEAK), LOCKJAW 40, NAIL/KESTREL/LATCH/BRAMBLE 41, OSPREY 42. WRAITH 50%.
  Lone-defender site lockers (Mason's steel panels, Shunt's anti-breach grid) shut the bots' entry; Echo's spikes find the
  lone defender. Bots scan with WRAITH only when they hear something or now and then and only walk to the blip, so the test
  cannot judge how strong the scanner is in a person's hands. Nothing changed in the game. He said: no bans yet, major changes are coming; rerun the test after them.

## 2026-11-20: Ferro's skill count, skill drills, testable pro suggestions, balance patch, bot limits
- He asked (5 items): why FERRO looks strong but uses his skill 0.0 times a round; drills for every operator's skill with
  the pros suggesting drill changes; detailed pro suggestions testable in balance patches; a balance patch with notes in
  VibeNote for what numbers can't fix; the limits of bot tests (WRAITH in 1V1).
- Skill uses: game.js `p.abUsed` (limited skills counted from every drop in `abilityCount`, reset on equip; never-ending ones
  where they start: hammer `used()`, scan start, shroud on, brace switch, a stretch of lance/weld). train-worker x[5] uses it;
  opx grew to 10 numbers (uses start over). tests/balance.js prints uses a round, main-gun share and the two patterns.
- Skill drills, pros' drill ideas, R62D_TWEAK, tests/protry.js, tests/skillgap.js, BALL KNOWLEDGE (DRILLS → SKILL DRILLS, PRO
  IDEAS: the change and its test): docs/drills.md. Bot limits: docs/bot-limits.md. Balance: docs/balance.md.
- Bot fix: PERCH Overwatch (0 → 0.5 a round). Lesson: practice.js without `R62D_DATA` writes a fresh data/ in the project.
- Checked: skilldrills 21/21, abilities, oldops, newops, drills, duel, botroster, sim PASS; pickup failed once by chance
  (mason dshield, known) and passed again; textsize pc 0; BALL KNOWLEDGE screenshots.

## 2026-11-21: his answers to five balance questions (Ferro, 1V1 heavies, plants, intel, Dust Town A)
- He chose (plan phase 2026-11-20): FERRO's hammer for soft-wall holes + reinforced hatches; a smaller armour gap; teach bots
  to play for the plant; teach bots to use information, then trim WRAITH/ECHO only if too strong; Dust A: an extra
  reinforceable wall, a safer rotation and fewer ways in. Details and numbers: docs/balance.md (2026-11-21).
- Code: game.js hammer branch (`sawHole` on `T.SOFT`, `p.hammerHatch` for `T.HATCHR`); operators.js `ARMOR_HP` 136/132/128;
  bots.js `BREACH_TOOLS.hammer` (`swings`), roof plan with FERRO, `planPush`/`escorts` in proAct, `ai.intel`/`intelNow`/
  `intelWait`; mapkit.js site `win` (how many windows the kit adds, default 2); maps/dust.js (Spice Passage, closed openings);
  tweaks.js root `ARMOR_HP`; tests/bombtime.js `R62D_LVL`; tests/oldops.js FERRO checks.
- Checked: oldops 47/47, newops, abilities, feeds, ropebots, botroster, duelends, sim, reach (dust 0), openings PASS;
  stuckbots 2 (known by chance), pickup mason dshield (known; fails on the old version too). Screenshot of the Spice Passage.
- Lesson: a background job started with `&` inside `nix develop --command sh -c` dies with that shell; run the whole
  comparison as one background command instead.

## 2026-11-21 (later): one damage scale

He asked for guns, health and gadget damage to be tuned together so "a little" and "a lot" mean something. He chose
the scale in docs/damage.md: 100 health for everyone, five words (scratch / a little / a lot / most of you / deadly),
bullets the same on every armour, armour softens blasts and gadgets only (`BLAST_ARMOR`, `blastArmor` in game.js:
heavy 0.75, medium 0.9). He chose to keep the words behind the scenes.
- Every gun ×100/132, nudged to keep its body shots on a medium (41 guns, none changed count; Verdict aimed 36).
  Gadgets, heals, revive health, down limit, low-health warning, arena infected (121) scaled the same way.
  Zombies keep their toughness (`ZB_OLD_SCALE` 1.32 in zombies.js).
- Results: 1V1 (1200 rounds, pros) attack 48% (was 43%); heavy defenders 51% (were ~57%), Shunt still 68% (his grid,
  not health); light defenders 57%. 5v5 balance (227 rounds) attack 50% (was ~44-46%).
- Checked: snipers, newguns, shotguns, zombies, abilities, pickup, sim PASS; oldops/newops/sniper updated to the
  new numbers and pass (sniper's Saker check sometimes misses on furniture, by chance).
- He asked: pictures in the chat only show at the top of his view. Open pictures on his screen
  (`play-on-desktop insideabush imv <png>`) and write choices out in words. He put a pop-out feature for his
  computer on his own notes list (~/notes-list.txt) to do later himself.

## 2026-11-21 (later): hatch view outline, safe tutorial
- He asked: an outline on the views up and down through hatches. He chose soft white, thin solid line. main.js
  `drawHatchView`: inside the three clips (sight polygon, opening, ring from below) each clip path is stroked at twice
  the width, so only the inner half shows: exactly the edge of the patch. Dark pass 3 px, white 1.5 px (screen, DPR).
- He asked: look through the tutorial, don't let the bots kill you or the drone. `damage()` already ignored tutorial
  bots and they never shot people, but the drone branch of botThink (`enemyDrone`) had no tutorial check. Now
  `game.tut` skips it, and game.js `tutSafe(e, src)` keeps a human's gadgets/drones/cameras from a bot's hit
  (`hitEnt`) or blast (`explode`). tests/tutorial.js now puts a drone in front of every defender for 20 s (fails
  on the old code: 2 of 2 drones broken).
- Checked: tutorial, hatches (one chance fail on Lodge reinforce, passes 3/3 again), abilities PASS; hidden-browser
  shots of both views on Harbor.

## 2026-11-22: smooth sprint turns, nearer aim-in
- Chris S's first remark was that the view turns too sharply; he meant sprinting. On a computer the 8-direction sprint
  snapped `st.aim` round at once (only the picture glided ~0.1 s). Now the aim itself turns at `SPRINT_TURN` (180° in
  0.4 s, his pick) into the sprint and back to the crosshair after (his pick: smooth too). Because the server sprints
  only within ~60° of the aim, you run at normal speed mid-turn. Shooting or aiming in ends a turn at once.
- He asked: aiming in puts the crosshair 20% nearer with iron sights and red dot, 10% nearer with the rest
  (`ADS_PULL`); the sniper scope still goes as far as you can see.
- Checked: `tests/sprintturn.mjs` (hidden browser: 90° and 180° turns in steps of at most 23° a frame, the let-go swing,
  a click mid-turn lands on the crosshair at once), `sim.js --only house` PASS, `abilities.js` PASS.

## 2026-11-23: walk-on, hole view, scope veil, ability notes, minimap
- Walk-on: only attackers are held (`introHeld(p)` in game.js: input, events, `frozen`, damage). Defenders run the
  normal tick (bots think) during `introT`; walking-on attackers can't be hurt (he chose). Client `introNow()` is true
  only for attackers (and TV). tests/intro.js now expects defenders to move; tests/introdef.js checks both rules.
- DEADFALL's hole / any hatch, looking down: `hatchSight` (shared/map.js) gives the view `eye: HATCH_EYE` (ceiling
  height, 116 px), and the team's look-into-hatch view too, so furniture below only hides what is under/behind it
  (castSight by eye height, furnLine for bodies). Checked: ~1 in 5 of 500 hole spots used to have the view cut.
- Sniper veil/lens: they were only hidden from inside `crosshair()`, so any frame without a crosshair (end screen,
  drone, next match) left them up. `frame()` hides them when the last frame drew no crosshair (`st.xhRan`).
- Ability notes: `spot(team, id, dur, src)` → `intel(src, qid)` sends `{ e: 'intel', id: owner, w }` (no bots), at
  most every `INTEL_AGAIN` 8 s per gadget+enemy; also WRAITH's scan (unnamed) and AUDIT's drone radar. Client shows
  it through `addFeed`. tests/intel.js.
- Minimap: `#minimap` under `#objective` (top `--objB`, measured by the objective's ResizeObserver now on computers
  too), `drawMinimap`/`miniPic` in main.js beside the compass. Picture per floor/site/state cached in `st.mini`
  (framed on indoor cells only), redrawn per frame only when your arrow moves. Hidden on phones (`isTouch`,
  `html.touchplay`), TV, arena; setting `minimap` in Screen effects. `#allies` moves down while it shows.
- Checked: intel, introdef, intro, abilities, oldops, newops, furniture, shapes, prepff, feeds, sim PASS;
  textsize pc 0 small; hidden-browser shots as attacker and defender on Harbor.

## 2026-11-24 — Tutorial: out of the middle, much more handholding
He asked: the centre cards covered everything; more handholding like the Counter-Strike / Valorant tutorials. He chose
(asked together at the start): a top-left objective list, a gold marker + metres + an edge arrow when off screen,
the reading parts as one-sentence tips with no pause, and a longer run (about 6–8 minutes).
- tutorial.js rewritten: `STAGES` (part, phase, title, `tips`, `goals` with `t`/`done`/`at`), flattened into `GOALS`
  (33). The panel shows the stage, a checklist (✓ done, ▸ now) and a tip that changes every 7 s. Nothing blocks any
  more (`blocking` is always false); Space skips a goal in select/prep, finishes on the last goal; phones get SKIP.
  New drills: drone drive/sprint/into the building/through a drone hole, run, walk, crouch, sprint, lean L/R (not on
  phones), aim in, shoot, reload, the marked way in; defending: go to site, reinforce, barricade (marked), open
  cameras, flip, ping, back to body, stand by the objective, crouch, take both down.
- Markers: `coach.target()` (nearest spot on your floor: outside openings `ext`, drone holes, the site's soft walls
  and open doorways, bombs); main.js `drawCoachMark` after `drawMarks` draws the gold ring/label/metres, or an arrow at
  the edge; another floor says ▲ UPSTAIRS / ▼ DOWNSTAIRS.
- Server: `tutTrack` counts what you do (metres moved/walked/sprinted, seconds crouched/leaning/aimed, shots, reloads,
  vaults, drone metres/sprints/drone hole, cameras opened/flipped) into `tut.info`; `tutInfo()` rounds it for the
  snapshot (rounding per tick lost everything: a tick adds 0.03). The tutorial's action clock no longer runs.
- CSS: `#coach` sits under `#objective` (`--objB`); in the tutorial (`html.tutorial`) the minimap and stair picture
  move to the right so they don't stack under the list.

## 2026-11-24 — Aim exactly on the reticle (rope, leaning)
He asked: aiming and shooting through windows on a rope must be perfectly accurate to the reticle; with the Saker LR
and 2x scope his shots seemed to go right.
- Cause: the server fires from `leanPoint` (the tipped upper body) but the client sent the aim angle from your feet
  (`st.pred`), so a leaning shot ran parallel to the crosshair line, `LEAN_PX` (6 px) to the lean side (lean right =
  right). sendInput now aims from `leanPoint` too (also when raised walls are off).
- Body under the crosshair: where people are drawn, main.js `draw` pushes each body (not you) to `st.cols` (real spot,
  lean, base height `bz` = furniture/stair/rope height, `zk` crouch/prone, upside down); sendInput `bodyAim` finds the
  drawn body column (0..0.6 of a body, `BODY_PICK` 9 px) nearest the crosshair: the bullet goes at the matching spot of
  the real body, and the sent `ax/ay` is as far from their real middle as the crosshair is from their drawn head (0.49),
  so the red head zone is exactly the headshot rule. Off any body, the old general correction (a standing head) stays.
  Head zones/rings now use the same base and height as drawOperator (a climber from the rope height, upside down).
- Test: `tests/ropeaim.mjs <port> <url>` (fast server): hangs you at a window (boards opened; `BOARDS=1` keeps them),
  Saker + 2x scope aimed in, a still dummy at 7-9 spots inside, the crosshair kept on its drawn head or chest each frame,
  fires; prints how far each bullet passed from the real body. `FOOT=1` the same standing inside, `LEANS=0,-1,1`.
  Before: no lean 0-3.5 px (chest), leaning 6-9 px. After: worst 0.14 px on a rope, 0.05 px on foot; head aims all count.
