// The look overhaul (he asked: the game felt flat, "a board game playing itself"; he chose all four): room lighting with
// warm lamp pools and cool shadows baked into the map picture, raised walls with sides and tops that shift with the
// camera (parallax), and a camera tilt — a slight fixed angle plus a lean with your movement and a kick on shots/blasts.
// Everything here is cheap for the graphics card: the light is drawn once with the map, the walls are plain canvas
// fills and copies of the map picture, and the tilt is one CSS transform the browser applies to the world layers.
import { CELL, T, MAT, FL } from '/shared/constants.js';
import { cellBelow } from '/shared/map.js';

export const looks = { light: true }; // switched by Settings → Screen → Room lighting (main.js)

// One perspective for everything (he asked 2026-11-14: all assets stay 2D art but must look 3D as the camera tilts, the
// same way the walls do). Something at height z (floor heights: a wall is 1 = 3.2 m) shows pushed away from the eye
// point by h·z of its distance from it: the walls' own rule (raisedFrame). main.js sets it once a frame (setPersp);
// h 0 = flat (menus, killcam, galleries).
export const persp = { x: 0, y: 0, h: 0 };
export function setPersp(eye, h) { persp.x = eye.x; persp.y = eye.y; persp.h = h; }
export const liftOf = (x, y, z) => [(x - persp.x) * persp.h * z, (y - persp.y) * persp.h * z];
// draw something standing at (x, y) at height z: fn() in the world frame, moved where its height shows it
// draw with a perspective of its own (menus, killcam, Armory: they must never take the match's leftover one), put back after
export function withPersp(eye, h, fn) { const s = { x: persp.x, y: persp.y, h: persp.h }; setPersp(eye, h); try { return fn(); } finally { setPersp(s, s.h); } }
// a showcase picture: seen from a little in front, so the body shows its height (Operators page, select cards)
export const showcase = (x, y, fn) => withPersp({ x, y: y + 140 }, 0.055, fn);
export function lifted(ctx, x, y, z, fn) { if (!persp.h || !z) { fn(); return; } const [dx, dy] = liftOf(x, y, z); ctx.save(); ctx.translate(dx, dy); fn(); ctx.restore(); }

const SOLID = new Set([T.HARD, T.SOFT, T.REINF, T.PANEL]);

// ---------------------------------------------------------------- lighting
// One value per cell: how lit it is (1 = daylight). Rooms get a dim ambient light, ceiling lamps spread round the room
// (through open doorways too, never through walls) and daylight falls in through windows. Kept as two tiny canvases,
// one pixel a cell, stretched smoothly over the picture: a cool dark wash where it is dim, a warm glow under lamps.
export function lightMap(map) {
  const W = map.W, H = map.H, N = W * H, room = new Int16Array(N).fill(-1);
  map.rooms.forEach((r, i) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) room[y * W + x] = i; });
  const tile = k => map.tiles[k], passes = k => { const t = tile(k); return !SOLID.has(t) && t !== T.TALL && t !== T.VOID && t !== T.DSHIELD; };
  const L = new Float32Array(N), lamp = new Float32Array(N);
  for (let k = 0; k < N; k++) L[k] = room[k] >= 0 ? 0.64 : 1; // (0.4 made insides too dark and blue, he said)
  const seen = new Int32Array(N).fill(-1); let stamp = 0;
  const spread = (sx, sy, R, add, into) => { // light from (sx, sy) cells out to R cells, carried round corners by a flood
    const s = ++stamp, q = [Math.floor(sy) * W + Math.floor(sx)]; if (q[0] < 0 || q[0] >= N) return;
    seen[q[0]] = s;
    for (let i = 0; i < q.length; i++) {
      const k = q[i], x = k % W, y = (k - x) / W, d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / R;
      if (d >= 1) continue;
      into[k] += add * (1 - d) ** 1.6;
      for (const n of [k - 1, k + 1, k - W, k + W]) if (n >= 0 && n < N && seen[n] !== s && passes(n) && Math.abs(n % W - x) <= 1) { seen[n] = s; q.push(n); }
    }
  };
  for (const r of map.rooms) { // ceiling lamps: one per ~9 cells each way
    const nx = Math.max(1, Math.round(r.w / 9)), ny = Math.max(1, Math.round(r.h / 9));
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) spread(r.x + (i + 0.5) * r.w / nx, r.y + (j + 0.5) * r.h / ny, 8.5, 0.7, lamp);
  }
  for (const o of map.openings || []) if (o.kind === 'window') for (const k of o.cells) { // daylight through windows
    const x = k % W, y = (k - x) / W;
    for (const n of [k - 1, k + 1, k - W, k + W]) if (n >= 0 && n < N && room[n] >= 0 && passes(n)) spread(n % W + 0.5, Math.floor(n / W) + 0.5, 6, 0.38, L);
    void x; void y;
  }
  const dark = document.createElement('canvas'), warm = document.createElement('canvas');
  dark.width = warm.width = W; dark.height = warm.height = H;
  const dc = dark.getContext('2d'), wc = warm.getContext('2d'), di = dc.createImageData(W, H), wi = wc.createImageData(W, H);
  for (let k = 0; k < N; k++) {
    if (room[k] < 0 || tile(k) === T.VOID) continue;
    const l = Math.min(1.2, L[k] + lamp[k]), j = k * 4;
    di.data[j] = 18; di.data[j + 1] = 18; di.data[j + 2] = 24; di.data[j + 3] = Math.max(0, Math.min(1, 1 - l)) * 0.5 * 255;
    wi.data[j] = 255; wi.data[j + 1] = 188; wi.data[j + 2] = 112; wi.data[j + 3] = Math.max(0, Math.min(1, lamp[k] - 0.2)) * 0.22 * 255;
  }
  dc.putImageData(di, 0, 0); wc.putImageData(wi, 0, 0);
  return { dark, warm };
}
// over a part of the picture (cells x0..x1, y0..y1) that was just drawn; ctx draws in world units, clipped to the part
export function applyLight(ctx, lm, x0, y0, x1, y1) {
  const a = Math.max(0, x0 - 1), b = Math.max(0, y0 - 1), c = Math.min(lm.dark.width, x1 + 2), d = Math.min(lm.dark.height, y1 + 2);
  if (c <= a || d <= b) return;
  ctx.imageSmoothingEnabled = true;
  // a cell's value is its middle: a half-cell offset lines the stretched pixels up with the cells
  for (const cv of [lm.dark, lm.warm]) ctx.drawImage(cv, a, b, c - a, d - b, a * CELL, b * CELL, (c - a) * CELL, (d - b) * CELL);
}

