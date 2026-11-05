// All maps. Each map file builds its floors with the kit in mapkit.js.
import { CELL, T, FL } from './constants.js';
import { castSight, angDiff, los } from './physics.js';
import { build as harbor } from './maps/harbor.js';
import { build as villa } from './maps/villa.js';
import { build as depot } from './maps/depot.js';
import { build as embassy } from './maps/embassy.js';
import { build as lodge } from './maps/lodge.js';
import { build as school } from './maps/school.js';
import { build as dust } from './maps/dust.js';

export const MAPS = {
  harbor: { name: 'Harbor Office', floors: '1F · 2F', desc: 'Offices and a garage by the docks.', build: harbor },
  villa: { name: 'Cliffside Villa', floors: 'B · 1F · 2F', desc: 'A luxury house on a cliff, wine cellar and panic room below.', build: villa },
  depot: { name: 'Rail Depot', floors: '1F · 2F', desc: 'A train shed with catwalks above the tracks and an office wing.', build: depot },
  embassy: { name: 'The Embassy', floors: 'B · 1F · 2F', desc: 'A consulate round an open courtyard, with a vault and cells below.', build: embassy },
  lodge: { name: 'Alpine Lodge', floors: '1F · 2F', desc: 'A timber mountain lodge with a great hall, bar and guest suites.', build: lodge },
  school: { name: 'Clocktower School', floors: '1F · 2F · 3F', desc: 'An old school with a gym, labs upstairs and a clock tower on top.', build: school },
  dust: { name: 'Dust Town', floors: '1F · 2F', desc: 'A desert town laid out like a classic: a long road, a middle street and a tight tunnel to two sites.', build: dust },
};
export const MAP_LIST = Object.keys(MAPS);

const cache = new Map();
export function buildMap(id = 'harbor') {
  if (!MAPS[id]) id = 'harbor';
  const m = MAPS[id].build();
  addRopes(m);
  addRoofEdges(m);
  addOutCams(m);
  addYardCover(m);
  return m;
}

