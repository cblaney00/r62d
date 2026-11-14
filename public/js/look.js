// The look overhaul (he asked: the game felt flat, "a board game playing itself"; he chose all four): room lighting with
// warm lamp pools and cool shadows baked into the map picture, raised walls with sides and tops that shift with the
// camera (parallax), and a camera tilt — a slight fixed angle plus a lean with your movement and a kick on shots/blasts.
// Everything here is cheap for the graphics card: the light is drawn once with the map, the walls are plain canvas
// fills and copies of the map picture, and the tilt is one CSS transform the browser applies to the world layers.
import { CELL, T, MAT, FL } from '/shared/constants.js';
import { cellBelow, cellAbove } from '/shared/map.js';

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
const isOut = (m, n) => n >= 0 && n < m.tiles.length && (m.floor[n] === FL.VOID || m.tiles[n] === T.GROUND || m.tiles[n] === T.VOID);
const KEPT = new WeakMap(); // renderer → { m, cw, blocks: [] }
function block(R, m, bx, by) {
  const W = m.W, rise = riseOf(m), hg = k => height(m, k, rise), out = [{ faces: [], tops: [] }, { faces: [], tops: [] }, { faces: [], tops: [] }]; // 2: the storeys above (rope camera only)
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
        const d = g ? 0 : base === BRICK ? 'b' : t === T.HARD && !(m.mat && m.mat[k] === MAT.DRYWALL) ? 'c' : 'p', e = isOut(m, n);
        if (dx) faces.push({ ax: ex, ay: Y, bx: ex, by: Y + CELL, nx: dx, ny: 0, px: ex, py: Y, f, x, y, c: col(lt), d, e });
        else faces.push({ ax: X, ay: ey, bx: X + CELL, by: ey, nx: 0, ny: dy, px: X, py: ey, f, x, y, c: col(lt), d, e });
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
    // the wall it sits in: along the wall's own line (the side where the cells across are not wall), up to 8 cells away
    let wk = -1; const solidAt = n => n >= 0 && n < m.tiles.length && hg(n) >= 1 && m.tiles[n] !== T.TALL && m.tiles[n] !== T.LOW;
    const alongX = !solidAt(k - W) && !solidAt(k + W);
    for (let i = 1; i <= 8 && wk < 0; i++) for (const s of [1, -1]) { const n = alongX ? k + s * i : k + s * i * W; if (solidAt(n)) { wk = n; break; } }
    if (wk < 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = k + dy * W + dx; if (hg(n) >= 1) { wk = n; break; } }
    const wb = wk >= 0 ? (m.tiles[wk] === T.SOFT && m.mat && m.mat[wk] === MAT.BRICK ? BRICK : SIDE[m.tiles[wk]] || SIDE[T.HARD]) : SIDE[T.SOFT], wtc = wk >= 0 ? topColour(m, wk) : '#d8d2c4';
    const pieces = win ? [[0, 0.28, [176, 170, 158], '#b9b2a2'], [0.69, 1, wb, wtc]] : [[0.72, 1, wb, wtc]];
    if (m.tiles[k] === T.BARRI) pieces.push(win ? [0.28, 0.69, [122, 92, 58], null] : [0.06, 0.72, [122, 92, 58], null]); // (boards are thin: no top)
    const X = x * CELL, Y = y * CELL, faces = out[0].faces;
    for (const [f0, f, base, tc] of pieces) {
      const col = lt => `rgb(${base[0] * lt | 0},${base[1] * lt | 0},${base[2] * lt | 0})`;
      for (const [dx, dy, lt] of FACES) {
        const n = k + dy * W + dx, nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= m.H || hg(n) >= f || (m.openId[n] === oi && oi >= 0)) continue; // against the wall, or more of the same opening
        const ex = dx > 0 ? X + CELL : X, ey = dy > 0 ? Y + CELL : Y;
        const d = base === BRICK ? 'b' : base[0] === 122 ? 'w' : base[0] === 176 ? 's' : 'p';
        if (dx) faces.push({ ax: ex, ay: Y, bx: ex, by: Y + CELL, nx: dx, ny: 0, px: ex, py: Y, f, f0, x, y, c: col(lt), d, e: isOut(m, n) });
        else faces.push({ ax: X, ay: ey, bx: X + CELL, by: ey, nx: 0, ny: dy, px: X, py: ey, f, f0, x, y, c: col(lt), d, e: isOut(m, n) });
      }
      if (tc) out[0].tops.push({ x, y, n: 1, f, g: 0, tc, low: f < 0.99 });
    }
  }
  facade(m, x0, y0, x1, y1, hg, out[0].faces, under, -1);
  facade(m, x0, y0, x1, y1, hg, out[2].faces, cellAbove, 1);
  return out;
}
// The building below an upper floor (he asked 2026-11-14: more volume, more detail on the outside of the building): an
// outside wall of an upper floor carries on down, storey by storey, to the ground, as faces at heights below its own
// floor (-1 = the storey under it). Each storey shows what is really there: wall (brick or plaster), a window (sill,
// glass, lintel) or a doorway, until the building steps in.
const GLASS = [46, 62, 78], DOORWAY = [30, 27, 25];
// the cell under k, from the roof too (cellBelow leaves the roof out)
function under(m, k) {
  const r = cellBelow(m, k); if (r >= 0) return r;
  const W = m.W, x = k % W, y = Math.floor(k / W), f = m.floors.find(q => x >= q.gx && x < q.gx + q.w);
  if (!f || !f.roof || !f.i) return -1;
  const b = m.floors[f.i - 1], lx = x - f.gx + f.x0 - b.x0, ly = y + f.y0 - b.y0;
  return lx < 0 || ly < 0 || lx >= b.w || ly >= b.h ? -1 : ly * W + b.gx + lx;
}
function facade(m, x0, y0, x1, y1, hg, faces, next, dir) { // next: cellBelow (dir -1) or cellAbove (dir 1, the storeys over this one)
  const W = m.W, air = n => n >= 0 && n < m.tiles.length && m.floor[n] === FL.VOID;
  const outside = n => n >= 0 && n < m.tiles.length && (m.floor[n] === FL.VOID || m.tiles[n] === T.GROUND || m.tiles[n] === T.VOID);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const k = y * W + x; if (next(m, k) < 0) continue;
    const wall = hg(k) >= 1 && m.tiles[k] !== T.TALL && m.tiles[k] !== T.LOW, open = !wall && m.openId && m.openId[k] >= 0 && hg(k) === 0;
    const roofEdge = dir < 0 && m.floor[k] === FL.ROOF && m.tiles[k] !== T.LOW; // the roof's edge: the walls under it carry on down
    if (!wall && !open && !roofEdge) continue;
    const X = x * CELL, Y = y * CELL;
    for (const [dx, dy, lt] of FACES) {
      const n = k + dy * W + dx; if (!air(n)) continue;
      const ex = dx > 0 ? X + CELL : X, ey = dy > 0 ? Y + CELL : Y;
      let kb = k, nb = n;
      for (let s = 1; s <= 4; s++) {
        kb = next(m, kb); nb = next(m, nb); if (kb < 0 || nb < 0 || !outside(nb)) break;
        const t = m.tiles[kb], win = !!(m.win && m.win[kb]), oi = m.openId ? m.openId[kb] : -1, door = !win && oi >= 0 && m.openings && m.openings[oi] && m.openings[oi].kind === 'door';
        const solid = t === T.HARD || t === T.SOFT || t === T.REINF || t === T.PANEL;
        if (!solid && !win && !door) break; // the building steps in under here
        const wb = t === T.SOFT && m.mat && m.mat[kb] === MAT.BRICK ? BRICK : SIDE[t] || SIDE[T.SOFT], dk = wb === BRICK ? 'b' : t === T.HARD ? 'c' : 'p';
        const pieces = solid ? [[0, 1, wb, dk]] : win ? [[0, 0.28, wb, dk], [0.28, 0.69, GLASS, 'g'], [0.69, 1, wb, dk]] : [[0, 0.72, DOORWAY, 'o'], [0.72, 1, wb, dk]];
        const low = dir < 0 ? 1 - 0.05 * s : 1; // a little darker toward the ground
        for (const [a, b, base, d] of pieces) {
          const c = `rgb(${base[0] * lt * low | 0},${base[1] * lt * low | 0},${base[2] * lt * low | 0})`, f0 = a + s * dir, f = b + s * dir;
          const gnd = dir < 0 && a === 0 && next(m, kb) < 0; // standing on the ground: the ground is drawn out from its foot
          if (dx) faces.push({ ax: ex, ay: Y, bx: ex, by: Y + CELL, nx: dx, ny: 0, px: ex, py: Y, f, f0: f0 || -1e-6, x, y, c, d, s, e: 1, gnd });
          else faces.push({ ax: X, ay: ey, bx: X + CELL, by: ey, nx: 0, ny: dy, px: X, py: ey, f, f0: f0 || -1e-6, x, y, c, d, s, e: 1, gnd });
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
// Which map cells your team sees this frame (he asked 2026-11-14: colour only where you really see, not deep in the
// building): the sight shapes filled cell by cell, grown by one cell (a wall's face is the cell beside what you see).
// spots: round areas always counted as seen (the wall in front of a climber).
export function seenGrid(polys, m, spots = []) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const P of polys) for (let i = 0; i < P.length; i += 2) { if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i]; if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1]; }
  for (const q of spots) { x0 = Math.min(x0, q.x - q.r); x1 = Math.max(x1, q.x + q.r); y0 = Math.min(y0, q.y - q.r); y1 = Math.max(y1, q.y + q.r); }
  if (x1 < x0) return null;
  const gx = Math.max(0, Math.floor(x0 / CELL) - 1), gy = Math.max(0, Math.floor(y0 / CELL) - 1), w = Math.min(m.W, Math.ceil(x1 / CELL) + 2) - gx, hh = Math.min(m.H, Math.ceil(y1 / CELL) + 2) - gy;
  if (w <= 0 || hh <= 0) return null;
  const a = new Uint8Array(w * hh), xs = [];
  for (const P of polys) { // scanline: each row's middle against the outline's edges
    const n = P.length; if (n < 6) continue;
    for (let r = 0; r < hh; r++) {
      const yy = (gy + r + 0.5) * CELL; xs.length = 0;
      for (let i = 0; i < n; i += 2) { const ax = P[i], ay = P[i + 1], bx = P[(i + 2) % n], by = P[(i + 3) % n]; if ((ay <= yy) !== (by <= yy)) xs.push(ax + (yy - ay) / (by - ay) * (bx - ax)); }
      xs.sort((p, q) => p - q);
      for (let j = 0; j + 1 < xs.length; j += 2) { const c0 = Math.max(0, Math.floor(xs[j] / CELL) - gx), c1 = Math.min(w - 1, Math.floor(xs[j + 1] / CELL) - gx); for (let cc = c0; cc <= c1; cc++) a[r * w + cc] = 1; }
    }
  }
  for (const q of spots) { const R2 = (q.r / CELL) ** 2, cx = q.x / CELL - gx, cy = q.y / CELL - gy; for (let r = Math.max(0, Math.floor(cy - q.r / CELL)); r <= Math.min(hh - 1, Math.ceil(cy + q.r / CELL)); r++) for (let cc = Math.max(0, Math.floor(cx - q.r / CELL)); cc <= Math.min(w - 1, Math.ceil(cx + q.r / CELL)); cc++) if ((cc + 0.5 - cx) ** 2 + (r + 0.5 - cy) ** 2 <= R2) a[r * w + cc] = 1; }
  const g = new Uint8Array(w * hh); // grown by one cell
  for (let r = 0; r < hh; r++) for (let cc = 0; cc < w; cc++) if (a[r * w + cc]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const rr = r + dy, c2 = cc + dx; if (rr >= 0 && c2 >= 0 && rr < hh && c2 < w) g[rr * w + c2] = 1; }
  return { gx, gy, w, h: hh, a: g, at(x, y) { x -= this.gx; y -= this.gy; return x >= 0 && y >= 0 && x < this.w && y < this.h && this.a[y * this.w + x] === 1; } };
}
// One frame's raised pieces, sorted back to front (he asked: a wall in front must cover the furniture behind it): bands by
// distance from the eye (BAND world px), each with its tall things and its walls; the storeys below (fac) and above (up)
// apart. Each holds everything (for the greyed copy) and, when seen is given, only the pieces whose own spot is seen.
const BAND = 48;
const coll = () => ({ paths: new Map(), lowTops: new Map(), topPaths: new Map(), tops: [], dark: null, light: null, glint: null, n: 0 });
export function raisedFrame(R, m, cam, h, x0, y0, x1, y1, above = false, seen = null, spots = null) { // spots: round areas (world px) whose outside wall pieces show whole (the wall a climber hangs on) // above: also the storeys over this floor (rope camera)
  const K = kept(R, m), cx = cam.x, cy = cam.y, up = (x, y, f) => [x + (x - cx) * h * f, y + (y - cy) * h * f];
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(m.W - 1, x1); y1 = Math.min(m.H - 1, y1);
  const bands = new Map(), fac = { all: coll(), lit: coll() }, upS = { all: coll(), lit: coll() }, ground = { all: [], lit: [] };
  const GD = CELL * 40, gq = (F, L) => { // a strip of ground from the foot of the building out toward the eye (8 numbers), wound one way
    const a = up(F.ax, F.ay, F.f0), b = up(F.bx, F.by, F.f0), c = up(F.bx + F.nx * GD, F.by + F.ny * GD, F.f0), d = up(F.ax + F.nx * GD, F.ay + F.ny * GD, F.f0);
    const q = [a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]]; let ar = 0; for (let i = 0; i < 8; i += 2) { const j = (i + 2) % 8; ar += q[i] * q[j + 1] - q[j] * q[i + 1]; }
    if (ar < 0) { const r = [q[6], q[7], q[4], q[5], q[2], q[3], q[0], q[1]]; L.push(r); } else L.push(q);
  };
  const band = (x, y) => { const i = Math.floor(Math.hypot(x - cx, y - cy) / BAND); let B = bands.get(i); if (!B) bands.set(i, B = { all: [coll(), coll()], lit: [coll(), coll()] }); return B; };
  const addFace = (G, F) => {
    let p = G.paths.get(F.c); if (!p) G.paths.set(F.c, p = new Path2D());
    const [ux, uy] = up(F.ax, F.ay, F.f), [vx, vy] = up(F.bx, F.by, F.f);
    if (F.f0) { const [a1, b1] = up(F.ax, F.ay, F.f0), [a2, b2] = up(F.bx, F.by, F.f0); p.moveTo(a1, b1); p.lineTo(a2, b2); } else { p.moveTo(F.ax, F.ay); p.lineTo(F.bx, F.by); } p.lineTo(vx, vy); p.lineTo(ux, uy); p.closePath(); // (a piece off the floor, like a window's lintel, starts at f0)
    if (F.d) deco(G, F, up); G.n++;
  };
  const addTop = (G, r) => {
    if (!r.tc) { G.tops.push(r); G.n++; return; }
    const TP = r.low ? G.lowTops : G.topPaths; // a sill's top: under the faces of what stands above it
    let T2 = TP.get(r.tc); if (!T2) TP.set(r.tc, T2 = { p: null, r: [] });
    const sc = 1 + h * r.f;
    if (r.sh) { const p = T2.p || (T2.p = new Path2D()); for (const P of r.sh) { for (let i = 0; i < P.length; i += 2) { const [a, b] = up(P[i], P[i + 1], r.f); i ? p.lineTo(a, b) : p.moveTo(a, b); } p.closePath(); } }
    else { const [tx, ty] = up(r.x * CELL, r.y * CELL, r.f); T2.r.push(tx, ty, r.n * CELL * sc, CELL * sc); } // plain rectangles: far cheaper on the graphics card than one big shape
    G.n++;
  };
  const seenAt = (x, y) => !!seen && seen.at(x, y);
  const inSpot = (x, y) => { if (!spots) return false; for (const q of spots) if (Math.hypot((x + 0.5) * CELL - q.x, (y + 0.5) * CELL - q.y) < q.r) return true; return false; };
  const airBy = k => m.floor[k - 1] === FL.VOID || m.floor[k + 1] === FL.VOID || m.floor[k - m.W] === FL.VOID || m.floor[k + m.W] === FL.VOID;
  for (let by = Math.floor(y0 / CH); by <= Math.floor(y1 / CH); by++) for (let bx = Math.floor(x0 / CH); bx <= Math.floor(x1 / CH); bx++) {
    const i = by * K.cw + bx, B = K.blocks[i] || (K.blocks[i] = block(R, m, bx, by));
    const whole = bx * CH >= x0 && by * CH >= y0 && bx * CH + CH - 1 <= x1 && by * CH + CH - 1 <= y1; // else: check each piece is in range
    for (let g = 0; g < 3; g++) {
      if (g === 2 && !above) continue;
      for (const F of B[g].faces) {
        if (F.nx * (cx - F.px) + F.ny * (cy - F.py) <= 0) continue; // turned away from the camera
        if (!whole && (F.x < x0 || F.x > x1 || F.y < y0 || F.y > y1)) continue;
        const lit = seenAt(F.x + Math.sign(F.nx), F.y + Math.sign(F.ny)); // the cell this face looks onto
        if (g === 2 || F.s || (F.e && g === 0 && inSpot(F.x, F.y))) { const S = g === 2 ? upS : fac; addFace(S.all, F); if (lit) addFace(S.lit, F); if (F.gnd) { gq(F, ground.all); if (lit) gq(F, ground.lit); } continue; }
        const Bd = band((F.ax + F.bx) / 2, (F.ay + F.by) / 2); addFace(Bd.all[g === 1 ? 0 : 1], F); if (lit) addFace(Bd.lit[g === 1 ? 0 : 1], F);
      }
      if (g === 2) continue;
      for (const r of B[g].tops) {
        if (!whole && (r.y < y0 || r.y > y1 || r.x + r.n - 1 < x0 || r.x > x1)) continue;
        let lit = false; if (seen) for (let q = 0; q < r.n && !lit; q++) lit = seen.at(r.x + q, r.y);
        if (g === 0 && spots && inSpot(r.x, r.y) && airBy(r.y * m.W + r.x)) { addTop(fac.all, r); if (lit) addTop(fac.lit, r); continue; }
        const Bd = band((r.x + r.n / 2) * CELL, (r.y + 0.5) * CELL); addTop(Bd.all[g === 1 ? 0 : 1], r); if (lit) addTop(Bd.lit[g === 1 ? 0 : 1], r);
      }
    }
  }
  const order = [...bands.keys()].sort((p, q) => q - p).map(k => bands.get(k)); // far first
  return { order, fac, up: upS, ground, cam: { x: cx, y: cy }, h };
}
// The surface of a wall face (he asked 2026-11-14: walls, doors and windows with a lot more detail): brick courses with
// staggered joints, a skirting line inside, a band at each storey outside, window panes with a frame, a bar and a glint,
// boards with their gaps. As lines, only as many as the face is tall on the screen (never closer than 2.6 world px).
function deco(G, F, up) {
  if (!G.dark) { G.dark = new Path2D(); G.light = new Path2D(); G.glint = new Path2D(); }
  const z0 = F.f0 || 0, z1 = F.f, [pax, pay] = up(F.ax, F.ay, z0), [pux, puy] = up(F.ax, F.ay, z1), tall = Math.hypot(pux - pax, puy - pay);
  const line = (P, t0, za, t1, zb) => { const ax = F.ax + (F.bx - F.ax) * t0, ay = F.ay + (F.by - F.ay) * t0, bx = F.ax + (F.bx - F.ax) * t1, by = F.ay + (F.by - F.ay) * t1, [a, b] = up(ax, ay, za), [c, d] = up(bx, by, zb); P.moveTo(a, b); P.lineTo(c, d); };
  if (F.d === 'b') { // brick: courses of about 23 cm, the joints half a brick apart
    const n = Math.min(Math.round((z1 - z0) * 14), Math.floor(tall / 2.6)); if (n < 2) return;
    const odd = (F.x + F.y) & 1;
    for (let i = 1; i <= n; i++) { const z = z0 + (z1 - z0) * i / n; if (i < n) line(G.dark, 0, z, 1, z); const zb = z0 + (z1 - z0) * (i - 1) / n, t = (i + odd) & 1 ? 0.5 : 0.02; line(G.dark, t, zb, t, z); }
  } else if (F.d === 'p' || F.d === 'c') { // plaster or concrete
    const sb = Math.floor(z0 + 1e-6), full = z1 - z0 > 0.9; // the storey this face belongs to (0 = this floor, -1 the one below...)
    if (F.e) { // outside: a plinth at the foot of each storey, a cornice line under its top
      if (full && tall > 5) { line(G.dark, 0, sb + 0.06, 1, sb + 0.06); line(G.light, 0, sb + 0.94, 1, sb + 0.94); line(G.dark, 0, sb + 0.97, 1, sb + 0.97); }
    } else if (z0 >= 0 && z1 >= 0.9 && tall > 6) { line(G.dark, 0, 0.035, 1, 0.035); line(G.light, 0, 0.05, 1, 0.05); } // inside: a skirting board
    if (F.d === 'c' && full && tall > 9) { // concrete: formwork panels and the round tie holes left in them
      line(G.dark, 0, sb + 0.36, 1, sb + 0.36); line(G.dark, 0, sb + 0.68, 1, sb + 0.68);
      if (!((F.x + F.y) % 2)) line(G.dark, 0.02, sb + 0.06, 0.02, sb + 0.94);
      if (tall > 14) for (const zz of [0.2, 0.52, 0.84]) for (const tt of [0.28, 0.76]) line(G.dark, tt, sb + zz, tt + 0.05, sb + zz);
    } else if (z1 > 0.5 && z0 < 0.5 && tall > 10 && (F.x * 7 + F.y * 3) % 5 === 0) line(G.dark, 0.5, Math.max(z0, 0.08), 0.5, Math.min(z1, 0.92)); // plaster: a seam now and then
  } else if (F.d === 's' && tall > 3) { line(G.light, 0, z1 - 0.01, 1, z1 - 0.01); line(G.dark, 0, z1 - 0.05, 1, z1 - 0.05); } /* a window sill: its lip */ else if (F.d === 'g') { // glass: frame, a middle bar, a sill lip and a glint across
    if (tall < 3) return;
    line(G.light, 0, z0, 1, z0); line(G.light, 0, z1, 1, z1); line(G.light, 0.02, z0, 0.02, z1); line(G.light, 0.98, z0, 0.98, z1);
    line(G.dark, 0.5, z0, 0.5, z1); line(G.glint, 0.15, z0 + (z1 - z0) * 0.2, 0.55, z0 + (z1 - z0) * 0.9);
  } else if (F.d === 'w') { // boards across a window or door: the gaps between them
    const n = Math.min(4, Math.floor(tall / 3)); for (let i = 1; i < n; i++) { const z = z0 + (z1 - z0) * i / n; line(G.dark, 0, z, 1, z); }
  } else if (F.d === 'o' && tall > 4) { line(G.light, 0.04, z0, 0.04, z1); line(G.light, 0.96, z0, 0.96, z1); line(G.light, 0.04, z1, 0.96, z1); } // a doorway: its frame
}
// Draw a raisedFrame. which: 'all' (everything, the greyed copy), 'lit' (the seen pieces of this floor, far to near;
// the caller clips to the sight shapes for a smooth edge) or 'out' (the seen storeys below and above). The tops come from
// pic (the map picture, or its small copy far out); upA: how much the storeys above show (the rope camera fades them in).
function drawColl(ctx, G, pic, R, h, up, plain) {
  if (!G.n) return;
  const S = pic.width / R.Wp;
  for (const [c, T2] of G.lowTops) { ctx.fillStyle = c; const q = T2.r; for (let i = 0; i < q.length; i += 4) ctx.fillRect(q[i], q[i + 1], q[i + 2], q[i + 3]); }
  for (const [c, p] of G.paths) { ctx.fillStyle = c; ctx.fill(p); }
  if (G.dark && !plain) { ctx.lineWidth = 0.6; ctx.strokeStyle = 'rgba(20,16,14,0.32)'; ctx.stroke(G.dark); ctx.strokeStyle = 'rgba(235,228,214,0.32)'; ctx.stroke(G.light); ctx.lineWidth = 1.1; ctx.strokeStyle = 'rgba(210,230,250,0.22)'; ctx.stroke(G.glint); }
  for (const [c, T2] of G.topPaths) { ctx.fillStyle = c; const q = T2.r; for (let i = 0; i < q.length; i += 4) ctx.fillRect(q[i], q[i + 1], q[i + 2], q[i + 3]); if (T2.p) ctx.fill(T2.p); } // wall tops: plain colour
  for (const r of G.tops) { // cars, crates, shelves: their tops from the map picture
    const X = r.x * CELL, Y = r.y * CELL, w = r.n * CELL, [tx, ty] = up(X, Y, r.f), s = 1 + h * r.f;
    if (r.sh) { ctx.save(); ctx.beginPath(); for (const P of r.sh) { for (let i = 0; i < P.length; i += 2) { const [a, b] = up(P[i], P[i + 1], r.f); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); } ctx.closePath(); } ctx.clip(); }
    pic.drawTo(ctx, X * S, Y * S, w * S, CELL * S, tx, ty, w * s, CELL * s);
    if (r.sh) ctx.restore();
  }
}
export function drawRaised(ctx, R, fr, which, pic = R.c, plain = false, upA = 1) { // plain: no surface lines (the greyed copy out of sight)
  const cx = fr.cam.x, cy = fr.cam.y, h = fr.h, up = (x, y, f) => [x + (x - cx) * h * f, y + (y - cy) * h * f];
  const k = which === 'all' ? 'all' : 'lit';
  if (which !== 'lit') {
    drawColl(ctx, fr.fac[k], pic, R, h, up, plain);
    if (fr.up[k].n && upA > 0.01) { ctx.save(); ctx.globalAlpha *= upA; drawColl(ctx, fr.up[k], pic, R, h, up, plain); ctx.restore(); }
    if (which === 'out') return;
  }
  for (const B of fr.order) { drawColl(ctx, B[k][0], pic, R, h, up, plain); drawColl(ctx, B[k][1], pic, R, h, up, plain); } // far to near; in each band the furniture, then the walls in front of it
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
    const make = s => new DOMMatrix().translateSelf(W / 2, H / 2).multiplySelf(P)
      .rotateSelf(11 + this.extra + this.ax + this.kx, this.ay + this.ky, 0).scaleSelf(s, s).translateSelf(-W / 2, -H / 2 - H * 0.01 - H * this.extra * 0.006);
    // the layers must always fill the screen (he saw a lit sliver above the steep rope view): grow until all four
    // corners of the layer are off screen
    let s = 1.1 + this.extra * 0.012, M = make(s);
    for (let i = 0; i < 8; i++) {
      this.M = M; const a = this.project(0, 0), b = this.project(W, 0), c = this.project(0, H), d = this.project(W, H);
      if (a.y <= 0 && b.y <= 0 && a.x <= 0 && b.x >= W && c.y >= H && d.y >= H && c.x <= 0 && d.x >= W) break;
      s *= 1.05; M = make(s);
    }
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
export function addSpots(p, spots, cam, h, below = 0, above = 0) {
  for (const s of spots) for (const f of (below ? HTS[Math.min(4, below)] : HTS[0]).concat(above ? [1.5, 2, 2.5, 3].filter(f => f <= 1 + above) : [])) { const x = s.x + (s.x - cam.x) * h * f, y = s.y + (s.y - cam.y) * h * f; p.moveTo(x + s.r, y); p.arc(x, y, s.r, 0, Math.PI * 2); }
  return p;
}
// drop the points of a closed outline that lie (within tol px) on the straight line between their neighbours
function thin(a, tol = 0.8) {
  if (a.length < 12) return;
  const out = [a[0], a[1]]; let px = a[0], py = a[1];
  for (let i = 2; i < a.length; i += 2) {
    const x = a[i], y = a[i + 1], nx = a[(i + 2) % a.length], ny = a[(i + 3) % a.length], dx = nx - px, dy = ny - py, L = Math.hypot(dx, dy);
    if (L > 0.01 && Math.abs((x - px) * dy - (y - py) * dx) / L < tol && (x - px) * dx + (y - py) * dy > 0 && (nx - x) * dx + (ny - y) * dy > 0) continue;
    out.push(x, y); px = x; py = y;
  }
  a.length = 0; for (const v of out) a.push(v);
}
export function sightClip(polys, views, cam, h, m, below = 0, above = 0) { // below: storeys under this floor (their outside walls are drawn too)
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
    thin(far); // (most points lie along the same wall: dropping them makes the shape far cheaper for the graphics card)
    const f0 = below ? -Math.min(4, below) : 0, f1 = 1 + above, n = far.length;
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