// ---------------------------------------------------------------- raised walls
// Walls (and tall furniture) stand up off the floor: seen from a camera above the middle of the screen, a wall's top
// sits a little further out from the middle than its foot (by h of the distance), and the side facing the camera
// shows in between. Drawn above the blackout (so walls never vanish into it) and dimmed where your team can't see them.
const HGT = { [T.HARD]: 1, [T.SOFT]: 1, [T.REINF]: 1, [T.PANEL]: 1, [T.TALL]: 0.7, [T.DSHIELD]: 0.45, [T.LOW]: 0.28 };
const SIDE = { [T.HARD]: [107, 112, 118], [T.SOFT]: [178, 170, 155], [T.REINF]: [76, 84, 93], [T.PANEL]: [53, 59, 66], [T.TALL]: [70, 60, 50], [T.DSHIELD]: [40, 45, 52], [T.LOW]: [84, 70, 56] };
const BRICK = [125, 68, 52];
// furniture and things outdoors only stand up when they are boxy: a round tree, rock or bush raised as its square cells
// showed a square slab of grass round it (he saw it as strange shapes)
const BOXY = new Set(['planter', 'sandbags', 'lounger', 'aircon', 'skirack', 'bikerack', 'firepit', 'crates', 'wall', 'car', 'dumpster', 'rack', 'shelf', 'container', 'cabinet', 'bookshelf', 'pillar', 'van', 'locker', 'train', 'fridge', 'truck', 'booth', 'schoolbus', 'bus', 'gatehouse', 'lifthut', 'signalbox', 'tankcar', 'counter', 'forklift', 'snowcat', 'stall', 'cart',
  'desk', 'workbench', 'bench', 'couch', 'coffeetable', 'meetingtable', 'reception', 'island', 'console', 'bed', 'railing', 'barrier', 'marketstall', 'sink', 'tv', 'chairs']);
