# Long view + sniper scope: work in progress (paused 2026-11-04)

The to-do item (first in "To do" in r6-todo.md, not ticked yet):
zoom right out when looking down a sightline more than 1.5x the normal range; a sniper scope for slow marksman
rifles whose reticle snaps to the orange mark; Shift slows the sensitivity (a Settings slider) and steadies the aim fast
enough for quickscopes.

## His answers
- Scope look: a detailed sniper reticle; the rest of your view is **blurred and dimmed**, but movement must still
  show (like peripheral vision) so you can unscope when someone comes close.
- Shift steadies **for as long as you hold it**, no breath limit (he said: like the AWP in CS2).

## Done (in the code, not yet played)
- `shared/operators.js`: new sight `sniper` in `ATTACH.sight` ("Sniper Scope": adsSpread 0.45, ads 1.35, hip 1.35,
  zoom 1); `attachFor` offers it only on DMRs with rpm ≤ 300 (Longbow, Pike); `ADS_START.sniper` 10 m.
- `public/js/gunart.js`: side-view picture of the sniper scope.
- `public/js/main.js`:
  - `scopeOn(me)` / `sniperOn(me)` replace the old `includes('scope')` checks; `FIT_H` gives the sniper `LONG_H`.
  - Long view: `LONG_H` 1500 world px tall, `LONG_R` 2400 px. Camera: `st.farS` now casts to `LONG_R`; `st.longV` is on
    when `farS` > 1.5x `norm` (off below 1.3x; `norm` = what a 470-tall view reaches that way, at least 560 px), or
    while aimed in with the sniper scope. Then `want` may go up to `LONG_H`, Crosshair-mode `capH` too, and the body
    viewer's `range` is `LONG_R` instead of 1100.
  - `adsReset`: with the sniper the crosshair jumps to the end of your sightline (`q.see`, where the tick/orange mark sits).
  - `steadying()` (sniper, aiming in, walk or sprint key held) and `scopeSway(dt, me, now)` (called before `sendInput`):
    a figure-of-eight sway of the real aim (0.011 rad, more when moving), steadied to 0.0008 within ~0.1 s.
    Steadying also blocks sprint and the sprint+W turn, and multiplies the mouse sensitivity by `steadySens`.
  - The `steadySens` slider does not exist yet: the code falls back to 0.5 when it is missing.
- `public/js/armory.js`: `scoped()` counts the sniper too.

## Still to do
1. Settings slider `steadySens` (Settings → Mouse & Aim, "Steady aim sensitivity", 10–100, default 50, shown as ×):
   index.html row next to `adsSens`; add to `showSens`, the `r62d-sens` localStorage, the profile `settings`
   (save + load list), and the number-box `DIV` table.
2. The scope look: a `#scopeVeil` div between `#fog` and `#over` (backdrop-filter blur + darken, a radial mask with a
   clear lens round the reticle, CSS vars set only when they move ≥1 px; plain dark wash on Low graphics), shown only
   while scoped with the sniper. A detailed reticle in `sightLook` ('sniper': fine lines, mil-dots, thick posts, lens
   ring); hide the normal crosshair when `me.at` > 0.6. Warning: CLAUDE.md lessons say GPU Firefox can lag on new
   effects, so he must try it on his screen.
3. `node tests/attachments.js` fails: Pike + match + pad + sniper gives ads 1.60 (just over the test's limit). Lower the
   sniper's `ads` to ~1.3 or let the test allow it.
4. Run `node tests/aim.js`, `node tests/weapons.js`, a screenshot (tests/shoot.mjs) of the long view and the scope,
   then let him play it (Free Play, Longbow or Pike with the Sniper Scope).
5. Tick the item in r6-todo.md (move to Done with a short plain description), update CLAUDE.md, commit,
   then run `vibenote --collect-usage` (he asked for that when everything is done).
