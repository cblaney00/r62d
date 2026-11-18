// How tall everything on the floor is (he asked 2026-11-18: seeing over and under things by height, from the real
// size of each thing: no seeing over counters and chest-high things when crouched, clearly under beds and tables when
// lying down). Per kind of prop, in metres: top = its height; gap = the open space under it (tables, beds, cars), 0 if
// solid to the floor; pen = how much of a bullet's damage gets through (he chose: bullets follow the same lines, and some
// furniture can be shot through: wood and cloth yes, stone, metal and engines hardly or not at all; a shot through
// furniture never leaves a hole you can see through); see = you see through it anyway (railings, glass, thin posts).
// Built into map.fTop / fGap (world px) and map.fPen (0-100) per cell by buildFurniture (shared/map.js buildFresh).
import { CELL, T, PX_PER_M } from './constants.js';

export const FURN_H = {
  // indoors
  desk: [0.76, 0.66, 0.6], meetingtable: [0.76, 0.66, 0.6], coffeetable: [0.45, 0.34, 0.75], workbench: [0.9, 0.72, 0.35],
  console: [0.95, 0, 0.3], reception: [1.1, 0, 0.5], counter: [1.05, 0, 0.25], island: [0.92, 0, 0.25], sink: [0.9, 0, 0.3],
  bench: [0.46, 0.36, 0.75], chairs: [0.88, 0.45, 0.85], couch: [0.85, 0, 0.8], bed: [0.6, 0.28, 0.8], tv: [1.25, 0, 0.5],
  cabinet: [1.05, 0, 0.5], shelf: [1.85, 0, 0.55], bookshelf: [2.0, 0, 0.35], rack: [1.9, 0, 0.35], locker: [1.85, 0, 0.3],
  fridge: [1.8, 0, 0.2], plant: [1.3, 0, 0.9], pillar: [3.0, 0, 0], booth: [1.2, 0, 0.6], stall: [1.4, 0, 0.6],
  marketstall: [1.0, 0, 0.7], bleachers: [1.6, 0, 0.4], climbframe: [2.0, 0, 0.9, 1], goal: [2.0, 0, 1, 1],
  // outdoors
  car: [1.45, 0.22, 0.15], van: [2.0, 0.28, 0.2], truck: [2.8, 0.4, 0.1], bus: [3.0, 0.32, 0.15], schoolbus: [3.0, 0.32, 0.15],
  train: [3.8, 0.3, 0.05], tankcar: [3.5, 0.4, 0.05], forklift: [2.1, 0, 0.1], snowcat: [2.4, 0, 0.1], wreck: [1.3, 0, 0.1], cart: [1.0, 0, 0.5],
  crates: [1.25, 0, 0.45], barrels: [0.9, 0, 0.35], dumpster: [1.4, 0, 0.1], container: [2.6, 0, 0.05], tank: [1.6, 0, 0],
  barrier: [0.85, 0, 0], sandbags: [0.9, 0, 0], planter: [0.75, 0, 0], fountain: [0.85, 0, 0], wall: [1.1, 0, 0], ruin: [1.5, 0, 0],
  rock: [1.6, 0, 0], logs: [1.0, 0, 0.3], snowbank: [1.2, 0, 0.6], aircon: [1.1, 0, 0.3], gatehouse: [2.6, 0, 0.2],
  lifthut: [2.6, 0, 0.3], signalbox: [2.6, 0, 0.3], cabana: [2.4, 0, 0.6], tent: [2.0, 0, 0.9], bufferstop: [1.1, 0, 0],
  tree: [6, 0, 0.2], palm: [6, 0, 0.3], cypress: [5, 0, 0.6], snowpine: [5, 0, 0.5], bush: [1.2, 0, 0.9], hedge: [1.7, 0, 0.85],
  fence: [2.0, 0, 0.9, 1], railing: [1.05, 0, 1, 1], lamp: [3, 0, 1, 1], pylon: [3, 0, 1, 1], shelter: [2.4, 0, 0.8, 1],
  pier: [1.0, 0, 0], canopy: [3, 2.4, 1, 1], parasol: [2.2, 2.0, 1, 1], pool: [0.1, 0, 1, 1], lounger: [0.4, 0.2, 0.8],
  swings: [2.2, 0, 1, 1], slide: [1.8, 0, 0.6], bikerack: [0.8, 0, 1, 1], skirack: [1.2, 0, 0.9, 1], firepit: [0.45, 0, 0.3], tunnel: [3, 0, 0],
};
const BARE = { [T.LOW]: [1.0, 0, 1, 1], [T.TALL]: [2.4, 0, 0.2] }; // cells no prop owns: the low ones are all ledges over open air (window ledges, drops): seen and shot past as before
const px = m => Math.round(m * PX_PER_M);

