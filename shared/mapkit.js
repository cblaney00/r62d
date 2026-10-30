// Map building kit. A map has 1–3 floors. All floors live side by side in ONE tile grid,
// separated by solid "void" cells, so sight, bullets, movement, path finding and drawing all work
// per floor without knowing floors exist. Stairs join floors: walking off the end of a staircase
// moves you to the same spot on the other floor (map.portal).
//
// Maps are written in one shared "building frame": cell (x, y) means the same spot on every floor,
// so a stairwell or a room stacked above another uses the same numbers on both floors.
import { T, FL, MAT, CELL, CELL_HP } from './constants.js';
import { polyIn } from './physics.js';

// Clip a convex polygon [[x, y], ...] to a box; returns the part inside (wound so physics' outward normals work), or null.
function clipBox(pts, x0, y0, x1, y1) {
  let P = pts;
  const edges = [[p => p[0] - x0, 0, x0], [p => x1 - p[0], 0, x1], [p => p[1] - y0, 1, y0], [p => y1 - p[1], 1, y1]];
  for (const [inF, ax, v] of edges) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], ia = inF(a) >= 0, ib = inF(b) >= 0;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (v - a[ax]) / (b[ax] - a[ax]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    P = out; if (P.length < 3) return null;
  }
  const Q = P.filter((p, i) => { const q = P[(i + 1) % P.length]; return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) > 1e-6; });
  if (Q.length < 3) return null;
  let a2 = 0; for (let i = 0; i < Q.length; i++) { const p = Q[i], q = Q[(i + 1) % Q.length]; a2 += p[0] * q[1] - q[0] * p[1]; }
  if (Math.abs(a2) < 2e-4) return null;
  return a2 > 0 ? Q : Q.reverse();
}

const GAP = 8; // void cells between floors in the grid