// ---- Rappelling (he asked: attackers need a quicker way up) ----
// Every outside window on a floor above the ground floor gets a rope: stand outside on the ground below it and press E
// to climb (2 s a floor), hang outside the window (the air cell just outside becomes a "drop" ledge: T.LOW over FL.VOID,
// which sight and bullets pass but nobody walks or vaults onto), Space climbs in once the window is open, E drops
// back down. While hanging you slide left / right along the wall, up to ROPE_SPAN cells past either side of the window
// (he asked: outside-the-window play matters). map.ropes[i] = { f, lvl, cells, hang (by the window's middle), base,
// inside, out, tx, ty (along the wall), a, b (how far you can slide each way, px), up, down }.
export const ROPE_CLIMB = 2, ROPE_DROP = 0.8, ROPE_REACH = 20, ROPE_SPAN = 5;
function addRopes(m) {
  const W = m.W, ropes = [];
  let gi = -1; for (let k = 0; k < m.tiles.length && gi < 0; k++) if (m.tiles[k] === T.GROUND) gi = m.flAt[k];
  m.ropes = ropes; if (gi < 0) return;
  const G = m.floors[gi], cc = k => ({ x: (k % W + 0.5) * CELL, y: (Math.floor(k / W) + 0.5) * CELL });
  const walk = (x, y, f) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); if (cx < 0 || cy < 0 || cx >= W || cy >= m.H) return false; const k = cy * W + cx, t = m.tiles[k]; return m.flAt[k] === f && (t === T.GROUND || t === T.FLOOR) && !m.shape[k]; };
  for (const o of m.openings) {
    if (o.kind !== 'window') continue;
    const f = m.flAt[o.cells[0]]; if (f <= gi || f === 255) continue;
    const mid = o.cells[o.cells.length >> 1];
    let out = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = mid + dy * W + dx; if (m.flAt[n] === f && m.tiles[n] === T.VOID) { out = [dx, dy]; break; } }
    if (!out) continue;
    const ledge = o.cells.map(k => k + out[1] * W + out[0]);
    if (ledge.some(k => m.flAt[k] !== f || m.tiles[k] !== T.VOID)) continue;
    const a = cc(o.cells[0]), b = cc(o.cells[o.cells.length - 1]), c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const hang = { x: c.x + out[0] * CELL, y: c.y + out[1] * CELL }, inside = { x: c.x - out[0] * CELL * 1.3, y: c.y - out[1] * CELL * 1.3 };
    if (!walk(inside.x, inside.y, f)) continue;
    const F = m.floors[f], bx0 = hang.x + (F.x0 - F.gx) * CELL - (G.x0 - G.gx) * CELL, by0 = hang.y + (F.y0 - G.y0) * CELL;
    let base = null;
    for (const n of [0, 0.5, 1, 1.5]) { const x = bx0 + out[0] * CELL * n, y = by0 + out[1] * CELL * n; if (walk(x, y, gi)) { base = { x, y }; break; } }
    if (!base) continue;
    // the stretch of outside wall either side of the window you can slide along: air outside, wall (or window) inside
    const tx = Math.abs(out[1]), ty = Math.abs(out[0]), step = ty * W + tx, half = o.cells.length * CELL / 2;
    const okLedge = k => m.flAt[k] === f && (m.tiles[k] === T.VOID || (m.tiles[k] === T.LOW && m.floor[k] === FL.VOID));
    const okWall = k => { const t = m.tiles[k]; return (t === T.HARD || t === T.SOFT || t === T.REINF || t === T.BARRI || (t === T.OPEN && m.win[k])) && !m.shape[k]; };
    const lo = Math.min(...ledge), hi = Math.max(...ledge), ext = [];
    let nA = 0, nB = 0;
    for (let n = 1; n <= ROPE_SPAN; n++) { const k = lo - step * n; if (!okLedge(k) || !okWall(k - out[1] * W - out[0])) break; ext.push(k); nA = n; }
    for (let n = 1; n <= ROPE_SPAN; n++) { const k = hi + step * n; if (!okLedge(k) || !okWall(k - out[1] * W - out[0])) break; ext.push(k); nB = n; }
    for (const k of [...ledge, ...ext]) { m.tiles[k] = T.LOW; m.floor[k] = FL.VOID; }
    const sa = -(half - CELL / 2) - nA * CELL, sb = (half - CELL / 2) + nB * CELL;
    ropes.push({ i: ropes.length, f, lvl: f - gi, cells: o.cells, ledge: [...ledge, ...ext], hang, base, inside, out: Math.atan2(out[1], out[0]), tx, ty, a: sa, b: sb, half, up: -1, down: -1 });
  }
  // Each window is a stop (he asked): from one you go up or down to the next window on the same wall, or from the top one onto
  // the roof. pos = where along the wall (ax) and which wall line (ay), the same numbers on every floor.
  const pos = r => { const F = m.floors[r.f], x = r.hang.x / CELL - F.gx + F.x0, y = r.hang.y / CELL + F.y0; return { ax: x * r.tx + y * r.ty, ay: x * r.ty + y * r.tx }; };
  for (const r of ropes) Object.assign(r, pos(r));
  const lineUp = (r, q) => q.out === r.out && Math.abs(q.ay - r.ay) < 0.75 && r.ax * CELL + r.b >= q.ax * CELL + q.a && q.ax * CELL + q.b >= r.ax * CELL + r.a;
  for (const r of ropes) {
    const near = list => list.sort((p, q) => Math.abs(p.lvl - r.lvl) - Math.abs(q.lvl - r.lvl) || Math.abs(p.ax - r.ax) - Math.abs(q.ax - r.ax))[0];
    const u = near(ropes.filter(q => q.lvl > r.lvl && lineUp(r, q))), d = near(ropes.filter(q => q.lvl < r.lvl && lineUp(r, q)));
    if (u) r.up = u.i; if (d) r.down = d.i;
    if (u || m.roofFloor === undefined) continue;
    const R = m.floors[m.roofFloor], F = m.floors[r.f], o = [Math.cos(r.out), Math.sin(r.out)]; // over the edge of the roof, a little way in
    for (const n of [2, 3, 4]) { const x = r.hang.x + ((R.gx - R.x0) - (F.gx - F.x0)) * CELL - o[0] * CELL * n, y = r.hang.y + (F.y0 - R.y0) * CELL - o[1] * CELL * n; if (walk(x, y, m.roofFloor)) { r.roof = { x, y }; break; } }
  }
  m.groundFloor = gi;
}
// The rope you can start climbing from (x, y) on the ground floor, anywhere below its stretch of wall: [rope, s] or null
// (s: how far along the wall from the window's middle, px).
export function ropeAt(m, x, y) {
  let best = null, bd = ROPE_REACH;
  for (const r of m.ropes || []) {
    if (r.down >= 0) continue;
    const s = Math.max(r.a, Math.min(r.b, (x - r.base.x) * r.tx + (y - r.base.y) * r.ty)), d = Math.hypot(r.base.x + r.tx * s - x, r.base.y + r.ty * s - y);
    if (d < bd) { bd = d; best = [r, s]; }
  }
  return best;
}
// A rope you can go back down from the roof (x, y): the nearest place one comes over the edge, within reach.
export function roofRopeAt(m, x, y) {
  if (m.flAt && floorAt(m, x, y) !== m.roofFloor) return null;
  let best = null, bd = ROPE_REACH * 1.6;
  for (const r of m.ropes || []) if (r.roof) { const d = Math.hypot(r.roof.x - x, r.roof.y - y); if (d < bd) { bd = d; best = r; } }
  return best;
}
// Where you land on the ground when you let go (or are shot off) at s along the wall: below you if there is ground there
export function ropeGround(m, r, s) {
  const x = r.base.x + r.tx * s, y = r.base.y + r.ty * s, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), k = cy * m.W + cx;
  return cx >= 0 && cy >= 0 && cx < m.W && cy < m.H && (m.tiles[k] === T.GROUND || m.tiles[k] === T.FLOOR) && !m.shape[k] ? { x, y } : r.base;
}
// How far along the wall (px from the window's middle) someone at (x, y) hangs, and are they in front of the window?
export const ropeS = (r, x, y) => (x - r.hang.x) * r.tx + (y - r.hang.y) * r.ty;
export const ropeAtWindow = (r, x, y) => Math.abs(ropeS(r, x, y)) <= r.half - 4;
// Is this rope's window open enough to climb in (not boarded, reinforced or blocked)?
export function ropeWindowOpen(m, r) { return r.cells.every(k => m.tiles[k] === T.OPEN || m.tiles[k] === T.FLOOR || m.tiles[k] === T.RUBBLE); }
// ...or only wooden boards in the way: a swing in smashes through them (he chose, like Rainbow Six); reinforced stops you
export function ropeWindowBoarded(m, r) { return r.cells.some(k => m.tiles[k] === T.BARRI) && r.cells.every(k => m.tiles[k] === T.BARRI || m.tiles[k] === T.OPEN || m.tiles[k] === T.FLOOR || m.tiles[k] === T.RUBBLE); }

