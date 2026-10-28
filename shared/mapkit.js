// Map building kit. A map has 1–3 floors. All floors live side by side in ONE tile grid,
// separated by solid "void" cells, so sight, bullets, movement, path finding and drawing all work
// per floor without knowing floors exist. Stairs join floors: walking off the end of a staircase
// moves you to the same spot on the other floor (map.portal).
//
// Maps are written in one shared "building frame": cell (x, y) means the same spot on every floor,
// so a stairwell or a room stacked above another uses the same numbers on both floors.
import { T, FL, MAT, CELL, CELL_HP } from './constants.js';

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
  const openId = new Int16Array(N).fill(-1), portal = new Int32Array(N).fill(-1), flAt = new Uint8Array(N).fill(255);
  const props = [], openings = [], rooms = [], stairs = [], decor = [];
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
      slab(x0, y0, w, h, fType) { each(x0, y0, x0 + w - 1, y0 + h - 1, k => { tiles[k] = T.FLOOR; floor[k] = fType; }); },
      room(rname, x, y, w, h, fType) { rooms.push({ name: rname, fl: f.i, x: f.gx + x - f.x0, y: y - f.y0, w, h }); K.slab(x, y, w, h, fType); },
      wall(x0, y0, x1, y1, t = T.SOFT, m = MAT.DRYWALL) { each(x0, y0, x1, y1, k => { tiles[k] = t; mat[k] = m; hp[k] = CELL_HP[t] || 0; }); },
      // a rectangle of walls around (and including the edge of) x0..x1, y0..y1
      box(x0, y0, x1, y1, t = T.SOFT, m = MAT.DRYWALL) { K.wall(x0, y0, x1, y0, t, m); K.wall(x0, y1, x1, y1, t, m); K.wall(x0, y0, x0, y1, t, m); K.wall(x1, y0, x1, y1, t, m); },
      pillar(list) { for (const [x, y] of list) K.wall(x, y, x, y, T.HARD, MAT.CONCRETE); },
      open(x0, y0, x1, y1, kind, ext = false) {
        const cells = [];
        each(x0, y0, x1, y1, k => { tiles[k] = T.OPEN; hp[k] = 0; openId[k] = openings.length; cells.push(k); });
        openings.push({ id: openings.length, cells, kind, ext });
      },
      door: (x0, y0, x1, y1, ext) => K.open(x0, y0, x1, y1, 'door', ext),
      window: (x0, y0, x1, y1, ext = true) => K.open(x0, y0, x1, y1, 'window', ext),
      prop(kind, x, y, w, h, block, rot = 0) {
        const k0 = idx(x, y); if (k0 < 0) return;
        props.push({ kind, x: f.gx + x - f.x0, y: y - f.y0, w, h, rot });
        if (block !== null) each(x, y, x + w - 1, y + h - 1, k => { tiles[k] = block; });
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

  const finish = (extra) => {
    // walls take the floor of the room next to them, so a hole shows the right floor
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x, t = tiles[k];
      if (t === T.FLOOR || t === T.GROUND || t === T.LOW || t === T.TALL || t === T.VOID || t === T.STAIR) continue;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (tiles[ny * W + nx] === T.FLOOR) { floor[k] = floor[ny * W + nx]; break; }
      }
    }
    return {
      id, name, W, H, tiles, floor, mat, hp, openId, props, openings, rooms, portal, flAt, stairs, decor,
      floors: fl.map(f => ({ name: f.name, i: f.i, gx: f.gx, w: f.w, h: f.h, x0: f.x0, y0: f.y0 })),
      ...extra,
    };
  };
  return { kits, stair, finish };
}