// floors: [{ name: '1F', x0, y0, w, h, ground: true }] — each floor's area in the building frame.
// The ground floor usually covers the whole lot (garden, road...); upper floors and basements only
// their footprint plus a little margin. Everything outside a floor's rooms starts as void
// (open air above ground, solid earth below), except on the ground floor (grass).
export function makeMap({ id, name, floors }) {
  let gx = 0;
  const fl = floors.map((f, i) => { const o = { ...f, i, gx, gy: 0 }; gx += f.w + GAP; return o; });
  const W = gx - GAP, H = Math.max(...floors.map(f => f.h)), N = W * H;
  const tiles = new Uint8Array(N).fill(T.VOID), floor = new Uint8Array(N).fill(FL.VOID);
  const mat = new Uint8Array(N).fill(MAT.DRYWALL), hp = new Int16Array(N);
  const dhole = new Uint8Array(N); // 1 = a drone hole at the foot of this (soft) wall cell
  const win = new Uint8Array(N); // 1 = a window cell: bodies must vault through it
  const openId = new Int16Array(N).fill(-1), portal = new Int32Array(N).fill(-1), flAt = new Uint8Array(N).fill(255);
  const props = [], openings = [], rooms = [], stairs = [], decor = [];
  const shape = {}; // k -> solid parts of an angled/curved wall cell (see "angled and curved walls" below)
  for (const f of fl) for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
    const k = y * W + f.gx + x; flAt[k] = f.i;
    if (f.ground) { tiles[k] = T.GROUND; floor[k] = FL.GRASS; }
  }

  const floorKit = f => {
    // building frame -> grid cell index (or -1 when outside this floor's area)
    const idx = (x, y) => { const lx = x - f.x0, ly = y - f.y0; return lx < 0 || ly < 0 || lx >= f.w || ly >= f.h ? -1 : ly * W + f.gx + lx; };
    const each = (x0, y0, x1, y1, fn) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const k = idx(x, y); if (k >= 0) fn(k, x, y); } };
    const K = {
      f, idx,
      // world position (pixels) of the centre of a building-frame cell on this floor
      c: (x, y) => ({ x: (f.gx + x - f.x0 + 0.5) * CELL, y: (y - f.y0 + 0.5) * CELL }),
      ground(x0, y0, w, h, fType) { each(x0, y0, x0 + w - 1, y0 + h - 1, k => { tiles[k] = T.GROUND; floor[k] = fType; }); },
      // walkable floor that is not a room (balcony, roof, basement corridor without a name)
      // an open drop (to the floor below): you can see and shoot across it, but not walk into it
      drop(x0, y0, w, h) { each(x0, y0, x0 + w - 1, y0 + h - 1, k => { tiles[k] = T.LOW; floor[k] = FL.VOID; }); },
      slab(x0, y0, w, h, fType) { each(x0, y0, x0 + w - 1, y0 + h - 1, k => { tiles[k] = T.FLOOR; floor[k] = fType; delete shape[k]; }); },
      room(rname, x, y, w, h, fType) { rooms.push({ name: rname, fl: f.i, x: f.gx + x - f.x0, y: y - f.y0, w, h }); K.slab(x, y, w, h, fType); },
      // a room with its own walls one cell outside it (neighbouring rooms leave a one-cell gap: the shared wall)
      area(rname, x, y, w, h, fType, t = T.SOFT, m = MAT.DRYWALL) { K.room(rname, x, y, w, h, fType); K.box(x - 1, y - 1, x + w, y + h, t, m); },
      wall(x0, y0, x1, y1, t = T.SOFT, m = MAT.DRYWALL) { each(x0, y0, x1, y1, k => { tiles[k] = t; mat[k] = m; hp[k] = CELL_HP[t] || 0; delete shape[k]; }); },
      // a rectangle of walls around (and including the edge of) x0..x1, y0..y1
      box(x0, y0, x1, y1, t = T.SOFT, m = MAT.DRYWALL) { K.wall(x0, y0, x1, y0, t, m); K.wall(x0, y1, x1, y1, t, m); K.wall(x0, y0, x0, y1, t, m); K.wall(x1, y0, x1, y1, t, m); },
      pillar(list) { for (const [x, y] of list) K.wall(x, y, x, y, T.HARD, MAT.CONCRETE); },
      // a hand-placed drone hole in a soft wall cell (finish() also adds one between neighbouring rooms)
      droneHole(x, y) { const k = idx(x, y); if (k >= 0) dhole[k] = 1; },
      open(x0, y0, x1, y1, kind, ext = false) {
        const cells = [];
        each(x0, y0, x1, y1, k => { tiles[k] = T.OPEN; hp[k] = 0; openId[k] = openings.length; cells.push(k); delete shape[k]; });
        if (kind === "window") for (const k of cells) win[k] = 1; // a body vaults through a window, never walks
        openings.push({ id: openings.length, cells, kind, ext });
      },
      door: (x0, y0, x1, y1, ext) => K.open(x0, y0, x1, y1, 'door', ext),
      window: (x0, y0, x1, y1, ext = true) => K.open(x0, y0, x1, y1, 'window', ext),
      prop(kind, x, y, w, h, block, rot = 0) {
        const k0 = idx(x, y); if (k0 < 0) return;
        props.push({ kind, x: f.gx + x - f.x0, y: y - f.y0, w, h, rot });
        if (block !== null) each(x, y, x + w - 1, y + h - 1, k => { tiles[k] = block; });
      },
      // ---- angled and curved walls ----
      // Shapes are in building-frame cell units: cell (x, y) covers x..x+1, y..y+1, so 12.5 is the middle of cell 12.
      // Each cell a shape touches becomes wall, but keeps only the part inside the shape (map.shape), so bodies,
      // bullets and sight follow the real slope or curve. Plain floor, ground or void cells are taken over; cells
      // that are already whole walls, doors, stairs or furniture are left alone.
      // solid: fill a convex polygon [[x, y], ...] with wall.
      solid(pts, t = T.HARD, m = MAT.CONCRETE) {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        for (let cy = Math.floor(Math.min(...ys)); cy < Math.ceil(Math.max(...ys)); cy++)
          for (let cx = Math.floor(Math.min(...xs)); cx < Math.ceil(Math.max(...xs)); cx++) {
            const k = idx(cx, cy); if (k < 0) continue;
            const piece = clipBox(pts, cx, cy, cx + 1, cy + 1); if (!piece) continue;
            const cur = tiles[k];
            if (cur === T.HARD || cur === T.SOFT || cur === T.REINF) { if (!shape[k]) continue; }
            else if (cur === T.FLOOR || cur === T.GROUND || cur === T.VOID) { tiles[k] = t; mat[k] = m; hp[k] = CELL_HP[t] || 0; shape[k] = []; }
            else { if (areaOf(piece) > 0.02) console.warn(`${id} ${f.name}: a sloped wall runs into ${cur === T.OPEN ? 'a door/window' : cur === T.STAIR ? 'stairs' : 'furniture'} at ${cx},${cy} (leaves a gap)`); continue; }
            const w = []; for (const [u, v] of piece) w.push((f.gx + u - f.x0) * CELL, (v - f.y0) * CELL);
            shape[k].push(w);
          }
      },
      // a wall of thickness th along a line of points (mitred where it bends); closed joins the last point to the first
      walls(pts, th = 0.9, t = T.HARD, m = MAT.CONCRETE, closed = false) {
        const n = pts.length, L = [], R = [];
        const dir = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
        for (let i = 0; i < n; i++) {
          const p = pts[i], prev = closed || i > 0 ? pts[(i - 1 + n) % n] : null, next = closed || i < n - 1 ? pts[(i + 1) % n] : null;
          const d1 = prev ? dir(prev, p) : dir(p, next), d2 = next ? dir(p, next) : d1;
          const n1 = [-d1[1], d1[0]], n2 = [-d2[1], d2[0]];
          let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
          const len = th / 2 / Math.max(0.35, mx * n1[0] + my * n1[1]);
          L.push([p[0] + mx * len, p[1] + my * len]); R.push([p[0] - mx * len, p[1] - my * len]);
        }
        for (let i = 0; i < (closed ? n : n - 1); i++) { const j = (i + 1) % n; K.solid([L[i], L[j], R[j], R[i]], t, m); }
      },
      // a straight wall between two points, any angle
      seg(x0, y0, x1, y1, th, t, m) { K.walls([[x0, y0], [x1, y1]], th, t, m); },
      // a curved wall: part of a circle round (cx, cy), from angle a0 to a1 in degrees (0 = east, 90 = south)
      arc(cx, cy, r, a0, a1, th = 0.9, t = T.HARD, m = MAT.CONCRETE) {
        const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * Math.PI / 180 * r / 0.9)), pts = [];
        for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
        K.walls(pts, th, t, m, Math.abs(a1 - a0) >= 359.9);
      },
      // fill a room's corner so it becomes round: (x, y) is the corner point, dir which way the room lies ('se' = room to the
      // east and south of the point), r the radius in cells
      round(x, y, r, dir, t = T.HARD, m = MAT.CONCRETE) {
        const sx = dir.includes('e') ? 1 : -1, sy = dir.includes('s') ? 1 : -1, cx = x + sx * r, cy = y + sy * r;
        const a0 = Math.atan2(0, -sx), a1 = Math.atan2(-sy, 0), n = Math.max(3, Math.ceil(r * 1.6));
        let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        for (let i = 0; i < n; i++) {
          const b0 = a0 + d * i / n, b1 = a0 + d * (i + 1) / n;
          K.solid([[x, y], [cx + Math.cos(b0) * r, cy + Math.sin(b0) * r], [cx + Math.cos(b1) * r, cy + Math.sin(b1) * r]], t, m);
        }
      },
      // cut a room's corner off at 45 degrees: n cells along each wall
      chamfer(x, y, n, dir, t = T.HARD, m = MAT.CONCRETE) {
        const sx = dir.includes('e') ? 1 : -1, sy = dir.includes('s') ? 1 : -1;
        K.solid([[x, y], [x + sx * n, y], [x, y + sy * n]], t, m);
      },
      // make every cell whose middle is inside a convex polygon outdoors again (ground floor: grass or fType; other
      // floors: open air), to cut a building's corner off before walls() puts the new angled wall along the cut
      outside(pts, fType = FL.GRASS) {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const pin = (x, y) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c !== 0) { if (s && Math.sign(c) !== s) return false; s = Math.sign(c); } } return true; };
        each(Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs)), Math.ceil(Math.max(...ys)), (k, x, y) => {
          if (!pin(x + 0.5, y + 0.5)) return;
          delete shape[k]; hp[k] = 0;
          if (f.ground) { tiles[k] = T.GROUND; floor[k] = fType; } else { tiles[k] = T.VOID; floor[k] = FL.VOID; }
        });
      },
      // painted details drawn by the browser (road lines, mats, stains): fn(ctx, cellToWorldX, cellToWorldY)
      decor(fn) { decor.push((ctx) => fn(ctx, x => (f.gx + x - f.x0) * CELL, y => (y - f.y0) * CELL)); },
    };
    return K;
  };
  const kits = fl.map(floorKit);

  // A staircase from floor a (bottom) up to floor b, occupying x..x+w-1, y..y+h-1 on both floors.
  // dir is the way you face while climbing ('n', 's', 'e', 'w').
  const stair = (a, b, x, y, w, h, dir, look = FL.CONCRETE) => {
    const A = kits[a], B = kits[b];
    const cells = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      for (const Kt of [A, B]) { const k = Kt.idx(x + i, y + j); tiles[k] = T.STAIR; floor[k] = look; hp[k] = 0; }
      cells.push([x + i, y + j]);
    }
    // the far (top) end on the lower floor leads up; the near (bottom) end on the upper floor leads down
    const top = ([cx, cy]) => dir === 'n' ? cy === y : dir === 's' ? cy === y + h - 1 : dir === 'w' ? cx === x : cx === x + w - 1;
    const bottom = ([cx, cy]) => dir === 'n' ? cy === y + h - 1 : dir === 's' ? cy === y : dir === 'w' ? cx === x + w - 1 : cx === x;
    for (const p of cells) {
      if (top(p)) portal[A.idx(p[0], p[1])] = B.idx(p[0], p[1]);     // arrive at the top end, upstairs
      if (bottom(p)) portal[B.idx(p[0], p[1])] = A.idx(p[0], p[1]);  // arrive at the bottom end, downstairs
    }
    stairs.push({ a, b, x, y, w, h, dir, ga: A.idx(x, y), gb: B.idx(x, y) });
  };

  // Fewer breakable walls (he asked: too many ways into a site by blowing the whole room open). Every straight wall
  // between two spaces (two rooms, or a room and outside) is one "wall". Each site room keeps one breakable wall
  // besides the one to its partner room (an inside one if it has one), so there are only a few ways to blow into a site;
  // elsewhere about one in five inside walls and one in ten outside walls stay breakable (he asked again: too much
  // shooting through walls). The rest become solid concrete.
  // Same choice every round (it hashes the map id). map.hardened marks the walls this turned solid.
  const hardened = new Uint8Array(N);
  const hardenWalls = (sites) => {
    const rid = new Int16Array(N).fill(-1);
    rooms.forEach((r, i) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) rid[y * W + x] = i; });
    const wallish = t => t === T.SOFT || t === T.HARD || t === T.REINF || t === T.BARRI || t === T.PANEL;
    const side = k => rid[k] >= 0 ? rid[k] : -2;
    const walls = new Map(), keyOf = new Map();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const k = y * W + x; if (tiles[k] !== T.SOFT || shape[k]) continue;
      for (const d of [W, 1]) {
        if (wallish(tiles[k + d]) || wallish(tiles[k - d])) continue;
        const a = side(k + d), b = side(k - d); if (a === b) continue;
        const key = `${Math.min(a, b)},${Math.max(a, b)},${d === 1 ? 'x' + x : 'y' + y}`; // one straight stretch between two spaces
        if (!walls.has(key)) walls.set(key, { a: Math.min(a, b), b: Math.max(a, b), cells: [] });
        walls.get(key).cells.push(k); keyOf.set(k, key); break;
      }
    }
    const hash = s => { let h = 2166136261; for (const c of id + s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
    const soft = new Set(), decided = new Set();
    const roomIdx = name => rooms.findIndex(r => r.name === name);
    for (const s of sites || []) {
      const [r1, r2] = (s.rooms || []).map(roomIdx);
      const pair = `${Math.min(r1, r2)},${Math.max(r1, r2)},`, pks = [...walls.keys()].filter(key => key.startsWith(pair));
      for (const pk of pks) { soft.add(pk); decided.add(pk); }
      for (const r of [r1, r2]) {
        if (r < 0) continue;
        const mine = [...walls.keys()].filter(key => !decided.has(key) && (walls.get(key).a === r || walls.get(key).b === r));
        // inside walls first (rotations and pushes), then outside ones; longer walls before short stubs
        mine.sort((p, q) => (walls.get(p).a < 0) - (walls.get(q).a < 0) || walls.get(q).cells.length - walls.get(p).cells.length || hash(p) - hash(q));
        const keep = mine.filter(key => walls.get(key).cells.length >= 3).slice(0, 1);
        for (const key of mine) { decided.add(key); if (keep.includes(key)) soft.add(key); }
      }
    }
    for (const [key, w] of walls) if (!decided.has(key) && hash(key) < (w.a < 0 ? 0.1 : 0.2)) soft.add(key); // he asked twice: fewer (too much wallbanging)
    const make = k => { tiles[k] = T.HARD; mat[k] = MAT.CONCRETE; hp[k] = 0; hardened[k] = 1; };
    for (const [key, w] of walls) if (!soft.has(key)) w.cells.forEach(make);
    // corners and joints between walls: solid unless they touch a wall that stayed breakable
    const rest = [];
    for (let k = 0; k < N; k++) if (tiles[k] === T.SOFT && !keyOf.has(k) && !shape[k]) rest.push(k);
    for (const k of rest) if (![1, -1, W, -W].some(d => tiles[k + d] === T.SOFT && keyOf.has(k + d))) make(k);
    // angled and curved walls (map.shape) aren't straight stretches: each joined run of them is one wall, kept breakable
    // round a site room, elsewhere like an inside wall (one in five). Its shape stays, only the material changes.
    const siteRid = new Set((sites || []).flatMap(s => (s.rooms || []).map(roomIdx)).filter(r => r >= 0));
    const seen = new Uint8Array(N);
    for (let k0 = 0; k0 < N; k0++) {
      if (seen[k0] || tiles[k0] !== T.SOFT || !shape[k0]) continue;
      const run = [k0]; seen[k0] = 1;
      for (let i = 0; i < run.length; i++) for (const d of [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1]) {
        const k = run[i] + d; if (k >= 0 && k < N && !seen[k] && tiles[k] === T.SOFT && shape[k]) { seen[k] = 1; run.push(k); }
      }
      const bySite = run.some(k => [1, -1, W, -W, W + 1, W - 1, -W + 1, -W - 1].some(d => siteRid.has(rid[k + d])));
      if (!bySite && hash('shape' + k0) >= 0.2) for (const k of run) { tiles[k] = T.HARD; mat[k] = MAT.CONCRETE; hp[k] = 0; hardened[k] = 1; }
    }
  };

  // Drone holes, like the small gaps at the foot of walls in R6: a drone (radius 5) fits, a body doesn't.
  // One per pair of rooms (or room and outside) that share a plain wall, near the middle of that wall,
  // only where there is clear floor on both sides for a drone to drive up to it.
  const droneHoles = () => {
    const rid = new Int16Array(N).fill(-1);
    rooms.forEach((r, i) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) rid[y * W + x] = i; });
    const at = (x, y) => x < 0 || y < 0 || x >= W || y >= H ? T.VOID : tiles[y * W + x];
    const clear = t => t === T.FLOOR || t === T.GROUND;
    const plain = k => tiles[k] === T.SOFT || hardened[k]; // a breakable wall, or one hardenWalls made solid
    const side = (x, y) => tiles[y * W + x] === T.GROUND ? -2 : rid[y * W + x];
    const pairs = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!plain(y * W + x) || shape[y * W + x] || shape[y * W + x + 1] || shape[y * W + x - 1] || shape[(y + 1) * W + x] || shape[(y - 1) * W + x]) continue;
      for (const [dx, dy] of [[0, 1], [1, 0]]) { // the hole runs along dx,dy through the wall
        if (![1, 2].every(d => clear(at(x + dx * d, y + dy * d)) && clear(at(x - dx * d, y - dy * d)))) continue;
        if (!plain((y + dx) * W + x + dy) || !plain((y - dx) * W + x - dy)) continue; // a straight run of wall, not a corner or door edge
        const a = side(x + dx, y + dy), b = side(x - dx, y - dy);
        if (a === b || a === -1 || b === -1) continue;
        const key = `${Math.min(a, b)},${Math.max(a, b)},${dx}`;
        (pairs.get(key) || pairs.set(key, []).get(key)).push(y * W + x);
      }
    }
    for (const c of pairs.values()) if (c.length >= 3) dhole[c[c.length >> 1]] = 1;
  };

  // Tidy the shaped cells: one that ended up covered all over becomes a plain wall; the rest note which of their
  // four sides are wall all along (for drawing edges), and show the floor of the side they are open to.
  const shapeSide = new Uint8Array(N), shapeFill = new Uint8Array(N); // shapeFill: how much of the cell is solid, out of 36
  const finishShapes = () => {
    const inside = (k, x, y) => shape[k].some(P => polyIn(P, x, y, 0.01));
    for (const key of Object.keys(shape)) {
      const k = +key, X = (k % W) * CELL, Y = Math.floor(k / W) * CELL;
      let all = true, ox = 0, oy = 0, solid = 36;
      for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
        const px = X + (i + 0.5) * CELL / 6, py = Y + (j + 0.5) * CELL / 6;
        if (!inside(k, px, py)) { all = false; ox += px - X - CELL / 2; oy += py - Y - CELL / 2; solid--; }
      }
      if (all) { delete shape[k]; continue; }
      let m = 0;
      for (let s = 0; s < 4; s++) { // sides: 0 top, 1 right, 2 bottom, 3 left
        let full = true;
        for (let i = 0; i <= 6; i++) {
          const u = 0.5 + i * (CELL - 1) / 6, e = 0.35;
          const [px, py] = s === 0 ? [X + u, Y + e] : s === 1 ? [X + CELL - e, Y + u] : s === 2 ? [X + u, Y + CELL - e] : [X + e, Y + u];
          if (!inside(k, px, py)) { full = false; break; }
        }
        if (full) m |= 1 << s;
      }
      shapeSide[k] = m; shapeFill[k] = solid;
      // the open part's floor comes from the neighbour on that side
      const a = Math.atan2(oy, ox), dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a));
      const nk = k + dy * W + dx, nt = tiles[nk];
      if (nt === T.FLOOR || nt === T.GROUND || nt === T.STAIR || nt === T.OPEN) floor[k] = floor[nk];
      else if (nt === T.VOID) floor[k] = FL.VOID;
    }
  };

  // Hatches, like R6's trapdoors: a 2x2 panel in the floor of an upper room with a room straight below it.
  // Up to MAX_HATCHES per floor, in the biggest rooms, as near the middle as fits: every cell round the
  // panel is clear floor on both floors (no furniture, door, stairs or wall), and not near a defuser spot.
  // map.hatches[i] = { id, fl, cells (upper grid cells), below (the same spots one floor down), x, y, bx, by (centres, world px) }.
  const hatches = [], hatchAt = new Int16Array(N).fill(-1), hatchBelow = new Int16Array(N).fill(-1);
  const MAX_HATCHES = 3;
  const placeHatches = (sites) => {
    const bombs = []; for (const s of sites || []) for (const b of s.bombs || []) bombs.push(b);
    const propAt = new Uint8Array(N);
    for (const p of props) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) propAt[y * W + x] = 1;
    for (const f of fl) {
      if (f.i === 0) continue;
      const b = fl[f.i - 1];
      const down = k => { // the same building-frame spot one floor down, or -1
        const lx = (k % W) - f.gx + f.x0 - b.x0, ly = Math.floor(k / W) + f.y0 - b.y0;
        return lx < 0 || ly < 0 || lx >= b.w || ly >= b.h ? -1 : ly * W + b.gx + lx;
      };
      const clear = k => k >= 0 && tiles[k] === T.FLOOR && !shape[k] && !propAt[k] && portal[k] < 0 && hatchAt[k] < 0 && hatchBelow[k] < 0;
      const list = rooms.filter(r => r.fl === f.i && r.w >= 5 && r.h >= 5).sort((p, q) => q.w * q.h - p.w * p.h);
      let n = 0;
      for (const r of list) {
        if (n >= MAX_HATCHES) break;
        const spots = [];
        for (let y = r.y + 1; y <= r.y + r.h - 3; y++) for (let x = r.x + 1; x <= r.x + r.w - 3; x++)
          spots.push([x, y, Math.hypot(x + 1 - (r.x + r.w / 2), y + 1 - (r.y + r.h / 2))]);
        spots.sort((p, q) => p[2] - q[2]);
        for (const [x, y] of spots) {
          let ok = true;
          for (let j = -1; j <= 2 && ok; j++) for (let i = -1; i <= 2 && ok; i++) { const k = (y + j) * W + x + i; if (!clear(k) || !clear(down(k))) ok = false; }
          const cx = (x + 1) * CELL, cy = (y + 1) * CELL;
          if (!ok || bombs.some(bb => Math.hypot(bb.x - cx, bb.y - cy) < CELL * 4)) continue;
          const id = hatches.length, cells = [y * W + x, y * W + x + 1, (y + 1) * W + x, (y + 1) * W + x + 1], below = cells.map(down);
          for (const k of cells) { tiles[k] = T.HATCH; hp[k] = CELL_HP[T.HATCH]; hatchAt[k] = id; }
          for (const k of below) hatchBelow[k] = id;
          const bk = below[0];
          hatches.push({ id, fl: f.i, cells, below, x: cx, y: cy, bx: (bk % W + 1) * CELL, by: (Math.floor(bk / W) + 1) * CELL });
          n++; break;
        }
      }
    }
  };

  const finish = (extra) => {
    finishShapes();
    // walls take the floor of the room next to them, so a hole shows the right floor
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, t = tiles[k];
      if (t === T.FLOOR || t === T.GROUND || t === T.LOW || t === T.TALL || t === T.VOID || t === T.STAIR || shape[k]) continue;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (tiles[ny * W + nx] === T.FLOOR) { floor[k] = floor[ny * W + nx]; break; }
      }
    }
    hardenWalls(extra && extra.sites);
    droneHoles();
    placeHatches(extra && extra.sites);
    return {
      id, name, W, H, tiles, floor, mat, hp, holes: {}, openId, dhole, props, openings, rooms, portal, flAt, stairs, decor, shape, shapeSide, shapeFill,
      hatches, hatchAt, hatchBelow, win, hardened,
      floors: fl.map(f => ({ name: f.name, i: f.i, gx: f.gx, w: f.w, h: f.h, x0: f.x0, y0: f.y0 })),
      ...extra,
    };
  };
  return { kits, stair, finish };
}

function areaOf(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