// ---- Looking over the roof's edge, and outside cameras (he asked) ----
// The roof's edge is cut into short straight stretches (up to EDGE_LEN cells) that work like open upper windows:
// within ROOF_REACH of one you see the ground below that side (windowViews), and people down there can see and shoot
// you (wallGhost). m.roofEdges[i] = { i, edge: 1, f (the roof), cells, hang (the air cell outside its middle), out,
// tx, ty, half }; m.roofEdgeAt: roof cell -> its edges.
export const ROOF_REACH = 2.6 * CELL, EDGE_LEN = 4;
function addRoofEdges(m) {
  const W = m.W, rf = m.roofFloor, edges = []; m.roofEdges = edges; m.roofEdgeAt = new Map();
  if (rf === undefined || m.groundFloor === undefined) return;
  const top = k => m.flAt[k] === rf && (m.tiles[k] === T.FLOOR || m.tiles[k] === T.GROUND) && !m.shape[k];
  const air = k => m.flAt[k] === rf && m.tiles[k] === T.VOID;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const step = dx ? W : 1, on = new Set(); // along the edge
    for (let k = 0; k < m.tiles.length; k++) if (top(k) && air(k + dy * W + dx)) on.add(k);
    for (const k of on) {
      if (on.has(k - step)) continue; // start of a straight run
      const run = []; for (let q = k; on.has(q); q += step) run.push(q);
      for (let i = 0; i < run.length; i += EDGE_LEN) {
        const cells = run.slice(i, i + EDGE_LEN);
        if (cells.length < 2 && i) { edges[edges.length - 1].cells.push(...cells); continue; } // a lone cell joins the stretch before it
        edges.push({ i: edges.length, edge: 1, f: rf, cells, out: Math.atan2(dy, dx), tx: dx ? 0 : 1, ty: dx ? 1 : 0, dx, dy });
      }
    }
  }
  for (const e of edges) {
    const a = e.cells[0], b = e.cells[e.cells.length - 1];
    e.half = e.cells.length * CELL / 2;
    e.hang = { x: ((a % W + b % W) / 2 + 0.5 + e.dx) * CELL, y: ((Math.floor(a / W) + Math.floor(b / W)) / 2 + 0.5 + e.dy) * CELL };
    for (const k of e.cells) (m.roofEdgeAt.get(k) || m.roofEdgeAt.set(k, []).get(k)).push(e.i); // (a corner cell is on two)
  }
}
// OUTCAM_N cameras on the outside of the building just under the roof's edge (the top floor: 2F or 3F), spread round
// it: defenders see the yard below that side, anyone climbing the ropes there and the strip of roof above. Attackers
// can shoot one from the roof (it hangs in the air cell just past the edge, made a "drop" ledge so sight and bullets
// reach it) or from the ground (it shows on the wall above gx/gy). m.outCams[i] = { x, y (on the roof grid), gx, gy
// (the ground under it), n (straight out), e (its edge) }. Same spots every round.
export const OUTCAM_N = 4, OUTCAM_TURN = 1.2, OUTCAM_ROOF = 3 * 36, OUTCAM_RANGE = 650;
function yardAhead(m, e) { // how much open ground a camera over edge e looks out on (of 15 spots 3-11 m out)
  const ft = windowFoot(m, e), gi = m.groundFloor; let n = 0;
  for (const d of [3, 5, 7, 9, 11]) for (const a of [-0.5, 0, 0.5]) {
    const x = ft.x + Math.cos(e.out + a) * d * 36, y = ft.y + Math.sin(e.out + a) * d * 36, cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), k = cy * m.W + cx;
    if (cx >= 0 && cy >= 0 && cx < m.W && cy < m.H && m.flAt[k] === gi && m.tiles[k] === T.GROUND && los(m, ft.x, ft.y, x, y)) n++;
  }
  return n;
}
function addOutCams(m) {
  const W = m.W, out = []; m.outCams = out;
  const cand = (m.roofEdges || []).filter(e => e.cells.length >= 2 && windowFoot(m, e)).map(e => {
    const mid = e.cells[e.cells.length >> 1], k = mid + e.dy * W + e.dx;
    return { e, k, x: (mid % W + 0.5) * CELL + e.dx * (CELL / 2 + 3), y: (Math.floor(mid / W) + 0.5) * CELL + e.dy * (CELL / 2 + 3) };
  }).filter(c => m.tiles[c.k] === T.VOID && yardAhead(m, c.e) >= 6); // only where there is yard to watch (not a cliff or the next wall)
  if (!cand.length) return;
  const cx = cand.reduce((a, c) => a + c.x, 0) / cand.length, cy = cand.reduce((a, c) => a + c.y, 0) / cand.length;
  const pick = [cand.reduce((a, c) => Math.hypot(c.x - cx, c.y - cy) > Math.hypot(a.x - cx, a.y - cy) ? c : a)];
  while (pick.length < Math.min(OUTCAM_N, cand.length)) { // then each time the spot furthest from those already chosen
    let best = null, bd = -1;
    for (const c of cand) { if (pick.includes(c)) continue; const d = Math.min(...pick.map(p => Math.hypot(p.x - c.x, p.y - c.y))); if (d > bd) { bd = d; best = c; } }
    pick.push(best);
  }
  for (const c of pick) {
    m.tiles[c.k] = T.LOW; m.floor[c.k] = FL.VOID;
    const ft = windowFoot(m, c.e);
    out.push({ i: out.length, x: c.x, y: c.y, gx: ft.x, gy: ft.y, n: c.e.out, e: c.e.i, k: c.k });
  }
}

