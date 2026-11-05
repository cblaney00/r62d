# Paused 2026-11-04 (second session): items 1-4 of his list

His answers: scope = detailed reticle, view round the lens blurred + dimmed but movement shows; Shift steadies for as
long as held (like the AWP). Reach ring: a faint ring that fades in only near the limit. Loadouts: attachments shared
per gun, a tick "Only for <operator>" keeps one operator's own. TV: more wide map shots with both teams' sight in their
colours, on the floor where the action is (not always the bomb's floor).

## In the code (tests pass: attachments, aim, weapons, sharedguns) but NOT yet played or screenshotted
- Item 1 sniper/long view: everything from before plus Settings slider `steadySens` (Mouse & Aim), `#scopeVeil`
  (backdrop blur + dim with a clear lens, `scopeVeil()` in main.js, plain wash on Low), sniper reticle in `sightLook`,
  normal crosshair hidden when scoped (`me.at` > 0.6). Sniper `ads` 1.3; tests/attachments.js allows its pin-point spread.
- Item 2 reach circle: `AIM_REACH`/`aimReach` in shared/operators.js (metres: hip 18 … scope 34, sniper 48),
  `reachOf` in main.js replaces `FIT_H`; view grows to fit the circle; crosshair glides back in when the reach shrinks;
  faint dashed ring past 82% of reach (in `crosshair()`). Armory uses the same `aimReach`.
- Item 3 shared guns: `resolveLoadout(op, l, guns)` + `own` in `cleanLoadout` (shared/operators.js), `store.setGun`,
  profile `guns`, `loadout` message may carry `gun: {w, a}`, ops.js tick box `.attown`. `node tests/sharedguns.js`.

## Left to do
1. Item 4 (TV, public/js/tv.js `tvDirector` + main.js TV overview at ~line 1540 `st.tvOv`): cut to `T.overview`
   more often (both teams' vision already drawn there), pick the floor with the most action/players instead of the
   bomb's floor.
2. Screenshot the long view, scope and reach ring (tests/shoot.mjs), check the Operators page tick box, then let him
   play (Free Play, Longbow or Pike + Sniper Scope). GPU Firefox may lag on the blur: he must try it.
3. Tick items in r6-todo.md, update CLAUDE.md, commit, run `vibenote --collect-usage`.
