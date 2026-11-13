// The look overhaul (he asked: the game felt flat, "a board game playing itself"; he chose all four): room lighting with
// warm lamp pools and cool shadows baked into the map picture, raised walls with sides and tops that shift with the
// camera (parallax), and a camera tilt — a slight fixed angle plus a lean with your movement and a kick on shots/blasts.
// Everything here is cheap for the graphics card: the light is drawn once with the map, the walls are plain canvas
// fills and copies of the map picture, and the tilt is one CSS transform the browser applies to the world layers.
import { CELL, T, MAT } from '/shared/constants.js';

export const looks = { light: true }; // switched by Settings → Screen → Room lighting (main.js)

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
const HGT = { [T.HARD]: 1, [T.SOFT]: 1, [T.REINF]: 1, [T.PANEL]: 1, [T.TALL]: 0.7, [T.DSHIELD]: 0.45 };
const SIDE = { [T.HARD]: [107, 112, 118], [T.SOFT]: [178, 170, 155], [T.REINF]: [76, 84, 93], [T.PANEL]: [53, 59, 66], [T.TALL]: [70, 60, 50], [T.DSHIELD]: [40, 45, 52] };
const BRICK = [125, 68, 52];
// furniture and things outdoors only stand up when they are boxy: a round tree, rock or bush raised as its square cells
// showed a square slab of grass round it (he saw it as strange shapes)
const BOXY = new Set(['crates', 'wall', 'car', 'dumpster', 'rack', 'shelf', 'container', 'cabinet', 'bookshelf', 'pillar', 'van', 'locker', 'train', 'fridge', 'truck', 'booth', 'schoolbus', 'bus', 'gatehouse', 'lifthut', 'signalbox', 'tankcar', 'counter', 'forklift', 'snowcat', 'stall', 'cart']);
const RISE = new WeakMap(); // map → per cell: 1 where a tall cell belongs to a boxy thing
export function riseOf(m) {
  let r = RISE.get(m); if (r) return r;
  RISE.set(m, r = new Uint8Array(m.W * m.H));
  for (const p of m.props || []) if (BOXY.has(p.kind)) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) r[y * m.W + x] = 1;
  return r;
}
const height = (m, k, rise) => { const t = m.tiles[k]; return t === T.TALL ? (rise[k] ? HGT[t] : 0) : HGT[t] || 0; };
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
      const k = y * W + x, f = x <= x1 ? hg(k) : 0, on = f > 0, g = on && m.tiles[k] === T.TALL ? 1 : 0;
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
        if (dx) faces.push({ ax: ex, ay: Y, bx: ex, by: Y + CELL, nx: dx, ny: 0, px: ex, py: Y, f, x, y, c: col(lt) });
        else faces.push({ ax: X, ay: ey, bx: X + CELL, by: ey, nx: 0, ny: dy, px: X, py: ey, f, x, y, c: col(lt) });
      }
      if (!run) run = { x, y, n: 0, f, g, tc }; run.n++;
    }
  }
  return out;
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
  const groups = [{ paths: new Map(), tops: [], topPaths: new Map() }, { paths: new Map(), tops: [], topPaths: new Map() }];
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
        p.moveTo(F.ax, F.ay); p.lineTo(F.bx, F.by); p.lineTo(vx, vy); p.lineTo(ux, uy); p.closePath();
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
// draw groups of a raisedFrame (0 walls, 1 tall things); the tops come from pic (the map picture, or its small copy far out)
export function drawRaised(ctx, R, fr, which, pic = R.c) {
  const cx = fr.cam.x, cy = fr.cam.y, h = fr.h, G = pic.width / R.Wp, up = (x, y, f) => [x + (x - cx) * h * f, y + (y - cy) * h * f];
  for (const g of which) {
    const grp = fr.groups[g];
    for (const [c, p] of grp.paths) { ctx.fillStyle = c; ctx.fill(p); }
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
  on: true, lean: true, el: null, M: null,
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
      .rotateSelf(11 + this.ax + this.kx, this.ay + this.ky, 0).scaleSelf(1.1, 1.1).translateSelf(-W / 2, -H / 2 - H * 0.01);
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
export function sightClip(polys, views, cam, h, m) {
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
    for (const f of [0, 0.7, 1]) {
      for (let i = 0; i < far.length; i += 2) { const x = far[i] + (far[i] - cam.x) * h * f, y = far[i + 1] + (far[i + 1] - cam.y) * h * f; i ? p.lineTo(x, y) : p.moveTo(x, y); }
      p.closePath();
    }
  });
  return p;
}