// ---- Yard cover (he asked: an interesting outdoors with safer and riskier ways in, now that upper windows see the
// ground) ----
// Every way in from the ground (an outside door or window, or the ground under a rope) has an approach: the open
// ground within APPROACH cells of it. Its exposure is the share of that ground an upper window could see once its
// boards are off. About half the ways in end up safe (exposure under SAFE): the ones that already are, then the
// cheapest to fix get containers / dumpsters (tall: they block sight and bullets) between them and the windows that
// watch them; the rest stay exposed on purpose. Same pieces every round (no randomness). m.yard = the report.
const APPROACH = 9, SAFE = 0.3;
function addYardCover(m) {
  const W = m.W, gi = m.groundFloor; if (gi === undefined) return;
  const G = m.floors[gi], at = k => ({ x: (k % W + 0.5) * CELL, y: (Math.floor(k / W) + 0.5) * CELL });
  const ground = k => k >= 0 && k < m.tiles.length && m.flAt[k] === gi && m.tiles[k] === T.GROUND && !m.shape[k];
  // the views down from each upper window, from a spot just inside it, with its boards off
  const views = [];
  for (const r of m.ropes) {
    const ft = windowFoot(m, r); if (!ft) continue;
    const save = r.cells.map(k => m.tiles[k]); r.cells.forEach(k => { m.tiles[k] = T.OPEN; });
    const vs = windowViews(m, ft.cx - Math.cos(r.out) * CELL * 1.6, ft.cy - Math.sin(r.out) * CELL * 1.6);
    r.cells.forEach((k, i) => { m.tiles[k] = save[i]; });
    if (vs.length) views.push({ v: vs[0], r });
  }
  // ways in from the ground: outside cells next to ground-floor doors and windows, and rope bases
  const ways = [];
  for (const o of m.openings) {
    if (m.flAt[o.cells[0]] !== gi) continue;
    const out = []; for (const c of o.cells) for (const d of [1, -1, W, -W]) if (ground(c + d) && !o.cells.includes(c + d)) out.push(c + d);
    if (out.length) ways.push({ kind: o.kind, k: out[out.length >> 1] });
  }
  for (const r of m.ropes) if (r.down < 0) { const k = Math.floor(r.base.y / CELL) * W + Math.floor(r.base.x / CELL); if (ground(k)) ways.push({ kind: 'rope', k }); }
  if (!ways.length || !views.length) { m.yard = { ways: [] }; return; }
  const strip = k0 => { const x0 = k0 % W, y0 = Math.floor(k0 / W), out = []; for (let y = y0 - APPROACH; y <= y0 + APPROACH; y++) for (let x = x0 - APPROACH; x <= x0 + APPROACH; x++) { const k = y * W + x; if ((x - x0) ** 2 + (y - y0) ** 2 <= APPROACH * APPROACH && ground(k)) out.push(k); } return out; };
  const watchers = k => { const p = at(k), w = []; for (const V of views) if (windowSees(m, V.v, p.x, p.y)) w.push(V); return w; };
  const exposure = way => { let n = 0; for (const k of way.cells) if (watchers(k).length) n++; return way.cells.length ? n / way.cells.length : 0; };
  for (const w of ways) { w.cells = strip(w.k); w.exp = exposure(w); w.exp0 = w.exp; }
  // where a piece may stand: open ground with two clear cells all round, away from ways in, spawns and the building
  const keepAway = [...ways.map(w => w.k), ...(m.atkSpawns || []).map(s => Math.floor(s.y / CELL) * W + Math.floor(s.x / CELL))];
  const fits = (x0, y0, w, h) => {
    for (let y = y0 - 2; y < y0 + h + 2; y++) for (let x = x0 - 2; x < x0 + w + 2; x++) if (!ground(y * W + x)) return false;
    for (const k of keepAway) { const kx = k % W, ky = Math.floor(k / W); if (kx > x0 - 3 && kx < x0 + w + 2 && ky > y0 - 3 && ky < y0 + h + 2) return false; }
    return true;
  };
  const place = (x0, y0, w, h, on) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) m.tiles[y * W + x] = on ? T.TALL : T.GROUND; };
  const safeGoal = Math.ceil(ways.length / 2);
  let safe = ways.filter(w => w.exp < SAFE).length, pieces = 0;
  for (const way of ways.filter(w => w.exp >= SAFE).sort((a, b) => a.exp - b.exp)) {
    if (safe >= safeGoal) break;
    for (let tries = 0; tries < 3 && way.exp >= SAFE; tries++) {
      // try a piece on every other watched cell of the approach, both ways round; keep the one that hides most of it
      const seenBy = new Set(), watched = [];
      for (const k of way.cells) { const ws = watchers(k); if (ws.length) { watched.push(k); ws.forEach(V => seenBy.add(V)); } }
      const VS = [...seenBy], left = () => { let n = 0; for (const k of watched) { const p = at(k); if (VS.some(V => windowSees(m, V.v, p.x, p.y))) n++; } return n; };
      let best = null;
      for (let i = 0; i < watched.length; i += 2) for (const len of [6, 4]) for (const across of [false, true]) {
        const k = watched[i], w = across ? 2 : len, h = across ? len : 2, x0 = k % W - (w >> 1), y0 = Math.floor(k / W) - (h >> 1);
        if (!fits(x0, y0, w, h)) continue;
        place(x0, y0, w, h, true); const e = left() / way.cells.length; place(x0, y0, w, h, false);
        if (e < way.exp - 0.04 && (!best || e < best.e - 0.01 || (e < best.e + 0.01 && len < best.len))) best = { e, x0, y0, w, h, len };
      }
      if (!best) break;
      place(best.x0, best.y0, best.w, best.h, true); pieces++;
      m.props.push({ kind: best.len >= 6 ? 'container' : 'dumpster', x: best.x0, y: best.y0, w: best.w, h: best.h, rot: best.w > best.h ? 1 : 0, yard: 1 });
      way.exp = best.e;
    }
    if (way.exp < SAFE) safe++;
  }
  m.yard = { pieces, safeGoal, ways: ways.map(w => ({ kind: w.kind, k: w.k, before: +w.exp0.toFixed(2), after: +w.exp.toFixed(2) })) };
}

// Which floor a world position is on (index into map.floors), or -1.
export function floorAt(map, wx, wy) {
  const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
  if (cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) return -1;
  const f = map.flAt[cy * map.W + cx]; return f === undefined || f === 255 ? -1 : f; // undefined: a position that is not a number
}
// The same spot in the shared building frame (for sound between floors, distances, markers).
export function localPos(map, wx, wy) {
  const f = floorAt(map, wx, wy); if (f < 0) return { x: wx, y: wy, f: 0 };
  const F = map.floors[f];
  return { x: wx + (F.x0 - F.gx) * CELL, y: wy + F.y0 * CELL, f };
}

