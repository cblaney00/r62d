# Frame rate: the big fix (2026-11-12)

Measured in an invisible gamescope display on his graphics card (no window on his screen; he asked: don't pop test
windows up): `gamescope --backend headless -W 1920 -H 1080 -r 240 -- firefox` as insideabush, X11 Firefox, then
`tests/shoot.mjs` over `--remote-debugging-port`. Free play, Embassy, High, 1600x900 viewport.

The real cost was not the effects: the map picture pieces (`Tiled` in mapdraw.js) are ordinary canvases, and every
copy of them into a graphics-card canvas (the blackout's remembered map, car/crate tops) sent the whole 1024 px piece
to the card again, every frame. Each piece now keeps an ImageBitmap (`Tiled.src`, remade ≤ every `BM_GAP` 100 ms
after it changes, all made while loading by `prime`). Far out, the screen showed the full picture (~7x the pixels it
could show) through the tilt: now `MapRenderer.showFor(z)` shows a half or quarter copy (`copyAt`, `picFor`) when
that still has as many pixels as the screen.

| | before | after |
|---|---|---|
| standing, all effects | 40 fps | 117–129 fps |
| his stress test (walk, spin, swing out) | 35 fps (1% low 20) | 92–96 fps (1% low 43) |
| locked camera 1500 world px tall | 51 fps | 168 fps |
| locked camera 3000 world px tall | 31 fps | 167 fps |

Layers themselves (fog filter, vignette, game, over) measured as nearly free. The remaining rare slow frames have
little script time in them (the graphics card or memory clean-up).

# Older notes: frame rate on his PC (measured 2026-11-09)

How: Firefox as insideabush on his 120 Hz screen (DP-1, workspace 2, full screen 1920x1080), free play on The Embassy,
High graphics, `__r62d.PF` per section plus an in-page rAF frame-gap log. Scripts: a `__stress(ms, label, lockH)` step
walks the body across the floor (free `tp` every 100 ms) while the aim spins 6 times and swings 60–1660 px out 3 times
(his test: "walk across the map while spinning around while zooming way out"); `lockH` also zooms a locked camera.
Headless Firefox (software canvas) does NOT show these costs: there everything is ~10 ms a frame.

Stress results (fps / 1% low):
- all effects on: 40–61 / 20–30
- raised walls + camera tilt/lean off: 115 / 67  ← the game logic and plain drawing are fine
- only one of them off: 42–57 / 22–28 (no single culprit: it is their total on the GPU)
- locked camera zooming to 3000 world px, raised walls off: 81 / 23
- worst single frames ~300 ms appear even with everything off (walking into new map areas)

Found and fixed this session:
- Wall tops were thousands of small copies of the map picture every frame (most of the raised-wall cost): now plain
  colour rectangles (`topColour` in look.js). Drawing one big pre-made "tops picture" instead was far WORSE on his
  Firefox (10–20 fps): large scaled canvas-to-canvas copies thrash Firefox's GPU canvas.
- Large Path2D fills over a whole far view are slow on Firefox's GPU canvas (it masks them): raised walls now sink
  flat between view heights 760 and 1150 (`RAISE_FULL`/`RAISE_NONE`).
- Soft blurred screen edges (backdrop blur) with the tilt cost a third of a frame: off on High (Ultra keeps them).

Why it is still short of 80+: Canvas 2D in Firefox on the graphics card is unpredictable; costs move between
sections as the GPU queue fills. Options, best first:
1. Draw the world (map, blackout, raised walls, tilt) with WebGL in the same browser game. Textures uploaded once,
   the whole world drawn in a few draw calls, the tilt done in the shader instead of a CSS 3D transform. Friends and
   phones still join by link. Recommended.
2. Play his own copy in a Chromium-based window (the Windows program already is Electron). Chromium's GPU canvas is
   usually steadier than Firefox's. Needs a system change (`vibe` → "Change or fix something on your computer").
3. Rebuild in Godot: fastest, but months of work and no joining by a browser link.
