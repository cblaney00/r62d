# Batch 23 (2026-11-02): watch matches and fix what is found — progress notes

His request: play/watch rounds and fix gameplay, balance, ability/equipment use, pro picks, bot behaviour, TV director.
His answers: attackers play for the plant much more; make Hammer, Salvo, Torque and Ferro stronger until the pros pick
them; TV gets short instant replays of big moments the camera missed. Later: TV webcams/team cards go along the
BOTTOM of the screen, not left and right. (All in r6-todo.md.)

## Tools
- `node tests/watch.js [matches per map] [--level N] [--only map]` — pro matches with normal picks: picks per side,
  how rounds end, kills by weapon kind, plants, things placed/thrown per operator, sample calls. Run with `nice -n 19`
  so his computer stays smooth; never several heavy test runs at once while he plays.
- Carrier check script idea: per round, did the defuser carrier reach a bomb (<150 px), die, plant.
- TV director check: headless TV for 4 min logging kills seen (follow = killer/victim) vs missed, cuts.

## Done so far
- Lag fix (Tiled map pictures) and /api/perf — see CLAUDE.md "Lag fix".
- Bots use the abilities they never used: `botAbility` in server/bots.js (dash, pick, flare, medkit, spike, cover, tag,
  echobox, periscope, weld). Seen working in watch: flare, spike, medkit, pick; echobox spot choice just fixed (openings
  in sight 60-260 px). Trench cover and Lens periscope still showed 0 uses (few rounds) — check.
- Planting: carriers plant at whichever bomb spot they reach (`nb` in the objective code), and a pro carrier within
  130 px of a bomb with no enemy in sight goes in to plant (`site0` check at the top of proAct's attack part).
  Plants 3/30 -> 10/28 rounds; attackers 43% -> 52%.

## Measured, not fixed yet
- Never picked by pros: Hammer, Salvo, Ferro (Torque once). Pro practice win rates (pro-training.json `ops`, fields
  n/w per map|side|op): these are the lowest, so `opWeight`² keeps them out. Make them genuinely stronger AND check
  the bots use their tools well (slug/sticky/saw/hammer in BREACH_TOOLS / botThink), then re-train.
- Teamkills: 7 in 51 rounds in one run, 0 in the next; `shotClear` only checks teammates up to the target distance.
- TV director shows ~63% of kills live (misses are mostly two kills at once elsewhere); 14 cuts in 4 min is fine.
- Attackers standing ~40 s outside before the plan's go: that is the plan's wait, normal.

## Next
1. Weak operators (above). 2. TV: instant replays of missed big moments (reuse server `recordCam` from the killcam),
   team cards with webcams along the bottom (`#tvL/#tvR`, `tvHud` in main.js, CSS `html.tv`). 3. Trench/Lens bot use.
4. Run watch again, tick the r6-todo items, update CLAUDE.md, commit, then `vibenote --collect-usage`.