export function roomAt(map, wx, wy) {
  const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
  for (const r of map.rooms) if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) return r.name;
  const k = cy * map.W + cx;
  if (map.tiles[k] === T.GROUND) return 'Outside';
  if (map.tiles[k] === T.STAIR) return 'Stairs';
  return '';
}

// Where a map camera really hangs: the nearest bit of wall (a corner if one is close) to the spot the map
// file gives, in the same room, so cameras sit up against walls like part of the building instead of on the
// floor. Returns the mount point, the direction straight out of the wall (n), how far either side of that the
// camera can turn (sp), and the wall cells it hangs on (if one is knocked down, the camera falls with it).
const MOUNT_WALL = new Set([T.HARD, T.SOFT, T.REINF]);
export function wallMount(map, x, y) {
  const W = map.W, ox = Math.floor(x / CELL), oy = Math.floor(y / CELL), room = roomAt(map, x, y), fl = floorAt(map, x, y);
  const wall = (cx, cy) => { if (cx < 0 || cy < 0 || cx >= W || cy >= map.H) return false; const k = cy * W + cx; return MOUNT_WALL.has(map.tiles[k]) && map.openId[k] < 0 && !map.dhole[k] && !(map.shape && map.shape[k]); };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let best = null;
  for (let cy = oy - 12; cy <= oy + 12; cy++) for (let cx = ox - 12; cx <= ox + 12; cx++) {
    if (cx < 0 || cy < 0 || cx >= W || cy >= map.H) continue;
    const t = map.tiles[cy * W + cx];
    if ((t !== T.FLOOR && t !== T.GROUND) || map.flAt[cy * W + cx] !== fl) continue;
    const ws = DIRS.filter(([dx, dy]) => wall(cx + dx, cy + dy));
    if (!ws.length) continue;
    let cand = null;
    for (let i = 0; i < ws.length && !cand; i++) for (let j = i + 1; j < ws.length; j++) if (ws[i][0] !== ws[j][0] && ws[i][1] !== ws[j][1]) { cand = { d: [ws[i], ws[j]], corner: true }; break; }
    if (!cand) { // a flat stretch of wall, not the edge of a door
      const f = ws.find(([dx, dy]) => wall(cx + dx + dy, cy + dy + dx) && wall(cx + dx - dy, cy + dy - dx));
      if (f) cand = { d: [f], corner: false };
    }
    if (!cand) continue;
    let nx = 0, ny = 0; for (const [dx, dy] of cand.d) { nx -= dx; ny -= dy; }
    if (castSight(map, (cx + 0.5) * CELL, (cy + 0.5) * CELL, Math.atan2(ny, nx), CELL * 3, null) < CELL * 2.5) continue; // not tucked behind a bookcase
    const score = Math.hypot(cx - ox, cy - oy) - (cand.corner ? 1.5 : 0) + (roomAt(map, (cx + 0.5) * CELL, (cy + 0.5) * CELL) === room ? 0 : 8);
    if (!best || score < best.score) best = { score, cx, cy, ...cand };
  }
  if (!best) return { x, y, n: null, sp: Math.PI, wall: [] };
  const inset = CELL / 2 - 3; let mx = (best.cx + 0.5) * CELL, my = (best.cy + 0.5) * CELL, nx = 0, ny = 0;
  for (const [dx, dy] of best.d) { mx += dx * inset; my += dy * inset; nx -= dx; ny -= dy; }
  return { x: mx, y: my, n: Math.atan2(ny, nx), sp: best.corner ? 0.85 : 1.45, wall: best.d.map(([dx, dy]) => (best.cy + dy) * W + best.cx + dx) };
}

// ---- hatches (see placeHatches in mapkit.js) ----
// Open hatch `id`: its cells become holes that drop you to the same spot one floor down. Returns the cells changed.
export function openHatch(map, id) {
  const h = map.hatches[id]; if (!h) return [];
  h.cells.forEach((k, i) => { map.tiles[k] = T.HOLE; map.hp[k] = 0; map.portal[k] = h.below[i]; });
  return h.cells;
}
// After a cell update arrives from the server: keep the drop-through link of an opened hatch.
export function holePortal(map, k) {
  const id = map.hatchAt ? map.hatchAt[k] : -1;
  if (id >= 0 && map.tiles[k] === T.HOLE) map.portal[k] = map.hatches[id].below[map.hatches[id].cells.indexOf(k)];
}
// The hatch under or just in front of someone standing at (x, y) facing aim (within reach px), or null.
export function hatchNear(map, x, y, aim, reach = 18) {
  if (!map.hatchAt) return null;
  for (let d = 0; d <= reach; d += 3) {
    const cx = Math.floor((x + Math.cos(aim) * d) / CELL), cy = Math.floor((y + Math.sin(aim) * d) / CELL);
    if (cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) continue;
    const id = map.hatchAt[cy * map.W + cx];
    if (id >= 0) return map.hatches[id];
  }
  return null;
}
// Which hatch (and which side of it) a point is over: { h, up: true } on the upper floor, up: false underneath it.
export function hatchAtPoint(map, x, y) {
  if (!map.hatchAt) return null;
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  if (cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) return null;
  const k = cy * map.W + cx;
  if (map.hatchAt[k] >= 0) return { h: map.hatches[map.hatchAt[k]], up: true };
  if (map.hatchBelow[k] >= 0) return { h: map.hatches[map.hatchBelow[k]], up: false };
  return null;
}