const RISE = new WeakMap(); // map → per cell: 1 where a tall cell belongs to a boxy thing
export function riseOf(m) {
  let r = RISE.get(m); if (r) return r;
  RISE.set(m, r = new Uint8Array(m.W * m.H));
  for (const p of m.props || []) if (BOXY.has(p.kind)) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) r[y * m.W + x] = 1;
  return r;
}
const height = (m, k, rise) => { const t = m.tiles[k]; return t === T.TALL || t === T.LOW ? (rise[k] && m.floor[k] !== FL.VOID ? HGT[t] : 0) : HGT[t] || 0; }; // (a rope ledge is a LOW cell over open air: never raised)
// faces: [dx, dy, light] — light from the top left, so faces turned that way are brighter
const FACES = [[0, 1, 0.5], [0, -1, 0.78], [1, 0, 0.6], [-1, 0, 0.72]];
// The wall pieces are worked out once per block of cells (CH × CH) and kept (he asked: zoomed out it lagged, more of it
// should stay ready): each block holds its faces (both ends, which way it faces, its colour) and its tops, in two
// groups, walls and tall things (cars, crates, shelves). A block is worked out again only when a cell in or next to it
// changes (MapRenderer.cellChanged fills R.wallsDirty). Each frame only the faces turned toward the camera are raised,
// once, and the same paths serve every pass (raisedFrame, then drawRaised per group).
// Wall tops are plain fills in the wall's own top colour (the colours mapdraw.js wallFill paints them with): copying
// thousands of small pieces of the map picture every frame was most of a frame on his graphics card (he asked
// 2026-11-09: no lag at any zoom). Cars, crates and shelves (group 1) still take their tops from the picture.
function topColour(m, k) {
  const t = m.tiles[k], mat = m.mat && m.mat[k];
  if (t === T.HARD) return mat === MAT.DRYWALL ? '#c4bdaf' : '#7a7f85';
  if (t === T.REINF) return '#59626c';
  if (t === T.PANEL) return '#3e454d';
  if (t === T.DSHIELD) return '#2b3036';
  return mat === MAT.BRICK ? '#93503b' : '#d8d2c4';
}
const CH = 16;
const KEPT = new WeakMap(); // renderer → { m, cw, blocks: [] }
function block(R, m, bx, by) {
  const W = m.W, rise = riseOf(m), hg = k => height(m, k, rise), out = [{ faces: [], tops: [] }, { faces: [], tops: [] }];
  const x0 = bx * CH, y0 = by * CH, x1 = Math.min(W - 1, x0 + CH - 1), y1 = Math.min(m.H - 1, y0 + CH - 1);
  for (let y = y0; y <= y1; y++) {
    let run = null;
    for (let x = x0; x <= x1 + 1; x++) {
      const k = y * W + x, f = x <= x1 ? hg(k) : 0, on = f > 0, g = on && (m.tiles[k] === T.TALL || m.tiles[k] === T.LOW) ? 1 : 0;
      const sh = on && m.shape && m.shape[k], tc = on && !g ? topColour(m, k) : '';
      if (run && (!on || f !== run.f || g !== run.g || sh || tc !== run.tc)) { out[run.g].tops.push(run); run = null; }
      if (!on) continue;
      const t = m.tiles[k], base = t === T.SOFT && m.mat && m.mat[k] === MAT.BRICK ? BRICK : SIDE[t] || SIDE[T.HARD], X = x * CELL, Y = y * CELL;
      const col = lt => `rgb(${base[0] * lt | 0},${base[1] * lt | 0},${base[2] * lt | 0})`, faces = out[g].faces;
      if (sh) { // an angled or curved piece: its own edges, its own top
        for (const P of sh) {
          let pcx = 0, pcy = 0; for (let i = 0; i < P.length; i += 2) { pcx += P[i]; pcy += P[i + 1]; } pcx /= P.length / 2; pcy /= P.length / 2;
          for (let i = 0; i < P.length; i += 2) {
            const ax = P[i], ay = P[i + 1], bx2 = P[(i + 2) % P.length], by2 = P[(i + 3) % P.length];
            let nx = by2 - ay, ny = -(bx2 - ax); const len = Math.hypot(nx, ny) || 1, mx = (ax + bx2) / 2, my = (ay + by2) / 2;
            if (nx * (mx - pcx) + ny * (my - pcy) < 0) { nx = -nx; ny = -ny; } // pointing out of the piece, whichever way it was wound
            const ok = Math.floor((mx + nx / len * 0.5) / CELL), oy = Math.floor((my + ny / len * 0.5) / CELL), on2 = oy * W + ok; // just outside the edge
            if (on2 !== k && hg(on2) >= f && !(m.shape && m.shape[on2])) continue; // against more wall: hidden inside it
            faces.push({ ax, ay, bx: bx2, by: by2, nx, ny, px: mx, py: my, f, x, y, c: col(+(0.62 + 0.14 * (-nx - ny) / len).toFixed(1)) });
          }
        }
        out[g].tops.push({ x, y, n: 1, f, sh, tc });
        continue;
      }
      for (const [dx, dy, lt] of FACES) {
        const n = k + dy * W + dx, nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= m.H || hg(n) >= f && !(m.shape && m.shape[n])) continue;
        const ex = dx > 0 ? X + CELL : X, ey = dy > 0 ? Y + CELL : Y; // seen when the camera is on its side of it
        const d = g ? 0 : base === BRICK ? 'b' : 'p';
        if (dx) faces.push({ ax: ex, ay: Y, bx: ex, by: Y + CELL, nx: dx, ny: 0, px: ex, py: Y, f, x, y, c: col(lt), d });
        else faces.push({ ax: X, ay: ey, bx: X + CELL, by: ey, nx: 0, ny: dy, px: X, py: ey, f, x, y, c: col(lt), d });
      }
      if (!run) run = { x, y, n: 0, f, g, tc }; run.n++;
    }
  }
  // windows and doorways (he asked: see a window from another angle as you climb past it): a sill and the wall above
  // a window, the wall above a door, and the boards across a barricaded one, each a piece from f0 up to f
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * W + x; if (hg(k) > 0 || !m.openId) continue;
    const oi = m.openId[k], win = !!(m.win && m.win[k]), op = oi >= 0 && m.openings && m.openings[oi], door = !win && op && op.kind === 'door';
    if (!win && !door) continue;
    let wk = -1; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = k + dy * W + dx; if (hg(n) >= 1) { wk = n; break; } }
    const wb = wk >= 0 ? (m.tiles[wk] === T.SOFT && m.mat && m.mat[wk] === MAT.BRICK ? BRICK : SIDE[m.tiles[wk]] || SIDE[T.HARD]) : SIDE[T.SOFT], wtc = wk >= 0 ? topColour(m, wk) : '#d8d2c4';
    const pieces = win ? [[0, 0.28, [196, 190, 176], '#d8d2c4'], [0.69, 1, wb, wtc]] : [[0.72, 1, wb, wtc]];
    if (m.tiles[k] === T.BARRI) pieces.push(win ? [0.28, 0.69, [122, 92, 58], '#8b6a42'] : [0.06, 0.72, [122, 92, 58], '#8b6a42']);
    const X = x * CELL, Y = y * CELL, faces = out[0].faces;
    for (const [f0, f, base, tc] of pieces) {
      const col = lt => `rgb(${base[0] * lt | 0},${base[1] * lt | 0},${base[2] * lt | 0})`;
      for (const [dx, dy, lt] of FACES) {
        const n = k + dy * W + dx, nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= m.H || hg(n) >= f || (m.openId[n] === oi && oi >= 0)) continue; // against the wall, or more of the same opening
        const ex = dx > 0 ? X + CELL : X, ey = dy > 0 ? Y + CELL : Y;
        const d = base === BRICK ? 'b' : base[0] === 122 ? 'w' : 'p';
        if (dx) faces.push({ ax: ex, ay: Y, bx: ex, by: Y + CELL, nx: dx, ny: 0, px: ex, py: Y, f, f0, x, y, c: col(lt), d });
        else faces.push({ ax: X, ay: ey, bx: X + CELL, by: ey, nx: 0, ny: dy, px: X, py: ey, f, f0, x, y, c: col(lt), d });
      }
      out[0].tops.push({ x, y, n: 1, f, g: 0, tc });
    }
  }
  facade(m, x0, y0, x1, y1, hg, out[0].faces);
  return out;
}
// The building below an upper floor (he asked 2026-11-14: more volume, more detail on the outside of the building): an
// outside wall of an upper floor carries on down, storey by storey, to the ground, as faces at heights below its own
// floor (-1 = the storey under it). Each storey shows what is really there: wall (brick or plaster), a window (sill,
// glass, lintel) or a doorway, until the building steps in.
const GLASS = [46, 62, 78], DOORWAY = [30, 27, 25];
function facade(m, x0, y0, x1, y1, hg, faces) {
  const W = m.W, air = n => n >= 0 && n < m.tiles.length && m.floor[n] === FL.VOID;
  const outside = n => n >= 0 && n < m.tiles.length && (m.floor[n] === FL.VOID || m.tiles[n] === T.GROUND || m.tiles[n] === T.VOID);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * W + x; if (cellBelow(m, k) < 0) continue;
    const wall = hg(k) >= 1 && m.tiles[k] !== T.TALL && m.tiles[k] !== T.LOW, open = !wall && m.openId && m.openId[k] >= 0 && hg(k) === 0;
    if (!wall && !open) continue;
    const X = x * CELL, Y = y * CELL;
    for (const [dx, dy, lt] of FACES) {
      const n = k + dy * W + dx; if (!air(n)) continue;
      const ex = dx > 0 ? X + CELL : X, ey = dy > 0 ? Y + CELL : Y;
      let kb = k, nb = n;
      for (let s = 1; s <= 4; s++) {
        kb = cellBelow(m, kb); nb = cellBelow(m, nb); if (kb < 0 || nb < 0 || !outside(nb)) break;
        const t = m.tiles[kb], win = !!(m.win && m.win[kb]), oi = m.openId ? m.openId[kb] : -1, door = !win && oi >= 0 && m.openings && m.openings[oi] && m.openings[oi].kind === 'door';
        const solid = t === T.HARD || t === T.SOFT || t === T.REINF || t === T.PANEL;
        if (!solid && !win && !door) break; // the building steps in under here
        const wb = t === T.SOFT && m.mat && m.mat[kb] === MAT.BRICK ? BRICK : SIDE[t] || SIDE[T.SOFT], dk = wb === BRICK ? 'b' : 'p';
        const pieces = solid ? [[0, 1, wb, dk]] : win ? [[0, 0.28, wb, dk], [0.28, 0.69, GLASS, 'g'], [0.69, 1, wb, dk]] : [[0, 0.72, DOORWAY, 'o'], [0.72, 1, wb, dk]];
        const low = 1 - 0.05 * s; // a little darker toward the ground
        for (const [a, b, base, d] of pieces) {
          const c = `rgb(${base[0] * lt * low | 0},${base[1] * lt * low | 0},${base[2] * lt * low | 0})`, f0 = a - s, f = b - s;
          if (dx) faces.push({ ax: ex, ay: Y, bx: ex, by: Y + CELL, nx: dx, ny: 0, px: ex, py: Y, f, f0: f0 || -1e-6, x, y, c, d, s });
          else faces.push({ ax: X, ay: ey, bx: X + CELL, by: ey, nx: 0, ny: dy, px: X, py: ey, f, f0: f0 || -1e-6, x, y, c, d, s });
        }
      }
    }
  }
}
function kept(R, m) {
  let K = KEPT.get(R);
  if (!K || K.m !== m) KEPT.set(R, K = { m, cw: Math.ceil(m.W / CH), blocks: [] });
  if (R.wallsDirty && R.wallsDirty.size) { // a changed cell can change its neighbours' faces: drop the blocks round it
    for (const k of R.wallsDirty) {
      const x = k % m.W, y = Math.floor(k / m.W);
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const bx = Math.floor((x + dx) / CH), by = Math.floor((y + dy) / CH); if (bx >= 0 && by >= 0) K.blocks[by * K.cw + bx] = null; }
    }
    R.wallsDirty.clear();
  }
  return K;
}
// this frame's raised walls in cells x0..y1 (inclusive), seen from cam: per group, a path per colour and the tops
export function raisedFrame(R, m, cam, h, x0, y0, x1, y1) {
  const K = kept(R, m), cx = cam.x, cy = cam.y, up = (x, y, f) => [x + (x - cx) * h * f, y + (y - cy) * h * f];
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(m.W - 1, x1); y1 = Math.min(m.H - 1, y1);
  const groups = [{ paths: new Map(), tops: [], topPaths: new Map(), dark: new Path2D(), light: new Path2D(), glint: new Path2D() }, { paths: new Map(), tops: [], topPaths: new Map() }];
  for (let by = Math.floor(y0 / CH); by <= Math.floor(y1 / CH); by++) for (let bx = Math.floor(x0 / CH); bx <= Math.floor(x1 / CH); bx++) {
    const i = by * K.cw + bx, B = K.blocks[i] || (K.blocks[i] = block(R, m, bx, by));
    const whole = bx * CH >= x0 && by * CH >= y0 && bx * CH + CH - 1 <= x1 && by * CH + CH - 1 <= y1; // else: check each piece is in range
    for (let g = 0; g < 2; g++) {
      const G = groups[g];
      for (const F of B[g].faces) {
        if (F.nx * (cx - F.px) + F.ny * (cy - F.py) <= 0) continue; // turned away from the camera
        if (!whole && (F.x < x0 || F.x > x1 || F.y < y0 || F.y > y1)) continue;
        let p = G.paths.get(F.c); if (!p) G.paths.set(F.c, p = new Path2D());
        const [ux, uy] = up(F.ax, F.ay, F.f), [vx, vy] = up(F.bx, F.by, F.f);
        if (F.f0) { const [a1, b1] = up(F.ax, F.ay, F.f0), [a2, b2] = up(F.bx, F.by, F.f0); p.moveTo(a1, b1); p.lineTo(a2, b2); } else { p.moveTo(F.ax, F.ay); p.lineTo(F.bx, F.by); } p.lineTo(vx, vy); p.lineTo(ux, uy); p.closePath(); // (a piece off the floor, like a window's lintel, starts at f0)
        if (F.d) deco(G, F, up);
      }
      for (const r of B[g].tops) {
        if (!whole && (r.y < y0 || r.y > y1 || r.x + r.n - 1 < x0 || r.x > x1)) continue;
        if (!r.tc) { G.tops.push(r); continue; }
        let T2 = G.topPaths.get(r.tc); if (!T2) G.topPaths.set(r.tc, T2 = { p: null, r: [] });
        const sc = 1 + h * r.f;
        if (r.sh) { const p = T2.p || (T2.p = new Path2D()); for (const P of r.sh) { for (let i = 0; i < P.length; i += 2) { const [a, b] = up(P[i], P[i + 1], r.f); i ? p.lineTo(a, b) : p.moveTo(a, b); } p.closePath(); } }
        else { const [tx, ty] = up(r.x * CELL, r.y * CELL, r.f); T2.r.push(tx, ty, r.n * CELL * sc, CELL * sc); } // plain rectangles: far cheaper on the graphics card than one big shape
      }
    }
  }
  return { groups, cam: { x: cx, y: cy }, h };
}
// The surface of a wall face (he asked 2026-11-14: walls, doors and windows with a lot more detail): brick courses with
// staggered joints, a skirting line inside, a band at each storey outside, window panes with a frame, a bar and a glint,
// boards with their gaps. As lines, only as many as the face is tall on the screen (never closer than 2.6 world px).
function deco(G, F, up) {
  const z0 = F.f0 || 0, z1 = F.f, [pax, pay] = up(F.ax, F.ay, z0), [pux, puy] = up(F.ax, F.ay, z1), tall = Math.hypot(pux - pax, puy - pay);
  const line = (P, t0, za, t1, zb) => { const ax = F.ax + (F.bx - F.ax) * t0, ay = F.ay + (F.by - F.ay) * t0, bx = F.ax + (F.bx - F.ax) * t1, by = F.ay + (F.by - F.ay) * t1, [a, b] = up(ax, ay, za), [c, d] = up(bx, by, zb); P.moveTo(a, b); P.lineTo(c, d); };
  if (F.d === 'b') { // brick: courses of about 23 cm, the joints half a brick apart
    const n = Math.min(Math.round((z1 - z0) * 14), Math.floor(tall / 2.6)); if (n < 2) return;
    const odd = (F.x + F.y) & 1;
    for (let i = 1; i <= n; i++) { const z = z0 + (z1 - z0) * i / n; if (i < n) line(G.dark, 0, z, 1, z); const zb = z0 + (z1 - z0) * (i - 1) / n, t = (i + odd) & 1 ? 0.5 : 0.02; line(G.dark, t, zb, t, z); }
  } else if (F.d === 'p') { // plaster or concrete: skirting inside (on the floor), a storey band outside (below it)
    if (z0 >= 0 && z1 >= 0.9 && tall > 6) line(G.dark, 0, 0.035, 1, 0.035);
    if (z0 < 0) { const zt = Math.ceil(z0) === z0 ? z0 + 1 : Math.ceil(z0); if (zt <= z1 && tall > 4) { line(G.light, 0, zt - 0.03, 1, zt - 0.03); line(G.dark, 0, zt, 1, zt); } }
    if (z1 > 0.5 && z0 < 0.5 && tall > 10 && (F.x * 7 + F.y * 3) % 5 === 0) line(G.dark, 0.5, Math.max(z0, 0.05), 0.5, Math.min(z1, 0.95)); // a panel seam now and then
  } else if (F.d === 'g') { // glass: frame, a middle bar, a sill lip and a glint across
    if (tall < 3) return;
    line(G.light, 0, z0, 1, z0); line(G.light, 0, z1, 1, z1); line(G.light, 0.02, z0, 0.02, z1); line(G.light, 0.98, z0, 0.98, z1);
    line(G.dark, 0.5, z0, 0.5, z1); line(G.glint, 0.15, z0 + (z1 - z0) * 0.2, 0.55, z0 + (z1 - z0) * 0.9);
  } else if (F.d === 'w') { // boards across a window or door: the gaps between them
    const n = Math.min(4, Math.floor(tall / 3)); for (let i = 1; i < n; i++) { const z = z0 + (z1 - z0) * i / n; line(G.dark, 0, z, 1, z); }
  } else if (F.d === 'o' && tall > 4) { line(G.light, 0.04, z0, 0.04, z1); line(G.light, 0.96, z0, 0.96, z1); line(G.light, 0.04, z1, 0.96, z1); } // a doorway: its frame
}
// draw groups of a raisedFrame (0 walls, 1 tall things); the tops come from pic (the map picture, or its small copy far out)
export function drawRaised(ctx, R, fr, which, pic = R.c) {
  const cx = fr.cam.x, cy = fr.cam.y, h = fr.h, G = pic.width / R.Wp, up = (x, y, f) => [x + (x - cx) * h * f, y + (y - cy) * h * f];
  for (const g of which) {
    const grp = fr.groups[g];
    for (const [c, p] of grp.paths) { ctx.fillStyle = c; ctx.fill(p); }
    if (grp.dark) { ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(20,16,14,0.32)'; ctx.stroke(grp.dark); ctx.strokeStyle = 'rgba(235,228,214,0.32)'; ctx.stroke(grp.light); ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(210,230,250,0.22)'; ctx.stroke(grp.glint); }
    for (const [c, T2] of grp.topPaths) { ctx.fillStyle = c; const q = T2.r; for (let i = 0; i < q.length; i += 4) ctx.fillRect(q[i], q[i + 1], q[i + 2], q[i + 3]); if (T2.p) ctx.fill(T2.p); } // wall tops: plain colour
    for (const r of grp.tops) {
      const X = r.x * CELL, Y = r.y * CELL, w = r.n * CELL, [tx, ty] = up(X, Y, r.f), s = 1 + h * r.f;
      if (r.sh) {
        ctx.save(); ctx.beginPath();
        for (const P of r.sh) { for (let i = 0; i < P.length; i += 2) { const [a, b] = up(P[i], P[i + 1], r.f); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); } ctx.closePath(); }
        ctx.clip();
      }
      pic.drawTo(ctx, X * G, Y * G, w * G, CELL * G, tx, ty, w * s, CELL * s);
      if (r.sh) ctx.restore();
    }
  }
}
// ---------------------------------------------------------------- camera tilt
// The world layers (#world) are turned in 3D: a fixed angle (11°, he asked for more than the first 7°; the top of the screen a little further away) plus a lean
// with your movement and a kick when you shoot or something blows up close by. The mouse is turned back with untilt.
export const tilt = {
  on: true, lean: true, el: null, M: null, extra: 0, // extra: more tilt (degrees; the rope camera)
  ax: 0, ay: 0, kx: 0, ky: 0, kvx: 0, kvy: 0,
  // vx, vy: your speed across the screen (px/s, screen directions); shake: the screen-shake amount
  update(dt, vx, vy, shake, W, H) {
    if (!this.el) this.el = document.getElementById('world');
    if (!this.on) { if (this.M) { this.el.style.transform = ''; this.M = null; } return; }
    const tx = this.lean ? Math.max(-1, Math.min(1, -vy / 140)) * 1.1 : 0, ty = this.lean ? Math.max(-1, Math.min(1, vx / 140)) * 1.3 : 0;
    const g = Math.min(1, dt * 3.5); this.ax += (tx - this.ax) * g; this.ay += (ty - this.ay) * g;
    // the kick is a spring: pushed by shots and blasts, it swings back and settles
    const sk = this.lean ? Math.min(6, shake) : 0;
    this.kvx += (-this.kx * 160 - this.kvx * 16) * dt + (Math.random() - 0.5) * sk * 9; this.kvy += (-this.ky * 160 - this.kvy * 16) * dt + (Math.random() - 0.5) * sk * 9;
    this.kx += this.kvx * dt; this.ky += this.kvy * dt;
    const P = new DOMMatrix(); P.m34 = -1 / Math.max(W, H) / 1.25;
    const M = new DOMMatrix().translateSelf(W / 2, H / 2).multiplySelf(P)
      .rotateSelf(11 + this.extra + this.ax + this.kx, this.ay + this.ky, 0).scaleSelf(1.1 + this.extra * 0.012, 1.1 + this.extra * 0.012).translateSelf(-W / 2, -H / 2 - H * 0.01 - H * this.extra * 0.006);
    this.M = M; this.el.style.transform = M.toString();
  },
  kick(k = 1) { if (this.lean && this.on) this.kvx -= 9 * k; },
  flat() { if (this.M) { this.el.style.transform = ''; this.M = null; document.documentElement.classList.remove('tilt3d', 'edgeblur'); } }, // menus: straight down
  // a point on the flat world layers (CSS px) → where it shows on the screen
  project(x, y) {
    const M = this.M; if (!M) return { x, y };
    const w = M.m14 * x + M.m24 * y + M.m44;
    return { x: (M.m11 * x + M.m21 * y + M.m41) / w, y: (M.m12 * x + M.m22 * y + M.m42) / w };
  },
  // a point on the screen (CSS px) → the same point on the flat world layers
  untilt(sx, sy) {
    const M = this.M; if (!M) return { x: sx, y: sy };
    const a = M.m11 - sx * M.m14, b = M.m21 - sx * M.m24, c = sx * M.m44 - M.m41;
    const d = M.m12 - sy * M.m14, e = M.m22 - sy * M.m24, f = sy * M.m44 - M.m42, det = a * e - b * d;
    if (Math.abs(det) < 1e-9) return { x: sx, y: sy };
    return { x: (c * e - b * f) / det, y: (a * f - c * d) / det };
  },
};

