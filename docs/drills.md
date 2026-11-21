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
- **Ideas** (he asked 2026-11-18: suggestions from people who grew up with the game): `formSuggestions` (opinions.js,
  run by `formOpinions`): each pro puts forward one change, a HOLE (a bomb site one side wins over 64% / under 36% of
  25+ rounds, `training.plans`; an operator whose team wins 7+ points under the side average, `opx`; a map where 20%+
  of rounds end on the clock, `training.ends`) or something to TAKE OUT (a mechanic in `MECH` that happens under 1.5
  times per 100 player-rounds on this version, `training.featV`, judged once there are 300). Weighted by role
  (`ROLE_CARES`), style and a quirk, fewer when others already said it; opened in their own voice (`CARE`). Logged in
  `training.suggestions[name]` (last 20), shown in BALL KNOWLEDGE → PRO IDEAS (most-backed first). New habits counted:
  `droneCheck`, `hatchBlast`, `stairKill`.
- Shown in BALL KNOWLEDGE (tabs GUNS, ATTACHMENTS, MAPS, DRILLS, PRO TAKES with the patch notes), PRO IDEAS and on each pro's
  PLAYBOOK page (THE WORST THING IN THE GAME, IN THE DRILLS).
- Tests: `node tests/drills.js [n]`; a throwaway practice: `R62D_DATA=<tmp> node server/practice.js 40`.

## Skill drills (2026-11-20, he asked: "drills so the operators can train using the characters utility in a variety of situations")
- `server/skilldrills.js`: a 1V1 round on a small map (`runSkillDrill`), set up as a situation (`SITUATIONS`: entry, upstairs,
  retake, hold, roam, late; `SKILL_SIT` = where each skill should pay off). Every drill is played with the skill and with it
  locked (`p.abLock`: game.js useAbility and held skills ignore it) → `training.skillDrills.sit['op|sit']` =
  [with: rounds, won, locked: rounds, won, uses].
- Learning: `training.skill[pro][op].eager`, tried ×1.12 and ÷1.12 in drills; moves toward the one that wins (4+ each), read
  in every match by bots.js `skillEager` (multiplies the random "use it now" chances and shortens the waits in `botAbility`).
  `R62D_EAGER=<n>` sets it for every bot (tests).
- Per session: 30 pairs per practice thread (`train-worker.js` → `addSkillDrills`; `closeSkillSession` adds each pro's win rate per
  situation to `prog`).
- The pros' drill ideas (opinions.js `formDrillIdeas`): stuck (no better over 3 sessions → longer clock or the other map),
  no help (with ≤ locked over 8+ each → drill it in its best other situation), not real (after-the-plant drills while under 12%
  of rounds get a plant). Two pros backing one change within 3 sessions adopts it (he chose) → `skillDrills.tweaks`
  (`sitFor`, `time`, `map`), read by the next session. Shown in BALL KNOWLEDGE → DRILLS (SKILL DRILLS).
- Tests: `node tests/skilldrills.js [pairs]`; `node tests/skillgap.js` (docs/bot-limits.md).

## Detailed, testable suggestions (2026-11-20, he asked)
- opinions.js `ideas()`: an operator suggestion carries `fix` (exact `{ path, to }` changes) and `focus`; `strongFix` /
  `weakFix` pick one small step (main gun damage ±6%, a skill use more or less, a recharge a fifth shorter). Site and
  mechanic ideas stay words (a map change or a rule is his decision).
- `shared/tweaks.js`: `R62D_TWEAK` (JSON `[{path, to|mul}]`, roots OPERATORS, WEAPONS, PEN_GUN, DUR, LOADOUTS) applied at server
  start; worker threads and child processes get it.
- `node tests/protry.js [rounds] [--5v5] [--top n] [--save] [--fix '<json>' --focus a,b]` (tests/_measure.js): each fix
  without/with, the focus operators forced into every round; `--save` writes `training.tested[id]` (set R62D_DATA to the real
  data folder), shown under the idea in PRO IDEAS ("The change … Tested …").