// ---- Looking through an open hatch (he asked: like the stairs, a limited view, and you only shoot down where you
// could really see; lying down shows more of the room sideways, like a 3D game) ----
// Floor to floor HATCH_H m. A straight line from your eye through the opening reaches the other floor's people (at
// BODY_Z m off their floor) only in one patch: the opening grown about the spot under your eye by 1 / f, with f how far
// along that line the opening is. Standing at the edge you see down to ~2 m past it; lying at the edge, a long thin
// strip 1-10 m out; a step back and you see nothing (the floor is in the way). From below it works the same upward.
// The view: { x, y (the middle of the opening on the other floor: walls there block from that point), range, ang: 0,
// fov: 2pi, near: 0, kind: 'hatch', mask: { ex, ey, f, x0, y0, x1, y1 } (other floor coords), h, up, o (offset to the
// other floor) }. maskSees(mask, x, y) tests the patch.
export const HATCH_H = 3.2, EYE_H = { stand: 1.6, crouch: 1.05, prone: 0.3 }, BODY_Z = 1.0, HATCH_LOOK = 7 * CELL;
// From below (he asked: you shouldn't see too much up through a hatch) the patch is also cut to HATCH_UP_SEE past the
// opening's edge (mask.lim, other floor coords), so only a small ring round the hole shows, from wherever you stand.
export const HATCH_UP_SEE = 36;
const outLim = (k, x, y) => k.lim && (x < k.lim.x0 || x > k.lim.x1 || y < k.lim.y0 || y > k.lim.y1);
export const maskSees = (k, x, y) => { const X = k.ex + k.f * (x - k.ex), Y = k.ey + k.f * (y - k.ey); if (outLim(k, x, y)) return false; return X >= k.x0 && X <= k.x1 && Y >= k.y0 && Y <= k.y1; };
export function hatchSight(m, h, x, y, stance = 'stand') {
  if (!m.tiles || m.tiles[h.cells[0]] !== T.HOLE) return null;
  const f0 = floorAt(m, x, y), up = f0 === h.fl, fb = floorAt(m, h.bx, h.by); // up: you are above it, looking down
  if (!up && f0 !== fb) return null;
  const cx = up ? h.x : h.bx, cy = up ? h.y : h.by, d = Math.hypot(cx - x, cy - y);
  if (d > HATCH_LOOK || d < 1) return null;
  if (castSight(m, x, y, Math.atan2(cy - y, cx - x), d, null) < d - CELL * 1.2) return null; // something in the way of the opening itself
  const e = EYE_H[stance] || EYE_H.stand, f = up ? e / (HATCH_H + e - BODY_Z) : (HATCH_H - e) / (HATCH_H + BODY_Z - e);
  const o = up ? { x: h.bx - h.x, y: h.by - h.y } : { x: h.x - h.bx, y: h.y - h.by }, ox = up ? h.bx : h.x, oy = up ? h.by : h.y;
  const mask = { ex: x + o.x, ey: y + o.y, f, x0: ox - CELL, y0: oy - CELL, x1: ox + CELL, y1: oy + CELL };
  if (!up) { const r = CELL + HATCH_UP_SEE; mask.lim = { x0: ox - r, y0: oy - r, x1: ox + r, y1: oy + r }; }
  let far = 0; for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) far = Math.max(far, Math.hypot(ox + sx * CELL - mask.ex, oy + sy * CELL - mask.ey));
  return { x: ox, y: oy, ang: 0, fov: Math.PI * 2, range: up ? Math.min(16 * 36, far / f + 4) : (CELL + HATCH_UP_SEE) * 1.42, near: 0, kind: 'hatch', mask, h, up, o };
}
// Aiming up through a hatch (he asked: others should see it, a raised-gun pose): on the floor under a hatch, within
// HATCH_LOOK of it, with the crosshair point on its opening (an open hole: anywhere in the small patch it shows). The hatch or null.
export function aimUpHatch(m, x, y, ax, ay) {
  if (ax === undefined || ax === null || !m.hatches) return null;
  const f0 = floorAt(m, x, y);
  for (const h of m.hatches) {
    if (floorAt(m, h.bx, h.by) !== f0 || Math.hypot(h.bx - x, h.by - y) > HATCH_LOOK) continue;
    const r = CELL + (m.tiles[h.cells[0]] === T.HOLE ? HATCH_UP_SEE : 4);
    if (Math.abs(ax - h.bx) <= r && Math.abs(ay - h.by) <= r) return h;
  }
  return null;
}

