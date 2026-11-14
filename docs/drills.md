# Pro drills, patch knowledge and the pros' views (2026-11-14, he asked)

- **Drill Hall** (`shared/maps/drill.js`, kept out of `MAP_LIST`): closed concrete hall, a line of steel braces
  (`T.BEAM`: blocks walking, not sight or bullets) down the middle, two bulletproof blocks across it, a start wall
  and crates per side. `makeMap` now allows a map with no upstairs (no roof).
- **Drills** (`server/drills.js`): `duel` 1v1, `trade` 2v2, `hold` (side B only has to survive), `clutch` 1v2; a
  simulated minute each (`DRILL_TIME`), no skills/gadgets/drones/downs (run as an arena game, `g.arena.mode = 'drill'`
  + `g.drill`). Bots use `drillThink` (end of bots.js): the real fight rules plus a style (`p.drillStyle`: lean,
  crouch, strafe, patience, trade, walk), patience shrinking with the clock. Scoring `DRILL_PTS` rewards kills,
  trades, headshots, the first kill, winning, holding; punishes deaths, running in the open, dry peeks, timeouts.
- Each practice session (`train-worker.js`) ends with 60 drills a thread → `addDrills` (training.js) →
  `training.drills` {n, kinds, pro (sums), feats ([won, fights] when only one side had the habit), style}.
  `learnStyles` moves each pro's style toward habits that won fights; `drillMul(name, knob)` lets the style move
  their match leaning and peeking (0.5×–1.5×).
- **Patch notes**: `shared/patchnotes.js` — add a line for every change to how the game plays.
- **Views**: `server/opinions.js` `formOpinions` after each session (server.js / practice.js): each pro picks the
  worst operator / gun (vs its own kind) / attachment / map / rule, weighted by role, style and a personal quirk,
  logged in `training.opinions[name]` (last 40).
- Shown in BALL KNOWLEDGE (tabs GUNS, ATTACHMENTS, MAPS, DRILLS, PRO TAKES with the patch notes) and on each pro's
  PLAYBOOK page (THE WORST THING IN THE GAME, IN THE DRILLS).
- Tests: `node tests/drills.js [n]`; a throwaway practice: `R62D_DATA=<tmp> node server/practice.js 40`.