export function buildFurniture(map) {
  const W = map.W, N = W * map.H, top = new Uint8Array(N), gap = new Uint8Array(N), pen = new Uint8Array(N);
  const set = (k, h) => { top[k] = Math.min(255, px(h[0])); gap[k] = px(h[1] || 0); pen[k] = Math.round((h[2] ?? 0.2) * 100); if (h[3]) top[k] = 0; }; // (see-through: no height for sight; pen still counts)
  for (let k = 0; k < N; k++) { const b = BARE[map.tiles[k]]; if (b) set(k, b); }
  for (const p of map.props || []) { const h = FURN_H[p.kind]; if (!h) continue;
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) { if (x < 0 || y < 0 || x >= W || y >= map.H) continue; const k = y * W + x; if (map.tiles[k] === T.LOW || map.tiles[k] === T.TALL) set(k, h); } }
  map.fTop = top; map.fGap = gap; map.fPen = pen;
}
// Seen or shot past the furniture between two points, by height: a line from (x0, y0) at height h0 to (x1, y1) at h1
// (world px above the floor) is stopped by a furniture cell where it passes between the cell's gap and its top.
// Returns { see, pen }: see = nothing opaque in the way; pen = the share of a bullet's damage that gets through.
export function furnLine(map, x0, y0, h0, x1, y1, h1) {
  const T0 = map.fTop; if (!T0) return { see: true, pen: 1 };
  const W = map.W, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 1) return { see: true, pen: 1 };
  let see = true, pen = 1;
  const n = Math.ceil(L / (CELL * 0.5)), seen = new Set(), k0 = Math.floor(y0 / CELL) * W + Math.floor(x0 / CELL), k1 = Math.floor(y1 / CELL) * W + Math.floor(x1 / CELL);
  for (let i = 1; i < n; i++) {
    const s = i / n, x = x0 + dx * s, y = y0 + dy * s, k = Math.floor(y / CELL) * W + Math.floor(x / CELL);
    if (k === k0 || k === k1 || seen.has(k)) continue; seen.add(k);
    const tl = map.tiles[k]; if (tl !== T.LOW && tl !== T.TALL) continue; // (only furniture)
    const pt = map.fPen[k], tp = T0[k], gp = map.fGap[k]; if (!tp && pt >= 100) continue;
    const h = h0 + (h1 - h0) * s; if (h <= gp || (tp && h >= tp) || (!tp && pt >= 100)) continue;
    if (tp) see = false; // (see-through things have no top for sight)
    pen *= pt / 100; if (pen <= 0) return { see: false, pen: 0 };
  }
  return { see, pen };
}
// heights by stance: eyes, and the top of the body (what has to show for someone to be seen), and the chest (where a shot lands)
export const EYE_STANCE = [58, 34, 9], HEAD_STANCE = [63, 36, 13], CHEST_STANCE = [47, 27, 9]; // (crouched: the head at 1.0 m, so a counter hides you)
export const stanceOf = o => !o ? 0 : (o.pn || (o.pr || 0) >= 1 || o.dn || o.downed) ? 2 : (o.cr || (o.input && o.input.crouch)) ? 1 : 0;
// the height of the furniture at a spot (world px; 0 where there is none): someone standing on top of it is that much higher
export const furnTopAt = (map, x, y) => { const T0 = map.fTop; if (!T0) return 0; const k = Math.floor(y / CELL) * map.W + Math.floor(x / CELL); return T0[k] || 0; };