// ---- Stairwells (he asked: fights between the top and the bottom of a staircase should work) ----
// A staircase is drawn on both floors at the same spot. Anyone on its steps, or on the landing at its open end
// (STAIR_LAND cells: the bottom landing downstairs, the top landing upstairs), also shows up on the steps of the other
// floor (clamped to the steps), where people near that staircase can see and shoot them. Both ways, so it's fair.
const STAIR_LAND = 2, STAIR_LOOK = 6;
const UV = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
function stairGeo(map, s) {
  if (s._g) return s._g;
  const W = map.W, ax = (s.ga % W) * CELL, ay = Math.floor(s.ga / W) * CELL, bx = (s.gb % W) * CELL, by = Math.floor(s.gb / W) * CELL;
  const [ux, uy] = UV[s.dir] || UV.n, w = s.w * CELL, h = s.h * CELL;
  // a rectangle stretched by n cells past one end (sign -1: the bottom end, +1: the top end) and pad cells to the sides
  const grow = (x, y, n, sign, pad = 0) => {
    let x0 = x - (ux ? 0 : pad * CELL), y0 = y - (uy ? 0 : pad * CELL), x1 = x + w + (ux ? 0 : pad * CELL), y1 = y + h + (uy ? 0 : pad * CELL);
    const ex = ux * sign * n * CELL, ey = uy * sign * n * CELL;
    if (ex < 0) x0 += ex; else x1 += ex; if (ey < 0) y0 += ey; else y1 += ey;
    return { x0, y0, x1, y1 };
  };
  s._g = {
    a: { fl: s.a, steps: { x0: ax, y0: ay, x1: ax + w, y1: ay + h }, zone: grow(ax, ay, STAIR_LAND, -1), look: grow(ax, ay, STAIR_LOOK, -1, 1) },
    b: { fl: s.b, steps: { x0: bx, y0: by, x1: bx + w, y1: by + h }, zone: grow(bx, by, STAIR_LAND, 1), look: grow(bx, by, STAIR_LOOK, 1, 1) },
    dx: bx - ax, dy: by - ay,
  };
  return s._g;
}
const inR = (r, x, y) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
const clampR = (r, x, y, m = 5) => ({ x: Math.max(r.x0 + m, Math.min(r.x1 - m, x)), y: Math.max(r.y0 + m, Math.min(r.y1 - m, y)) });
// Where someone at (x, y) also shows on the other floor, or null: { x, y, s (staircase), fl (floor it shows on), below }
// below = true when the real person is downstairs (the copy is on the upper floor).
export function stairGhost(map, x, y) {
  const S = map.stairs || [];
  for (let i = 0; i < S.length; i++) {
    const g = stairGeo(map, S[i]), [ux, uy] = UV[S[i].dir] || UV.n;
    if (inR(g.a.zone, x, y)) return { ...onStep(map, clampR(g.b.steps, x + g.dx, y + g.dy), ux, uy), s: i, fl: g.b.fl, below: true };
    if (inR(g.b.zone, x, y)) return { ...onStep(map, clampR(g.a.steps, x - g.dx, y - g.dy), -ux, -uy), s: i, fl: g.a.fl, below: false };
  }
  return null;
}
// a few stairs run off the edge of a floor (outside steps up to a balcony): slide the copy along the stairs
// (towards that floor's landing) until it stands on a real step
function onStep(map, p, ux, uy) {
  for (let n = 0; n < 16; n++) {
    const cx = Math.floor(p.x / CELL), cy = Math.floor(p.y / CELL);
    if (cx >= 0 && cy >= 0 && cx < map.W && cy < map.H && map.tiles[cy * map.W + cx] === T.STAIR) return p;
    p = { x: p.x + ux * CELL / 2, y: p.y + uy * CELL / 2 };
  }
  return p;
}
// Can someone at (x, y) see copies on staircase i? Only from on or near it, at the end you look up/down it from.
export function stairLooks(map, i, x, y) {
  const s = map.stairs && map.stairs[i]; if (!s) return false;
  const g = stairGeo(map, s);
  return inR(g.a.look, x, y) || inR(g.b.look, x, y);
}
// The middle of each landing, n cells out from the stairs: bottom (downstairs) and top (upstairs). For tests and bots.
export function stairEnds(map, i, n = 1.5) {
  const s = map.stairs[i], g = stairGeo(map, s), [ux, uy] = UV[s.dir] || UV.n;
  const ca = { x: (g.a.steps.x0 + g.a.steps.x1) / 2, y: (g.a.steps.y0 + g.a.steps.y1) / 2 }, cb = { x: (g.b.steps.x0 + g.b.steps.x1) / 2, y: (g.b.steps.y0 + g.b.steps.y1) / 2 };
  const len = (ux ? s.w : s.h) * CELL / 2; // half the stairs' length along the way up
  return { bottom: { x: ca.x - ux * (len + n * CELL), y: ca.y - uy * (len + n * CELL) }, top: { x: cb.x + ux * (len + n * CELL), y: cb.y + uy * (len + n * CELL) }, up: Math.atan2(uy, ux) };
}

