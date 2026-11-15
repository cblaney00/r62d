# What is drawn over what (the layer order)

He asked (2026-11-15) for one complete list of the drawing order, bottom (drawn first, covered by everything) to top.
Keep it current when something new is drawn. Code: `draw()` in public/js/main.js, `drawRaised`/`raisedFrame` in
public/js/look.js, the map picture in public/js/mapdraw.js.

## The page layers (bottom to top, inside `#world`, which the tilt turns as one)

| # | Layer | Holds |
|---|---|---|
| 1 | `#mapLayer` | the flat map picture (floors, walls from above, furniture and vehicle pictures, stairs, labels), moved by CSS |
| 2 | `#game` | everything that moves on this floor (list A) |
| 3 | `#fog` | the blackout: remembered map greyed by CSS, with raised walls greyed too (list B) |
| 4 | `#over` | everything above the blackout (list C) |
| 5 | `#scopeVeil`, `#scopeLens` | the sniper scope (blur round a clear lens, the magnified lens) |
| 6 | `#vignette`, `#edgeBlur` | screen edge darkening and blur (CSS) |
| 7 | HUD, menus | HTML over everything |

## A. `#game` (drawn in this order)

1. Zombies world marks, defuser spots, the planted defuser.
2. Bodies of the dead.
3. Rope coils and ropes on the ground.
4. Gadgets (each lifted by its height, shadow under anything off the floor), then cameras, then outside cameras' ground copies.
5. People (stair/window "ABOVE/BELOW" copies first, then the person). People up on furniture, on a rope, or beside a
   wall are also queued to be drawn again in C (so raised walls never hide them).
6. Drones, MAGPIE's swarm and birds.
7. Particles (`fx.draw`), Holo decoys, flash lights (`fx.drawLights`).

## B. `#fog` (the blackout)

1. Black.
2. The remembered map picture (the browser greys this layer).
3. Cut out: everything your team sees right now (sight shapes), so A shows through in colour.
4. Past an upper floor's edge: the ground far below.
5. All raised walls, furniture and vehicles (`raise(fctx, 'fog')`), greyed.

## C. `#over` (above the blackout, in this order)

1. Black over the neighbouring floors (only when there is no ground-below picture).
2. **Views onto a lower floor**: down a staircase, down through a hatch, out of a window to the ground (moved 2026-11-15:
   they were drawn last and could cover this floor's walls).
3. Smoke and gas you have a line to.
4. Raised walls in sight (`raise(ctx, 'lit')`, look.js), in this order:
   1. the ground far below an upper floor's outside walls;
   2. outside walls and the storeys below/above (on a rope these go last instead, step 4.4);
   3. bands of 48 px from far to near; in each band first furniture/vehicles/rails, then walls; inside each group:
      sill tops → window/door boards → faces (sides) → surface lines → bullet holes → wall tops → furniture and vehicle
      tops (their own picture, cut to their shape);
   4. on a rope: the wall you hang on and the storeys round it, nearest the camera.
5. People queued in A.5 (up on furniture, on a rope), full strength.
6. Every person you see, faintly (`GHOST_A`), so nobody hides under a raised wall or door frame.
7. Window aiming lines, GIMLET peepholes, the window helper frame, the defenders' preparation area.
8. **Views onto a higher floor**: up a staircase, up through a hatch (over this floor's walls, since they are above them).
9. Window plates (what each upper window looked like from below).
10. Esports TV team sight tints, then markers: pings, spotted enemies, teammates' outlines, death marks, status
    badges, names, the compass, hit markers, the crosshair and its bracket, point pop-ups.

## Rules that keep it right

- Anything standing up is drawn by one perspective rule (look.js `persp`, `liftOf`): a point at height z (a wall = 1)
  moves away from the eye by `(p - eye) * h * z`. People, gadgets, walls and furniture all use it, so they line up.
- A thing is raised only as big as its picture: vehicles as their own body (`vehOf`), railings as a rail on posts
  (`railOf`), tables on legs (`legsOf`). Raising whole cells lifts the floor round them too and looks like a platform
  (the 2026-11-15 cars-on-platforms bug).
- A view of another floor goes under this floor's walls when that floor is below, over them when it is above.
- In colour only what your team sees (sight shapes and the seen grid); the rest is in the blackout and greyed.

## Places that could cause confusion (checked 2026-11-15)

- People are drawn twice (A.5 and again in C.5/C.6). Anything new about people must go in `upDraw`, not after it.
- `st.upDraws`/`st.ghostDraws` only draw when raised walls are on (`raise`); with them off the first drawing is all.
- On a rope the outside walls swap from first to last (`st.rt > 0.05`). Anything drawn on a wall face must accept both.
- The stair view's label sits over its patch; the map picture's own stair labels show inside the patch too.
