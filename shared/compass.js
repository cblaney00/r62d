// The bomb-site compass's route (shared so tests can check it on every map; drawn by drawCompass in main.js)
import { CELL, T } from './constants.js';
const WALKISH = new Set([T.FLOOR, T.GROUND, T.STAIR, T.OPEN, T.HATCH, T.HATCHR, T.HOLE, T.BARRI, T.RUBBLE]);
// Bomb-site compass route (he asked 2026-11-12: intuitive and accurate). Shortest walk over the map as you know it
// (K, the map as you know it: doors, boards, holes and stairs/hatch links), 8-way with true diagonal lengths, to the nearest cell of a
// site room. The arrow points at the furthest cell of that route you could walk to in a straight line (so it points
// down the corridor you should take, not at a corner ten cells on); a floor change on the way points at the stairs or
// hatch first. Distance = the real route length in metres.
export function compassRoute(m, K, siteIdx, from, C = {}) {
  K = K || m; const s = { site: siteIdx }, site = m.sites[siteIdx], W = m.W, N = W * m.H;
  const start = Math.floor(from.y / CELL) * W + Math.floor(from.x / CELL);
  if (start < 0 || start >= N) return null;
  const goalSet = C.cmpGoal && C.cmpGoal.site === s.site && C.cmpGoal.m === m ? C.cmpGoal.set : (C.cmpGoal = { site: s.site, m, set: (() => { const g = new Uint8Array(N);
    for (const r of m.rooms) if (site.rooms.includes(r.name)) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y * W + x] = 1; return g; })() }).set;
  if (goalSet[start]) return { here: true };
  const walk = k => WALKISH.has(K.tiles[k]) && K.tiles[k] !== T.HOLE;
  const dist = C.cmpD && C.cmpD.length === N ? C.cmpD.fill(1e9) : (C.cmpD = new Float32Array(N).fill(1e9));
  const prev = C.cmpPrev && C.cmpPrev.length === N ? C.cmpPrev : (C.cmpPrev = new Int32Array(N));
  // a small binary heap of cells by distance
  const H = C.cmpH || (C.cmpH = { k: new Int32Array(1 << 16), d: new Float32Array(1 << 16) }); let n = 0;
  const push = (k, d) => { if (n >= H.k.length) { const k2 = new Int32Array(H.k.length * 2), d2 = new Float32Array(H.k.length * 2); k2.set(H.k); d2.set(H.d); H.k = k2; H.d = d2; }
    let i = n++; while (i > 0) { const p = (i - 1) >> 1; if (H.d[p] <= d) break; H.k[i] = H.k[p]; H.d[i] = H.d[p]; i = p; } H.k[i] = k; H.d[i] = d; };
  const pop = () => { const k = H.k[0], last = --n, lk = H.k[last], ld = H.d[last]; let i = 0;
    while (true) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && H.d[c + 1] < H.d[c]) c++; if (H.d[c] >= ld) break; H.k[i] = H.k[c]; H.d[i] = H.d[c]; i = c; }
    H.k[i] = lk; H.d[i] = ld; return k; };
  dist[start] = 0; prev[start] = -1; push(start, 0);
  let goal = -1;
  const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  while (n) {
    const dk = H.d[0], k = pop(); if (dk > dist[k]) continue;
    if (goalSet[k]) { goal = k; break; }
    const x = k % W;
    const step = (nb, c) => { const nd = dk + c; if (nd < dist[nb]) { dist[nb] = nd; prev[nb] = k; push(nb, nd); } };
    for (const [dx, dy, c] of D8) {
      const nx = x + dx, nb = k + dy * W + dx; if (nx < 0 || nx >= W || nb < 0 || nb >= N || !walk(nb)) continue;
      if (dx && dy && (!walk(k + dx) || !walk(k + dy * W))) continue; // no cutting wall corners
      step(nb, c);
    }
    if (m.portal && m.portal[k] >= 0 && m.portal[k] < N) step(m.portal[k], 1);
  }
  if (goal < 0) return null;
  const path = []; for (let k = goal; k >= 0; k = prev[k]) path.push(k); path.reverse();
  const flOf = k => m.flAt[k];
  let end = path.length - 1, stairs = null;
  for (let i = 1; i < path.length; i++) if (flOf(path[i]) !== flOf(path[i - 1]) || (m.portal && m.portal[path[i - 1]] === path[i])) {
    end = i - 1; stairs = { up: flOf(path[i]) > flOf(path[i - 1]), to: m.floors[flOf(path[i])].name }; break;
  }
  // furthest route cell (before any floor change) you could walk straight to
  const clear = (a, b) => { const ax = a % W + 0.5, ay = Math.floor(a / W) + 0.5, bx = b % W + 0.5, by = Math.floor(b / W) + 0.5, len = Math.hypot(bx - ax, by - ay), n2 = Math.ceil(len * 3);
    for (let i = 1; i < n2; i++) { const t = i / n2, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      for (const [ox, oy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) if (!walk(Math.floor(y + oy) * W + Math.floor(x + ox))) return false; } return true; };
  let aim = path[Math.min(1, end)];
  for (let j = end; j >= 1; j--) if (clear(start, path[j])) { aim = path[j]; break; }
  const total = dist[goal];
  return { aim, at: stairs ? path[end] : null, via: stairs ? path[end + 1] : null, cells: total, stairs: stairs ? (stairs.up ? '▲' : '▼') : null, to: stairs ? stairs.to : null, toStairs: stairs ? dist[path[end]] : null, site: site.name, siteFloor: m.floors[flOf(goal)].name };
}