// ---- Looking out of upper windows (he asked: from a window, even on the top floor, you see the ground below and
// anyone climbing the wall; both ways, so a window peeker can be seen and shot from below) ----
// Floors sit side by side in the map grid, lined up in the building frame, so "below" is the ground floor at the same
// building-frame spot. Someone up to WIN_REACH inside an outside window looks out through it: the view is a cone on the
// ground floor from just outside the wall under the window, as wide as the opening seen from where they stand (closer
// = wider), WIN_RANGE long. As limited as the boards: nothing through an intact board, a narrow slit through each
// bullet hole in it, the whole opening once it is broken. Through a hole the peeker is hard to make out from below
// (small hole, dark room): only within WIN_HOLE_SEE. Shots go both ways through the same cone (server hitscan).
export const WIN_RANGE = 15 * 36, WIN_HOLE_SEE = 6 * 36, WIN_REACH = 4.5 * CELL, WIN_SLIT = 0.11;
// world offset from floor f to floor g (add it to a floor-f position to get the same spot on floor g)
export function floorOff(m, f, g) {
  const F = m.floors[f], G = m.floors[g];
  return { x: ((F.x0 - F.gx) - (G.x0 - G.gx)) * CELL, y: (F.y0 - G.y0) * CELL };
}
const ledgeAt = (m, k) => m.tiles[k] === T.LOW && m.floor[k] === FL.VOID;
// 'open' | 'holed' | 'boarded' | 'shut' for rope r's window (the state seen from below)
export function windowState(m, r) {
  if (r.edge) return 'open';
  if (r.cells.every(k => m.tiles[k] === T.OPEN || m.tiles[k] === T.FLOOR || m.tiles[k] === T.RUBBLE)) return 'open';
  if (r.cells.some(k => m.tiles[k] === T.OPEN || m.tiles[k] === T.FLOOR || m.tiles[k] === T.RUBBLE || (m.tiles[k] === T.BARRI && m.holes[k] && m.holes[k].length))) return 'holed';
  return r.cells.every(k => m.tiles[k] === T.BARRI) ? 'boarded' : 'shut';
}
// The ground-floor spot just outside the wall under rope r's window (where the view down starts).
export function windowFoot(m, r) {
  if (r._foot !== undefined) return r._foot;
  const gi = m.groundFloor, ox = Math.cos(r.out), oy = Math.sin(r.out), o = floorOff(m, r.f, gi);
  const cx = r.hang.x - ox * CELL, cy = r.hang.y - oy * CELL; // the window's middle
  r._foot = null;
  for (const n of [0.5, 1, 1.5]) {
    const x = cx + ox * (CELL * n + 2) + o.x, y = cy + oy * (CELL * n + 2) + o.y, k = Math.floor(y / CELL) * m.W + Math.floor(x / CELL);
    if (m.flAt[k] === gi && (m.tiles[k] === T.GROUND || m.tiles[k] === T.LOW) && !m.shape[k]) { r._foot = { x, y, cx, cy }; break; }
  }
  return r._foot;
}
// The views down from someone at (x, y): [{ x, y (on the ground floor), ang, fov, range, near, kind: 'window', hole, r }]
export function windowViews(m, x, y) {
  const out = [], f = floorAt(m, x, y), gi = m.groundFloor;
  if (gi === undefined || f <= gi) return out;
  const srcs = f === m.roofFloor ? m.roofEdges || [] : (m.ropes || []).filter(r => r.f === f);
  for (const r of srcs) {
    const ft = windowFoot(m, r); if (!ft) continue;
    const ox = Math.cos(r.out), oy = Math.sin(r.out), depth = (ft.cx - x) * ox + (ft.cy - y) * oy + (r.edge ? CELL / 2 : 0); // how far inside the window (or back from the roof's edge) you stand
    if (r.edge ? depth < 1 || depth > ROOF_REACH : depth < 3 || depth > WIN_REACH) continue;
    const side = Math.abs((ft.cx - x) * r.tx + (ft.cy - y) * r.ty);
    if (side > r.half + depth * 1.6) continue;
    const ix = ft.cx - ox * (CELL / 2 + 1), iy = ft.cy - oy * (CELL / 2 + 1), d = Math.hypot(ix - x, iy - y); // just inside the window
    if (d > 3 && castSight(m, x, y, Math.atan2(iy - y, ix - x), d, null) < d - 3) continue;
    const st = windowState(m, r); if (st === 'shut' || st === 'boarded') continue;
    const view = (ang, fov, hole) => out.push(r.edge ? { x: ft.x, y: ft.y, ang, fov, range: WIN_RANGE, near: 0, kind: 'window', hole, r: -1, e: r.i } : { x: ft.x, y: ft.y, ang, fov, range: WIN_RANGE, near: 0, kind: 'window', hole, r: r.i });
    if (st === 'open') {
      const fx = ft.cx + (r.edge ? ox * CELL / 2 : 0), fy = ft.cy + (r.edge ? oy * CELL / 2 : 0); // the opening's (or the edge's) outside line
      const e1x = fx - r.tx * r.half, e1y = fy - r.ty * r.half, e2x = fx + r.tx * r.half, e2y = fy + r.ty * r.half;
      const a1 = Math.atan2(e1y - y, e1x - x), a2 = Math.atan2(e2y - y, e2x - x), da = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
      view(a1 + da / 2, Math.abs(da), false);
      continue;
    }
    // a board with holes (or partly broken): a slit through each hole and the whole of any broken cell
    let n = 0;
    for (const k of r.cells) {
      const kx = (k % m.W + 0.5) * CELL, ky = (Math.floor(k / m.W) + 0.5) * CELL, t = m.tiles[k];
      if (t !== T.BARRI) { const a = Math.atan2(ky - y, kx - x); view(a, Math.min(1.2, 2 * Math.atan2(CELL / 2, Math.hypot(kx - x, ky - y))), false); continue; }
      const h = m.holes[k] || [];
      for (let i = 0; i < h.length && n < 4; i += 2, n++) view(Math.atan2(h[i + 1] - y, h[i] - x), WIN_SLIT, true);
    }
  }
  return out;
}
// The rope (its window) or roof edge a view down (from windowViews) looks out of
export const viewSrc = (m, v) => v.e !== undefined ? m.roofEdges[v.e] : m.ropes[v.r];
// Does a view down (from windowViews) take in the ground-floor point (px, py)?
export function windowSees(m, v, px, py, smokes) {
  const d = Math.hypot(px - v.x, py - v.y);
  if (d > v.range) return false;
  if (d > 6 && Math.abs(angDiff(Math.atan2(py - v.y, px - v.x), v.ang)) > v.fov / 2 + 0.03) return false;
  return d <= 6 || los(m, v.x, v.y, px, py, smokes);
}
// Where someone up on the building also shows on the ground floor, or null: a window peeker (just outside the wall
// under their window; views = their views down) or someone hanging on a rope (on the ground right under them).
// Seen from (sx, sy) on the ground floor? peekSeen below.
export function wallGhost(m, x, y) {
  const f = floorAt(m, x, y), gi = m.groundFloor;
  if (gi === undefined || f <= gi) return null;
  const k = Math.floor(y / CELL) * m.W + Math.floor(x / CELL);
  if (ledgeAt(m, k)) { const o = floorOff(m, f, gi); return { x: x + o.x, y: y + o.y, fl: gi, rope: true }; }
  const views = windowViews(m, x, y); if (!views.length) return null;
  const v = views.reduce((a, b) => (b.hole ? 0 : b.fov) > (a.hole ? 0 : a.fov) ? b : a);
  return { x: v.x, y: v.y, fl: gi, views, hole: views.every(w => w.hole) };
}
// Can someone at (sx, sy) on the ground floor see this ghost? A rope climber: plain sight. A window peeker: only from
// inside one of their views (what they can see can see them), and through a bullet hole only from close by.
export function peekSeen(m, gh, sx, sy, smokes) {
  if (!gh || floorAt(m, sx, sy) !== gh.fl) return false;
  if (gh.rope) return los(m, sx, sy, gh.x, gh.y, smokes);
  for (const v of gh.views) {
    if (v.hole && Math.hypot(sx - v.x, sy - v.y) > WIN_HOLE_SEE) continue;
    if (windowSees(m, v, sx, sy, smokes)) return v; // (truthy: the view they are seen through; they show at its foot from there)
  }
  return false;
}