// where your team sees, for the raised walls: each sight line carried 12 px further on (the vision shapes stop 7 px into
// a wall, the raised walls need their whole thickness), raised to each height the walls are drawn at, all as one path.
// With m (cars, crates, shelves): a line that stops in a T.TALL cell is carried on through it to its far side, so the
// part of a car your sight lines reach lights up through its whole depth and the rest stays grey (he asked: a car
// seen only in part used to light up whole)
const HTS = [0, 1, 2, 3, 4].map(b => { const a = []; for (let f = -b; f <= 1.001; f += 0.25) a.push(+f.toFixed(2)); return a; });
// the same, plus round spots (x, y, r) raised through the same heights: the wall a climber hangs on, always in sight
export function addSpots(p, spots, cam, h, below = 0) {
  for (const s of spots) for (const f of below ? HTS[Math.min(4, below)] : HTS[0]) { const x = s.x + (s.x - cam.x) * h * f, y = s.y + (s.y - cam.y) * h * f; p.moveTo(x + s.r, y); p.arc(x, y, s.r, 0, Math.PI * 2); }
  return p;
}
export function sightClip(polys, views, cam, h, m, below = 0) { // below: storeys under this floor (their outside walls are drawn too)
  const p = new Path2D(), tall = (x, y) => m.tiles[Math.floor(y / CELL) * m.W + Math.floor(x / CELL)] === T.TALL;
  polys.forEach((pts, j) => {
    const v = views[j], far = [];
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i], y = pts[i + 1], dx = x - v.x, dy = y - v.y, d = Math.hypot(dx, dy);
      if (!(d > 1 && d < v.range - 1)) { far.push(x, y); continue; }
      const ux = dx / d, uy = dy / d;
      let push = 12;
      if (m && tall(x, y)) { push = 2; while (push < 80 && tall(x + ux * push, y + uy * push)) push += 2; }
      far.push(x + ux * push, y + uy * push);
    }
    // the sight shape swept from the lowest height drawn to the highest (a straight sweep, as the lift grows evenly
    // with height): the shape at both ends plus each edge's band between them, all wound the same way so they add up
    const f0 = below ? -Math.min(4, below) : 0, f1 = 1, n = far.length;
    if (n < 6) return;
    const at = (i, f) => [far[i] + (far[i] - cam.x) * h * f, far[i + 1] + (far[i + 1] - cam.y) * h * f];
    let ar = 0; for (let i = 0; i < n; i += 2) { const j = (i + 2) % n; ar += far[i] * far[j + 1] - far[j] * far[i + 1]; }
    for (const f of [f0, f1]) { // the ends, turned to wind the same way as the bands below
      if (ar > 0) for (let i = 0; i < n; i += 2) { const [x, y] = at(i, f); i ? p.lineTo(x, y) : p.moveTo(x, y); }
      else for (let i = n - 2; i >= 0; i -= 2) { const [x, y] = at(i, f); i === n - 2 ? p.moveTo(x, y) : p.lineTo(x, y); }
      p.closePath();
    }
    for (let i = 0; i < n; i += 2) {
      const j = (i + 2) % n, A0 = at(i, f0), B0 = at(j, f0), B1 = at(j, f1), A1 = at(i, f1);
      const q = (B0[0] - A0[0]) * (B1[1] - A0[1]) - (B1[0] - A0[0]) * (B0[1] - A0[1]) + (B1[0] - A0[0]) * (A1[1] - A0[1]) - (A1[0] - A0[0]) * (B1[1] - A0[1]);
      if (Math.abs(q) < 0.01) continue;
      if (q > 0) { p.moveTo(A0[0], A0[1]); p.lineTo(B0[0], B0[1]); p.lineTo(B1[0], B1[1]); p.lineTo(A1[0], A1[1]); }
      else { p.moveTo(A1[0], A1[1]); p.lineTo(B1[0], B1[1]); p.lineTo(B0[0], B0[1]); p.lineTo(A0[0], A0[1]); }
      p.closePath();
    }
  });
  return p;
}
