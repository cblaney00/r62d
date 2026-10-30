# r6-todo — ideas for R62D

insideabush's list of next ideas. Claude works through it top to bottom: when one item is
finished it gets ticked and moved to **Done**, then work continues on the next one.
New ideas from him get added to the bottom of **To do**.

## To do

- [ ] Maps are too blocky and boring: more interesting shapes (angled walls, curves, alcoves, varied room sizes) instead of plain boxes.
- [ ] Floors, part 2: hatches in floors/ceilings to break open, hearing/seeing through them.
- [ ] Vaulting like R6: you have to vault over things (low cover, windows, broken soft walls), and it leaves you open for a moment while you climb over and recover.
- [ ] Fewer soft (breakable) walls: right now there are far too many ways into a site by just blowing open the whole room.

## Done

- [x] Defender cameras hang on walls and up in corners (same spots every round), small and dark so they blend in, and break from one bullet, a hit, a blast or their wall coming down.
- [x] Faster aiming: aiming down sights takes about half the time and zooms the view in quickly; the view no longer slowly drifts in and out as you turn.

- [x] Balance pass from ~300-round bot simulations (tests/balance.js, docs/balance.md): Bulwark reworked (pistols, hip-fire, melee knocks the
      shield aside), shotgun pellets can't one-tap headshot, Mule/Hornet/pistols toned down, traps and a few gadgets softened. All operators 39–59%.
- [x] Slower movement, calmer bots that react to sound, loading screens so nothing loads mid-match.
- [x] Lighter on other computers: game updates compressed and trimmed (about 6× less internet traffic per player), "Auto" graphics
      that picks the quality for each computer and lowers it by itself if the game can't keep up, lighter Low setting, no start-up freeze from sounds.
- [x] Gun pictures everywhere guns are chosen or shown (Operators page, pick screen, Armory, in-game ammo corner), with plain type names
      ("Breaker-12 · Shotgun") and a one-line tip. Attachments per gun, saved per operator: barrel (suppressor, compensator, muzzle brake,
      extended), grip (vertical, angled, laser), sight (red dot, holo, 2× scope) — each changes aim speed, recoil, spread, damage or noise a little.
- [x] 15 attackers and 15 defenders (he changed 30 to 15 each). New attack: Rivet (thermal lance), Haze (smoke barrage), Glint (sonar),
      Brisk (adrenal shot), Onyx (cluster charge), Prism (holo decoy), Volt (arc gun), Tether (wall scope), Strider (ghost step), Ferro (hammer).
      New defence: Bramble (proximity charge), Kite (turret camera), Gravel (daze mines), Shunt (static grid), Hush (silent shroud),
      Shade (sound sensors), Rampart (armor bag), Miasma (toxin gas), Snare (clamp traps), Argus (sticky cams). Pick screen: 8 per row + details strip.
- [x] Crosshair settings: style (cross, dot, T, circle…), colour, length, thickness, gap, opacity, outline, opens up when moving; live preview; saved per profile.
- [x] Armory (main menu): private shooting range with every gun, dummies at 5–45 m, real damage/drop-off/spread/recoil/headshots, stats and time-to-kill.
- [x] Site setup like R6: defenders choose which site to defend during operator select; setup tips during prep.
- [x] Floors: every map has 2–3 floors joined by stairs (inside staircases, outside fire escapes, garage ramps); bots use them.
- [x] 5 more maps, chosen in the lobby: Cliffside Villa (B·1F·2F), Rail Depot (1F·2F), The Embassy (B·1F·2F), Alpine Lodge (1F·2F), Clocktower School (1F·2F·3F); Harbor Office got a 2F.
- [x] Realistic footsteps: heel + toe strikes ringing each floor material, sole scuff, crunch grains on gravel/grass/glass.
- [x] Speed: map drawn by the browser as moving tiles, blackout and markers on their own layers — frame time 20 ms → 7 ms.
- [x] Graphics settings: Fullscreen on/off and one quality choice (Low / Medium / High / Ultra).
- [x] R6 aiming: headshots one-tap, ADS accurate even moving (with aim-in time per weapon), recoil you pull against,
      damage drop-off. Peeker's advantage like R6: server judges shots by what the shooter saw (~125 ms + ping).
