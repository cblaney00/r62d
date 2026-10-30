// Walks a body (real movement physics + the bots' path finding) up and down every staircase on
// every map, to prove each one can actually be reached and used. Run: node tests/stairs.js
import { buildMap, MAP_LIST, floorAt } from '../shared/map.js';
import { stepMove, vaultable, findVault } from '../shared/physics.js';
import { CELL, T, blocksMove } from '../shared/constants.js';
import { __findPath as findPath } from '../server/bots.js';

const D = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
function walk(m, from, to, label) {
  const o = { x: (from % m.W + 0.5) * CELL, y: (Math.floor(from / m.W) + 0.5) * CELL, vx: 0, vy: 0 };
  let path = null, t = 0;
  const tx = to % m.W, ty = Math.floor(to / m.W);
  while (t < 25) {
    const cx = Math.floor(o.x / CELL), cy = Math.floor(o.y / CELL);
    if (cx === tx && cy === ty) return null;
    if (!path || Math.round(t * 30) % 30 === 0) path = findPath(m, cx, cy, tx, ty) || [];
    const i = path.indexOf(cy * m.W + cx); if (i >= 0 && i < 6) path.splice(0, i + 1);
    const next = path[0]; if (next === undefined) return `${label}: no path`;
    const nx = (next % m.W + 0.5) * CELL - o.x, ny = (Math.floor(next / m.W) + 0.5) * CELL - o.y, d = Math.hypot(nx, ny) || 1;
    if (vaultable(m, next) && d < 24) { const v = findVault(m, o.x, o.y, Math.atan2(ny, nx)); if (v) { o.x = v.x; o.y = v.y; t += 0.6; continue; } } // vault like a bot
    const k = { right: nx / d > 0.38, left: nx / d < -0.38, down: ny / d > 0.38, up: ny / d < -0.38 };
    stepMove(m, o, k, 1 / 30, { armor: 2 }); t += 1 / 30;
  }
  return `${label}: stuck at ${Math.floor(o.x / CELL)},${Math.floor(o.y / CELL)} (floor ${floorAt(m, o.x, o.y)})`;
}
// nearest cell (by grid steps) to k that a body can stand in
function open(m, k) {
  const W = m.W, x0 = k % W, y0 = Math.floor(k / W);
  for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = x0 + dx, y = y0 + dy, kk = y * W + x;
    if (m.flAt[kk] !== m.flAt[k] || m.portal[kk] >= 0) continue;
    let ok = true; for (const [ax, ay] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (blocksMove(m.tiles[(y + ay) * W + x + ax])) ok = false;
    if (ok && (m.tiles[kk] === T.FLOOR || m.tiles[kk] === T.GROUND || m.tiles[kk] === T.STAIR)) return kk;
  }
  return k;
}
let fails = 0;
for (const id of MAP_LIST) {
  const m = buildMap(id);
  for (const st of m.stairs) {
    const [dx, dy] = D[st.dir], W = m.W;
    const gA = st.ga, gB = st.gb, ax = gA % W, ay = Math.floor(gA / W), bx = gB % W, by = Math.floor(gB / W);
    // centre of the bottom end, and of the top end, on each floor
    const mid = st.dir === 'n' || st.dir === 's' ? [Math.floor(st.w / 2), 0] : [0, Math.floor(st.h / 2)];
    const botOff = st.dir === 'n' ? [mid[0], st.h - 1] : st.dir === 's' ? [mid[0], 0] : st.dir === 'w' ? [st.w - 1, mid[1]] : [0, mid[1]];
    const topOff = st.dir === 'n' ? [mid[0], 0] : st.dir === 's' ? [mid[0], st.h - 1] : st.dir === 'w' ? [0, mid[1]] : [st.w - 1, mid[1]];
    const below = open(m, (ay + botOff[1] - dy * 2) * W + ax + botOff[0] - dx * 2);
    const above = open(m, (by + topOff[1] + dy * 2) * W + bx + topOff[0] + dx * 2);
    const name = `${m.name} stairs ${m.floors[st.a].name}->${m.floors[st.b].name} at ${st.x},${st.y}`;
    for (const r of [walk(m, below, above, name + ' going up'), walk(m, above, below, name + ' going down')]) if (r) { console.log('FAIL ' + r); fails++; }
  }
  console.log(`${m.name}: ${m.stairs.length} staircases checked`);
}
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
