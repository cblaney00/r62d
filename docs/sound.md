# Sound mix

All sounds are synthesised in `public/js/audio.js`. Every sound belongs to a category and the
`MIX` table at the top of that file sets each category's volume. Gunshots are pre-built
recordings (several per weapon, made sample by sample when sound starts).

## How it was balanced
`measureMix()` renders each sound offline in the browser and reports loudness (loudest 50 ms, dB).
Run it from the test browser (see docs/testing.md) with a list of `[name, fn]` tests.
Targets and measured results (2026-10-28):

| Sound | Target | Measured |
|---|---|---|
| Own rifle / shotgun | -10 / -8 | -12.5 / -10.1 |
| Enemy rifle 150px / 600px | -13 / -22 | -15.3 / -18.8 |
| Frag at 100px | -8 | -10.7 (limiter) |
| Enemy run / walk / crouch / slow-walk footsteps | -24 / -30 / -37 / -45 | -25.3 / -29.6 / -36.3 / -42.6 |
| Own footsteps | -34 | -33.6 |
| Aim down sights / mag in / swap / crouch | -38 / -28 / -30 / -34 | -36.3 / -29.2 / -31.1 / -32.2 |
| Bullet into drywall / flesh / whiz past | -28 / -24 / -20 | -29.9 / -23.5 / -22.5 |
| Heartbeat / hit marker | -26 / -26 | -31.3 / -25.5 |

Footsteps are deliberately loud enough to locate enemies — the game is built around hearing them.
Footsteps are pre-built recordings (6 per surface and pace, never the same twice in a row), synthesised
in `buildStep`: heel then ball-of-foot contact pulses ring the floor's resonant modes (`SURF[...].modes`),
a filtered sole slap, a scuff, and grain layers (gravel, grit, grass, glass, wood cracks, carpet fuzz).
They are levelled by loudness, then by `SURF[...].v` and MIX.steps (re-measured 2026-10-28: enemy run
-24…-30 dB by surface, own run -32, own walk -44).
Each footstep plays exactly when the walk cycle plants a foot (`gait` in shared/physics.js).
Surfaces: wood, tile, marble, carpet, concrete, asphalt, grass, metal (server room), rubble,
glass (around windows), splinters (where a barricade was smashed).

## 2026-10-30 — gentler (he asked: too loud, gunshots too aggressive)
- **Volume sliders follow loudness** (`sliderGain` in audio.js): each step is 0.5 dB, the slider spans 50 dB.
  Defaults: master 70 (−15 dB, about 10 dB quieter than before), effects 100, music 88. Old saved sliders
  (straight gain) are converted once and never come back louder than the new default (`fromOld` in main.js,
  profile settings get `vc: 2`, localStorage `r62d-vol2` / `r62d-music2`).
- **Graph:** effects → `pre` (0.6, the level the mix was balanced at) → compressor → `master` (the volume) → speakers.
  The volume sits after the compressor, so the mix sounds the same at any volume. Master fades in over 1.2 s
  when sound starts.
- **Gunshots:** MIX.guns 2.6 → 0.95, explosions 2.8 → 0.9, and a −5 dB high shelf at 3.8 kHz on gunshots takes the
  ear-piercing edge off the crack. (Big MIX cuts measure small because the compressor was squashing them.)
- **Masking (`duck`):** guns and explosions go straight to `sfx`; everything else goes through `rest`, which dips
  3–3.5 dB under a gunshot and 5–7 dB under an explosion (scaled by how loud it reached you) and recovers in ~0.25 s.

Measured after (measureMix, master fixed; footsteps vary ±3 dB from run to run):

| Sound | Before | After |
|---|---|---|
| Own rifle / shotgun | -12.9 / -9.7 | -16.7 / -12.8 |
| Enemy rifle 150px / 600px | -14.4 / -18.8 | -18.2 / -25.9 |
| Frag at 100px | -10.8 | -15.5 |
| Enemy run (wood, 150px) / own step / mag in | -24 / -25.8 / -29.3 | unchanged (within noise) |