- [x] Chat: Y opens team chat, / switches team ⇄ all, Enter sends, Esc closes.
- [x] CS2-style controls for players coming from Counter-Strike: run by default (no sprint), Shift = silent walk,
      Ctrl (hold) = silent crouch, E = use, 3 = melee, 4 = gadget, Q = operator skill, 5 = drone/cams, middle mouse = mark.
      Accuracy drops while running (stop or crouch to shoot straight). Ctrl can't close the full-screen window.
- [x] Aiming down sights: narrower field of view, slower movement, lower mouse sensitivity. The mouse is captured in matches
      (Esc releases it and pauses); Mouse sensitivity + ADS sensitivity settings, saved per profile.
- [x] Opens straight into fullscreen: the desktop icon starts its own Firefox window in kiosk mode (no browser bars,
      separate profile). In a normal browser it goes fullscreen on the first click.
- [x] Quit to desktop: Esc on the title screen / menus, QUIT in the side menu, and in the pause menu.
- [x] Softer sounds: all menu sounds reworked to low, warm clicks and whooshes (measured and balanced); in-game chirps
      lowered (hit marker, plant beeps, marking, camera switch, empty click, casings). Flashbangs now ring your ears.
- [x] Settings and key bindings are saved per profile (follow you to any browser/computer).
- [x] Premium feel: title screen with logo reveal, original menu music (dark, layered, not corny; own volume slider),
      main menu with side navigation and sliding highlight, player card with level/XP, rotating tips, hover/click sounds and
      ripples on every button, animated pages, operator cards that deal in and lock in, 3-2-1-GO countdown, sliding kill
      feed and banners, end-of-match screen with MVP, stats counting up and an XP bar with level-ups.
- [x] Pause screen (Esc or P). In fullscreen, Esc leaves fullscreen and opens the pause menu.
- [x] Drone: about a foot long, half as wide (a low rectangle), one small red dot in the middle of the top; wheels spin, it leans and sways; can't drive under furniture
      (still fits through barricade gaps); soft electric motor sound instead of the whine.
- [x] Drones break: 1 hp, so one bullet, melee hit, blast or zap destroys one (shots count where you saw it moving); the pilot drops back to their body and their team is told; defender bots shoot drones they see.
- [x] Realistic gunshots: pre-built recordings per weapon (crack, blast, boom, echo off walls, action click).
- [x] Operators page: bio, armor/speed, skill, loadout choices (primary, secondary, gadget), your stats with them.
- [x] Saved profiles for everyone who plays: loadouts and lifetime stats (Profile page).
- [x] Match history: every finished match with each player's stats and round-by-round results.
- [x] Sound mix balanced by measurement (see docs/sound.md).
- [x] Weighty movement with real steps: you speed up/slow down, speed pulses with each stride, and each footstep sound
      plays exactly when a foot plants.
- [x] Footstep sounds for every surface: wood, tile, marble, carpet, concrete, asphalt, grass, metal floor, rubble,
      broken glass under windows, splinters where barricades were smashed.
- [x] Grey "remembered" map instead of black: out-of-sight areas show as a dull grey map.
      Shared vision (you, teammates, their drones, working defender cameras) shows live in colour.
      Enemies/enemy gadgets only show inside shared vision. Enemy-made map changes out of
      your team's sight stay hidden until someone on your team sees them.
- [x] Security cameras you aim with the mouse and switch between (A/D, arrows, wheel, camera bar).
- [x] More keys like Siege: slow walk (Alt), 4 = operator skill, 3 = gadget, F = interact,
      T / middle click = mark enemy, plus a settings screen (O) to change any key and the volume.
- [x] Much better sound: footsteps per floor surface, small sounds for nearly everything
      (turning on the spot, aiming, crouching, reload stages, swaps, hammering…), muffled
      through walls, room echo, bullets whizzing past, drone motors, heartbeat when hurt.
- [x] Legs move when a character turns on the spot.
- [x] More detailed characters.
- [x] Zoom in closer; only zoom out outside or down long hallways. Camera stops at the map edge.
- [x] Even closer zoom (about a quarter closer everywhere, drones too).
- [x] Field of view like a modern shooter (≈103°, narrower when aiming down sights).
- [x] First playable version (5v5 Quick Match, 10 operators, Harbor Office, bots).
- [x] Desktop / app-menu shortcut.
