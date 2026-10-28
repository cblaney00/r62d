// Can a body actually walk everywhere? Flood-fills body-centre positions (every 2 px) from outside on
// every map with real collision (PLAYER_R against blocksMove) and lists floor cells nobody can stand
// in, per room. Usage: node tests/reach.js [--r 7] [--map villa] [--drone]
import { CELL, PLAYER_R, DRONE_R, T, blocksMove, blocksDrone } from '../shared/constants.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { moveCircle } from '../shared/physics.js';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const drone = process.argv.includes('--drone');
const R = +arg('--r', drone ? DRONE_R : PLAYER_R), S = 2;
const only = arg('--map', null);
let bad = 0;
for (const id of only ? [only] : MAP_LIST) {
  const m = buildMap(id), GW = m.W * CELL / S, GH = m.H * CELL / S;
  const blk = drone ? (t, k) => blocksDrone(t) && !(m.dhole && m.dhole[k]) : t => blocksMove(t);
  const fits = (px, py) => {
    for (let cy = Math.floor((py - R) / CELL); cy <= Math.floor((py + R) / CELL); cy++)
      for (let cx = Math.floor((px - R) / CELL); cx <= Math.floor((px + R) / CELL); cx++) {
        if (cx < 0 || cy < 0 || cx >= m.W || cy >= m.H) return false;
        const k = cy * m.W + cx; if (!blk(m.tiles[k], k)) continue;
        const nx = Math.max(cx * CELL, Math.min(px, cx * CELL + CELL)), ny = Math.max(cy * CELL, Math.min(py, cy * CELL + CELL));
        if ((px - nx) ** 2 + (py - ny) ** 2 < R * R - 0.01) return false;
      }
    return true;
  };
  const seen = new Uint8Array(GW * GH), q = [];
  const add = (gx, gy) => { if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return; const i = gy * GW + gx; if (seen[i]) return; if (!fits(gx * S + S / 2, gy * S + S / 2)) { seen[i] = 2; return; } seen[i] = 1; q.push(i); };
  for (let k = 0; k < m.W * m.H; k++) if (m.tiles[k] === T.GROUND) { const cx = k % m.W, cy = (k / m.W) | 0; add((cx * CELL + 8) / S | 0, (cy * CELL + 8) / S | 0); }
  while (q.length) {
    const i = q.pop(), gx = i % GW, gy = (i / GW) | 0;
    add(gx + 1, gy); add(gx - 1, gy); add(gx, gy + 1); add(gx, gy - 1);
    const k = ((gy * S) / CELL | 0) * m.W + ((gx * S) / CELL | 0), pk = m.portal[k];
    if (pk >= 0) { const ox = (pk % m.W - k % m.W) * CELL / S, oy = (((pk / m.W) | 0) - ((k / m.W) | 0)) * CELL / S; add(gx + ox, gy + oy); }
  }
  // a floor cell counts as reachable if any body centre inside it was reached
  const out = {};
  for (const r of m.rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const k = y * m.W + x; if (blocksMove(m.tiles[k])) continue;
    let ok = false;
    for (let sy = 0; sy < CELL / S && !ok; sy++) for (let sx = 0; sx < CELL / S && !ok; sx++) if (seen[((y * CELL) / S + sy) * GW + (x * CELL) / S + sx] === 1) ok = true;
    if (!ok) { const key = `${m.floors[m.flAt[k]].name} ${r.name}`; (out[key] ||= []).push(`${x - m.floors[m.flAt[k]].gx + m.floors[m.flAt[k]].x0},${y + m.floors[m.flAt[k]].y0}`); }
  }
  // every drone hole lets a drone through and stops a body
  let holesBad = 0;
  for (let k = 0; k < m.W * m.H; k++) if (m.dhole[k]) {
    const cx = k % m.W, cy = (k / m.W) | 0, v = m.tiles[k - m.W] === T.SOFT || m.tiles[k + m.W] === T.SOFT; // wall runs up-down: go left-right
    const dx = v ? 1 : 0, dy = v ? 0 : 1;
    const go = (r, dr) => { const o = { x: (cx + 0.5 - 2 * dx) * CELL, y: (cy + 0.5 - 2 * dy) * CELL }; for (let i = 0; i < 40; i++) moveCircle(m, o, dx * 2, dy * 2, r, dr); return (o.x - (cx + 0.5) * CELL) * dx + (o.y - (cy + 0.5) * CELL) * dy > CELL; };
    if (!go(DRONE_R, true) || go(PLAYER_R, false)) { holesBad++; console.log(`   drone hole at cell ${cx},${cy} doesn't work`); }
  }
  bad += holesBad;
  const n = Object.values(out).reduce((a, b) => a + b.length, 0); bad += n;
  console.log(`${id}: ${n} floor cells a body (r=${R}) can't reach`);
  for (const [k, v] of Object.entries(out)) console.log(`   ${k}: ${v.length} — ${v.slice(0, 12).join(' ')}${v.length > 12 ? ' …' : ''}`);
}
process.exit(bad ? 1 : 0);
