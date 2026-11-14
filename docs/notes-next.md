# Things worth doing next (Claude's notes, not his list)

Written 2026-11-05 at the end of the defender-bots / sniper batch. These are follow-ups Claude noticed; nothing here is
on his to-do list unless he asks for it.

- Bots ignore scope glare: they don't take cover or avoid the angle when a sniper glints at them. People do.
- No sound for the glare (just the glint). A faint "ting" when it first lights up could help; ask him.
- Glare and the Saker LR have not been played by him yet; the glint size (about 40 px) may need tuning on his screen.
- Rotation holes only fit on about half the rounds: `hardenWalls` leaves few soft walls between a site room and the
  rooms beside it. Map changes were left out on purpose (he chose bots only); he mentioned the maps have too many
  hallways, so a later map pass could turn some hallways near sites into rooms worth holding.
- With the new defence, attack wins went from 56% to about 58-60% for ordinary bots and 46% to 53% for pros. If
  defence feels weak, the first knobs are how long the outer pair holds (`game.timer > 40` for 'space' in bots.js)
  and how many reinforcements the earnest bots spend.
- Pros will only start picking the Saker after practice has tried it (training learns guns per operator).
- Defender bots still don't open rotation holes with shotguns or hammers, only melee; slow but works.

## Bot audit 2026-11-10 (tests/audit.js [level] [matches] [map]) — open findings
- LOCKJAW: bots rig hatches in prep, but almost every trap is destroyed while the hatch is still shut (3/3, 4/4, 4/5): attackers shoot or blast it first. Maybe hide it (seen only within 2 m like other traps), or let it survive bullets.
- "shot from further than any gun reaches" (judgeKill, > 2200 px) shows up with Longbow/Verdict/Hedge kills: probably a stair or window copy across floors measured as plain distance. Not checked yet.
- "bullet through concrete" reports still appear now and then (Heron, Ferret, Tandem); leaning shots are excluded now; the rest not yet explained.
- HOIST: grapple used only ~3 times in 30 rounds (roof plays need a site under the roof). PERCH still sets the bipod ~5x a round.
- Pro practice (600 rounds) ran on the version before these bot fixes; the game re-practises by itself on the next start.
- 2026-11-10 later: fixed from the audit: bots see hidden traps only within 2 m like people (HIDDEN_TRAPS in bots.js; they used to clear every trap from 16 m), LOCKJAW rigs ~1 hatch a round, DEADFALL a hole most rounds, bots keep off hole rims (falls by accident now mostly in fights), bots never set breach charges on the floor, killcam judge: distance in the building frame and wall checks to the whole body (no false "bug" reports left in 4 audit runs).

## After the volume / rope view work (2026-11-14) — Claude's notes for later (not his list)
- Camera glitch climbing onto the roof: the building is drawn small and tilted for a moment (frames ~f0035-f0045 in screenshots/his-play-2026-11-14). Probably the floor switch + rope-camera glide (st.rt, ropeBaseH) jumping; ease the eye/zoom across the floor change.
- Hatch view and stairs view (drawHatchView / drawStairView) are still drawn flat like the window view was: shrink them toward you by 1 -/+ persp.h for the storey between, as drawWindowView now does (st.winKp), and convert the aim the same way.
- Wall ghosts / "▲ ON THE WALL" copies of climbers and window peekers on the ground are drawn flat too; check they line up with the facade now drawn below upper floors.
- The ground far below past the side edge of a building is still the old dull blur (groundBelow only covers strips out from facade feet). Could draw the whole void with the shrunk view far below.
- Normal (non-rope) view: people still mostly show their tops (11° tilt). If he wants more, consider a bit more RAISE_H with x-ray outlines of people behind walls.
- Frame rate on a rope when not peeking is ~85-93 fps (wide view). If he feels it: drop wall surface lines further out, or the storeys-above group.
- tests/roofbots.js and tests/ropebots.js sometimes crash in hitscan → damage (headshot branch, game.js ~1206); seen before these changes. Find the error message (it scrolls off) and fix.
- His own "shading from light sources" note is on r6-todo.md (look.js lightMap has the lamp/window light per cell to build on).
- Next item on his list after this: pro/bot team colours (he chose Northwind silver, Ironclad gold, varied bot pairs, colour settings for his own matches).
