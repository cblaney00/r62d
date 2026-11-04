// The outdoor part of every map, dressed to match the names of its attacker spawns (he asked: "complete the outdoor
// sections based on the theme of each spawn point"; he chose: the new things are solid cover). Same every round.
// A spawn's scene is written in its own frame: u = sideways, v = toward the building, in cells, the spawn at 0,0.
// A piece is [kind, u, v, length along u, length along v, block]: block 1 = solid cover, 2 = low (vault, shoot over), 0 = scenery.
// Pieces that don't fit (building, road furniture, edge of the map) shift a little or are left out; tests/outdoors.js counts them.
import { T, FL, CELL } from './constants.js';

const VEH = (kind, u, v, along = 'v') => along === 'v' ? [kind, u, v, 3, 8, 1] : [kind, u, v, 8, 3, 1];
const CAR = (u, v, along = 'v') => along === 'v' ? ['car', u, v, 3, 6, 1] : ['car', u, v, 6, 3, 1];
const TREE = (u, v) => ['tree', u, v, 2, 2, 1], PINE = (u, v) => ['snowpine', u, v, 2, 2, 1], ROCK = (u, v, a = 3, b = 3) => ['rock', u, v, a, b, 1];
const BUSH = (u, v) => ['bush', u, v, 2, 2, 1], CRATES = (u, v) => ['crates', u, v, 2, 2, 1], BARRELS = (u, v) => ['barrels', u, v, 2, 2, 2];
const HEDGE = (u, v, a = 7, b = 2) => ['hedge', u, v, a, b, 1];

export const OUTDOORS = {
  harbor: {
    edge: 'fence', scatter: [['bush', 2, 2, 1], ['tree', 2, 2, 1], ['crates', 2, 2, 1]],
    spawns: {
      'Loading Yard': { cover: ['truck', 'container'], ground: [FL.ASPHALT, 15], marks: ['hazard'], pieces: [['forklift', -9, 2, 2, 3, 1], CRATES(-12, -2), CRATES(-9, -3), ['crates', 11, 2, 3, 2, 1], VEH('truck', 13, -5), ['container', -14, -8, 8, 3, 1], ['container', -14, -12, 8, 3, 1]] },
      'West Garden': { cover: ['hedge', 'hedge'], ground: [FL.GRASS, 14], path: FL.CONCRETE, pieces: [['fountain', 0, -7, 5, 5, 2], HEDGE(-10, 1), HEDGE(10, 1), TREE(-13, -5), TREE(13, -6), ['bench', -6, -6, 3, 1, 2], ['bench', 6, -6, 3, 1, 2], HEDGE(-8, -11), HEDGE(8, -11)] },
      'Service Road': { cover: ['van', 'dumpster'], road: [FL.ASPHALT, 8, 0], marks: ['lanes'], pieces: [VEH('van', -10, 0, 'u'), ['dumpster', 9, 4, 3, 2, 1], ['dumpster', 13, 4, 3, 2, 1], ['barrier', -16, 4, 7, 1, 2], ['barrier', 18, 4, 7, 1, 2], CAR(17, -1, 'u')] },
      'Front Road': { cover: ['bus', 'car'], road: [FL.ASPHALT, 9, 0], marks: ['lanes', 'crossing'], pieces: [VEH('bus', -13, -1, 'u'), ['shelter', 10, 6, 6, 2, 1], CAR(14, -2, 'u'), CAR(-24, 2, 'u'), ['lamp', -6, 6, 1, 1, 1], ['lamp', 19, 6, 1, 1, 1]] },
      'East Parking': { cover: ['car', 'van'], ground: [FL.ASPHALT, 16], marks: ['bays'], pieces: [CAR(-13, -6), CAR(-9, -6), CAR(9, -6), CAR(13, -6), CAR(-5, -9), ['booth', 15, 3, 3, 3, 1], ['barrier', 8, 5, 5, 1, 2]] },
    },
  },
  villa: {
    edge: 'rock', scatter: [['rock', 3, 3, 1], ['bush', 2, 2, 1], ['cypress', 2, 2, 1]],
    spawns: {
      'Driveway': { cover: ['car', 'hedge'], ground: [FL.CONCRETE, 11], path: FL.CONCRETE, pieces: [['pier', -6, 8, 2, 2, 1], ['pier', 6, 8, 2, 2, 1], HEDGE(-12, 8), HEDGE(12, 8), CAR(9, -4), ['planter', -7, -3, 2, 2, 2], ['cypress', -13, 2, 2, 2, 1], ['cypress', 13, 2, 2, 2, 1]] },
      'Cliff Path': { cover: ['rock', 'rock'], ground: [FL.CONCRETE, 8], path: FL.CONCRETE, pieces: [ROCK(-8, 0, 5, 4), ROCK(8, 3, 4, 5), ROCK(-12, -6), ROCK(11, -5, 5, 3), ['railing', -5, -7, 8, 1, 2], ['cypress', 6, -4, 2, 2, 1], ROCK(-4, -12, 6, 3), ROCK(14, 6)] },
      'Pool Terrace': { cover: ['cabana', 'hedge'], ground: [FL.MARBLE, 12], pieces: [['pool', -10, -4, 7, 5, 2], ['cabana', 10, -4, 5, 4, 1], ['parasol', -3, -3, 2, 2, 0], ['lounger', -5, 1, 1, 2, 2], ['lounger', -2, 1, 1, 2, 2], ['planter', 6, 3, 2, 2, 2], ['planter', -9, 4, 2, 2, 2], ['parasol', 6, -7, 2, 2, 0]] },
      'Service Road': { cover: ['van', 'dumpster'], road: [FL.ASPHALT, 7, 0], pieces: [VEH('van', 11, -1, 'u'), ['dumpster', -9, 4, 3, 2, 1], CRATES(-13, 4), ['planter', 8, 5, 2, 2, 2], ['cypress', -16, -5, 2, 2, 1]] },
    },
  },
  depot: {
    edge: 'fence', scatter: [['bush', 2, 2, 1], ['barrels', 2, 2, 2], ['crates', 2, 2, 1]],
    spawns: {
      'Rail Yard': { cover: ['train', 'tankcar'], ground: [FL.CONCRETE, 13], marks: ['rails'], pieces: [VEH('train', -11, 0, 'u'), VEH('tankcar', 11, 0, 'u'), ['bufferstop', -18, 0, 2, 3, 1], CRATES(7, 5), BARRELS(-6, 5), VEH('train', 12, -7, 'u')] },
      'North Siding': { cover: ['train', 'container'], ground: [FL.CONCRETE, 12], marks: ['rails'], pieces: [VEH('train', 11, 0, 'u'), ['signalbox', -10, 4, 4, 4, 1], ['container', -13, -5, 8, 3, 1], BARRELS(5, 5), CRATES(13, 5), ['bufferstop', 19, 0, 2, 3, 1]] },
      'Platform': { cover: ['train', 'canopy'], ground: [FL.CONCRETE, 12], marks: ['rails'], pieces: [VEH('train', 11, 0, 'u'), ['canopy', -9, 5, 9, 3, 1], ['bench', 7, 5, 3, 1, 2], ['bench', 12, 5, 3, 1, 2], ['cart', -3, 5, 2, 3, 2], ['lamp', -16, 5, 1, 1, 1]] },
      'Car Park': { cover: ['car', 'van'], ground: [FL.ASPHALT, 15], marks: ['bays'], pieces: [CAR(-12, -6), CAR(-8, -6), CAR(9, -6), CAR(13, -6), ['booth', -13, 3, 3, 3, 1], ['barrier', 8, 5, 6, 1, 2], CAR(5, -10)] },
      'South Gate': { cover: ['truck', 'gatehouse'], ground: [FL.ASPHALT, 10], path: FL.ASPHALT, pieces: [['gatehouse', -7, 7, 5, 4, 1], ['fence', -18, 8, 14, 1, 1], ['fence', 16, 8, 16, 1, 1], ['barrier', 3, 8, 5, 1, 2], VEH('truck', 11, 0)] },
    },
  },
  embassy: {
    edge: 'wall', scatter: [['tree', 2, 2, 1], ['bush', 2, 2, 1], ['planter', 2, 2, 2]],
    spawns: {
      'Main Gate': { cover: ['gatehouse', 'car'], ground: [FL.MARBLE, 10], path: FL.MARBLE, pieces: [['pier', -5, 8, 2, 2, 1], ['pier', 5, 8, 2, 2, 1], ['gatehouse', -10, 7, 5, 4, 1], ['booth', 9, 7, 3, 3, 1], ['barrier', 0, 6, 6, 1, 2], ['planter', -9, -2, 2, 2, 2], ['planter', 9, -2, 2, 2, 2], CAR(12, -5)] },
      'West Street': { cover: ['car', 'van'], road: [FL.ASPHALT, 9, 0], marks: ['lanes'], pieces: [CAR(-11, 2, 'u'), CAR(12, 2, 'u'), ['planter', -6, 6, 2, 2, 2], ['planter', 7, 6, 2, 2, 2], TREE(-16, 7), TREE(16, 7), ['lamp', 0, 6, 1, 1, 1]] },
      'East Lot': { cover: ['van', 'car'], ground: [FL.ASPHALT, 14], marks: ['bays'], pieces: [CAR(-12, -6), CAR(-8, -6), CAR(9, -6), CAR(13, -6), ['booth', 13, 3, 3, 3, 1], ['barrier', -9, 5, 6, 1, 2]] },
      'South Street': { cover: ['bus', 'car'], road: [FL.ASPHALT, 9, 0], marks: ['lanes', 'crossing'], pieces: [VEH('bus', 13, -1, 'u'), ['shelter', -11, 6, 6, 2, 1], CAR(-15, -2, 'u'), ['planter', 8, 6, 2, 2, 2], TREE(17, 7)] },
      'Embassy Garden': { cover: ['hedge', 'hedge'], ground: [FL.GRASS, 14], path: FL.MARBLE, pieces: [['fountain', -9, -4, 5, 5, 2], HEDGE(-8, 3), HEDGE(9, 3), TREE(12, -5), TREE(-14, 4), ['bench', 6, -4, 3, 1, 2], HEDGE(9, -11), ['planter', -4, -8, 2, 2, 2]] },
    },
  },
  lodge: {
    edge: 'snowpine', snow: true, scatter: [['snowpine', 2, 2, 1], ['snowpine', 2, 2, 1], ['snowbank', 4, 2, 1], ['rock', 3, 3, 1]],
    spawns: {
      'Ski Lift': { cover: ['lifthut', 'snowcat'], ground: [FL.SNOW, 15], marks: ['liftline'], pieces: [['lifthut', -9, -3, 8, 5, 1], ['pylon', 0, -11, 2, 2, 1], VEH('snowcat', 11, -2), ['skirack', -6, 4, 4, 1, 2], ['skirack', 5, 4, 4, 1, 2], PINE(-14, 3), PINE(15, 4)] },
      'Mountain Road': { cover: ['van', 'snowbank'], road: [FL.ASPHALT, 8, 0], marks: ['lanes'], pieces: [['snowbank', -12, 5, 8, 2, 1], ['snowbank', 12, 5, 8, 2, 1], ['snowbank', 13, -5, 8, 2, 1], VEH('van', -12, -1, 'u'), PINE(-18, 7), PINE(18, 7)] },
      'Parking': { cover: ['bus', 'car'], ground: [FL.ASPHALT, 14], marks: ['bays'], pieces: [CAR(-12, -6), CAR(-8, -6), CAR(9, -6), CAR(13, -6), ['snowbank', -13, 4, 8, 2, 1], ['skirack', 7, 5, 4, 1, 2]] },
      'Pine Woods': { cover: ['logs', 'logs'], ground: [FL.SNOW, 15], pieces: [PINE(-7, 2), PINE(7, 3), PINE(-12, -3), PINE(11, -3), PINE(-4, -7), PINE(5, -8), PINE(-14, 5), PINE(14, 5), ['logs', -9, -8, 5, 3, 1], ROCK(12, -9)] },
      'Chalet Trail': { cover: ['logs', 'snowbank'], ground: [FL.SNOW, 12], path: FL.WOOD, pieces: [PINE(-8, 3), PINE(9, 3), ['logs', -10, -4, 5, 3, 1], ['firepit', 7, -4, 3, 3, 2], ['bench', 4, -7, 3, 1, 2], ['bench', 10, -8, 3, 1, 2], ['snowbank', -6, -9, 8, 2, 1], PINE(13, -6)] },
    },
  },
  school: {
    edge: 'fence', scatter: [['tree', 2, 2, 1], ['bush', 2, 2, 1]],
    spawns: {
      'Playground': { cover: ['climbframe', 'slide'], ground: [FL.ASPHALT, 15], marks: ['court'], pieces: [['climbframe', -10, -2, 6, 5, 1], ['slide', 9, -3, 3, 6, 1], ['swings', 0, -9, 7, 3, 1], ['bench', -5, 4, 3, 1, 2], ['bench', 5, 4, 3, 1, 2], TREE(-14, 5), TREE(14, 5)] },
      'Bus Stop': { cover: ['schoolbus', 'schoolbus'], road: [FL.ASPHALT, 9, 0], marks: ['lanes', 'crossing'], pieces: [VEH('schoolbus', -12, -1, 'u'), VEH('schoolbus', 13, -1, 'u'), ['shelter', 9, 6, 6, 2, 1], ['bench', -6, 6, 3, 1, 2], ['lamp', -14, 6, 1, 1, 1]] },
      'Sports Field': { cover: ['bleachers', 'bleachers'], ground: [FL.GRASS, 16], marks: ['field'], pieces: [['bleachers', -10, 4, 9, 3, 1], ['bleachers', 10, 4, 9, 3, 1], ['goal', 0, -12, 6, 2, 1], ['bench', -13, -3, 3, 1, 2], ['bench', 13, -3, 3, 1, 2]] },
      'Teacher Parking': { cover: ['car', 'van'], ground: [FL.ASPHALT, 14], marks: ['bays'], pieces: [CAR(-12, -6), CAR(-8, -6), CAR(9, -6), CAR(13, -6), ['bikerack', -11, 4, 6, 1, 2], ['bush', 11, 4, 2, 2, 1]] },
      'Back Gate': { cover: ['dumpster', 'hedge'], ground: [FL.CONCRETE, 8], path: FL.CONCRETE, pieces: [['fence', -13, 7, 18, 1, 1], ['fence', 13, 7, 18, 1, 1], ['pier', -3, 7, 2, 2, 1], ['pier', 3, 7, 2, 2, 1], ['dumpster', 8, 2, 3, 2, 1], ['dumpster', 12, 2, 3, 2, 1], HEDGE(-9, 2), TREE(-13, -4)] },
    },
  },
  dust: {
    edge: 'wall', scatter: [['rock', 3, 3, 1], ['barrels', 2, 2, 2], ['ruin', 5, 2, 1], ['palm', 2, 2, 1]],
    spawns: {
      'Long Road': { cover: ['ruin', 'wreck'], road: [FL.CONCRETE, 6, 0], pieces: [['wreck', -10, 2, 6, 3, 1], ['ruin', 10, 3, 7, 2, 1], ['sandbags', -4, 5, 5, 1, 2], BARRELS(5, 5), ['ruin', -15, -4, 6, 2, 1], ['palm', 14, -3, 2, 2, 1]] },
      'Market Street': { cover: ['tent', 'cart'], road: [FL.CONCRETE, 7, 0], pieces: [['tent', -10, 5, 6, 4, 1], ['tent', 10, 5, 6, 4, 1], ['marketstall', -5, -4, 4, 2, 2], ['marketstall', 5, -4, 4, 2, 2], ['cart', 15, 0, 2, 3, 2], CRATES(-15, 0), ['palm', 16, -6, 2, 2, 1]] },
      'Mid Street': { cover: ['wreck', 'ruin'], road: [FL.CONCRETE, 8, 0], pieces: [['wreck', 10, -1, 6, 3, 1], ['ruin', -10, 5, 7, 2, 1], ['sandbags', 5, 5, 5, 1, 2], BARRELS(-5, 5), ['ruin', 15, 6, 6, 2, 1], CRATES(-15, -2)] },
      'Tunnel Mouth': { cover: ['rock', 'rock'], ground: [FL.CONCRETE, 8], pieces: [['tunnel', 0, -9, 10, 4, 1], ROCK(-9, -6, 6, 5), ROCK(9, -6, 6, 5), ROCK(-12, 2, 4, 5), ROCK(12, 2, 4, 5), BARRELS(-6, 3), CRATES(6, 3)] },
    },
  },
};
const hash = (a, b) => { let v = Math.imul(a * 73856093 ^ b * 19349663, 0x5bd1e995); v ^= v >>> 13; return ((Math.imul(v, 0x5bd1e995) >>> 0) % 1000) / 1000; };

// the two pieces a spawn hides behind (mapkit's coverSpawn: slabs 8 x 3 cells or whatever the kind wants)
export const coverKinds = (id, name) => OUTDOORS[id] && OUTDOORS[id].spawns[name] ? OUTDOORS[id].spawns[name].cover : ['van', 'container'];

// painted on the ground, in the spawn's own frame
const MARKS = {
  lanes: (x, P, L) => { x.fillStyle = 'rgba(235,235,225,0.65)'; for (let u = -L; u < L; u += 5) { const a = P(u, 0), b = P(u + 2.5, 0.25); x.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) || 2, Math.abs(b.y - a.y) || 2); } },
  crossing: (x, P) => { x.fillStyle = 'rgba(235,235,225,0.6)'; for (let v = -3.5; v < 3.5; v += 1.4) { const a = P(-4, v), b = P(-1, v + 0.7); x.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); } },
  bays: (x, P) => { x.strokeStyle = 'rgba(235,235,225,0.55)'; x.lineWidth = 1; for (let u = -15; u <= 15; u += 4) { if (Math.abs(u) < 3) continue; const a = P(u - 2, -2.5), b = P(u - 2, -9.5); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } },
  hazard: (x, P) => { x.fillStyle = 'rgba(230,185,50,0.6)'; for (let u = -14; u < 14; u += 2) { const a = P(u, 6), b = P(u + 1, 6.5); x.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); } },
  rails: (x, P, L) => { for (const v0 of [0, -7]) { x.fillStyle = 'rgba(70,52,36,0.8)'; for (let u = -L; u < L; u += 1.2) { const a = P(u, v0 - 1.7), b = P(u + 0.5, v0 + 1.7); x.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); }
    x.strokeStyle = 'rgba(165,170,175,0.9)'; x.lineWidth = 1.2; for (const d of [-1.1, 1.1]) { const a = P(-L, v0 + d), b = P(L, v0 + d); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } } },
  court: (x, P) => { x.strokeStyle = 'rgba(240,240,240,0.5)'; x.lineWidth = 1.4; const a = P(-9, -9), b = P(9, 2); x.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); const c = P(0, -3.5); x.beginPath(); x.arc(c.x, c.y, 3 * CELL, 0, 7); x.stroke(); },
  field: (x, P) => { x.strokeStyle = 'rgba(245,245,245,0.55)'; x.lineWidth = 1.5; const a = P(-14, -14), b = P(14, 2); x.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); const c = P(0, -6), m = P(-14, -6), n = P(14, -6); x.beginPath(); x.moveTo(m.x, m.y); x.lineTo(n.x, n.y); x.stroke(); x.beginPath(); x.arc(c.x, c.y, 4 * CELL, 0, 7); x.stroke(); },
  liftline: (x, P) => { x.strokeStyle = 'rgba(30,30,35,0.55)'; x.lineWidth = 1; for (const d of [-0.6, 0.6]) { const a = P(d, -8), b = P(d, -30); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } },
};

// tools: { id, W, H, tiles, floor, props, decor, flAt, ground (floor object), open(k), dist, src }
export function dressOutdoors({ id, W, tiles, floor, props, decor, spawns, gf, open, dist, src }) {
  const O = OUTDOORS[id]; if (!O || !gf) return { planned: 0, placed: 0, pieces: [] };
  const inFloor = (x, y) => x >= gf.gx && y >= 0 && x < gf.gx + gf.w && y < gf.h, at = (x, y) => y * W + x;
  const spots = spawns.map(s => [Math.floor(s.x / CELL), Math.floor(s.y / CELL)]);
  if (O.snow) for (let y = 0; y < gf.h; y++) for (let x = gf.gx; x < gf.gx + gf.w; x++) { const k = at(x, y); if (tiles[k] === T.GROUND && floor[k] === FL.GRASS) floor[k] = FL.SNOW; }
  // true if a block fits here: open ground, a gap all round so nobody gets shut in, away from doors and every spawn
  const fits = (x0, y0, w, h, block) => {
    const m = block ? 2 : 0, keep = block ? 3 : 1;
    for (let y = y0 - m; y < y0 + h + m; y++) for (let x = x0 - m; x < x0 + w + m; x++) {
      if (!inFloor(x, y)) { if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) return false; continue; }
      const k = at(x, y); if (!open(k) && tiles[k] !== T.GROUND) { if (block || (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h)) return false; }
      if (x >= x0 && x < x0 + w && y >= y0 && y < y0 + h && !open(k)) return false;
      if (block && dist[k] >= 0 && dist[k] < 6) return false;
    }
    for (const [sx, sy] of spots) if (sx >= x0 - keep && sx < x0 + w + keep && sy >= y0 - keep && sy < y0 + h + keep) return false;
    return true;
  };
  const put = (kind, x0, y0, w, h, block) => {
    props.push({ kind, x: x0, y: y0, w, h, rot: w > h ? 1 : 0, outdoor: 1 });
    if (block) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) tiles[at(x, y)] = block === 1 ? T.TALL : T.LOW;
  };
  const NUDGE = []; for (const nv of [0, 2, -2, 4, -4, 6, -6]) for (const nu of [0, 2, -2, 4, -4, 6, -6, 9, -9, 12, -12]) NUDGE.push([nu, nv]);
  let planned = 0, placed = 0; const missing = [];
  spawns.forEach((s, i) => {
    const sc = O.spawns[s.name]; if (!sc) return;
    const [bx, by] = spots[i], k0 = at(bx, by), s0 = src[k0];
    let vx = 0, vy = 1;
    if (s0 >= 0) { const tx = s0 % W - bx, ty = ((s0 / W) | 0) - by; if (Math.abs(tx) > Math.abs(ty)) { vx = Math.sign(tx); vy = 0; } else { vx = 0; vy = Math.sign(ty) || 1; } }
    const ux = -vy, uy = vx, C = (u, v) => [Math.round(bx + u * ux + v * vx), Math.round(by + u * uy + v * vy)];
    const paint = (u0, v0, u1, v1, fl) => { for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) { const [x, y] = C(u, v); if (inFloor(x, y) && tiles[at(x, y)] === T.GROUND) floor[at(x, y)] = fl; } };
    if (sc.ground) { // a patch with a wobbly edge
      const [fl, R] = sc.ground;
      for (let v = -R - 2; v <= R + 2; v++) for (let u = -R - 2; u <= R + 2; u++) {
        const a = Math.atan2(v, u), r = R * (0.86 + 0.09 * Math.sin(a * 3 + i * 2) + 0.05 * Math.sin(a * 7 + i));
        if (Math.hypot(u, v) <= r) paint(u, v, u, v, fl);
      }
    }
    if (sc.road) { const [fl, w, off] = sc.road; paint(-40, off - (w >> 1), 40, off + (w >> 1), fl); }
    if (sc.path !== undefined) paint(-1, 0, 2, Math.max(0, dist[k0] - 1), sc.path); // a path on toward the building
    const P = (u, v) => ({ x: (bx + 0.5 + u * ux + v * vx) * CELL, y: (by + 0.5 + u * uy + v * vy) * CELL });
    for (const mk of sc.marks || []) decor.push(x => { x.save(); MARKS[mk](x, P, 34); x.restore(); });
    for (const [kind, u, v, lu, lv, block] of sc.pieces) {
      planned++;
      const w = ux ? lu : lv, h = ux ? lv : lu; let done = false;
      // close to where it was written first; then the same spot on the other side of the spawn (a spawn may back onto the map's edge)
      for (const vv of v < 0 ? [v, -v + 2] : [v]) { for (const [nu, nv] of NUDGE) {
        const [cx, cy] = C(u + nu, vv + nv), x0 = cx - (w >> 1), y0 = cy - (h >> 1);
        if (fits(x0, y0, w, h, block)) { put(kind, x0, y0, w, h, block); placed++; done = true; break; }
      } if (done) break; }
      if (!done) missing.push(`${s.name}:${kind}`);
    }
  });
  // the rest of the added ground: a thin scatter of what grows or lies around here
  const list = O.scatter || [];
  if (list.length) for (let y = 3; y < gf.h - 3; y += 7) for (let x = gf.gx + 3; x < gf.gx + gf.w - 3; x += 7) {
    if (hash(x, y) > 0.45) continue;
    const [kind, w, h, block] = list[Math.floor(hash(y + 5, x) * list.length)], x0 = x + Math.floor(hash(x + 1, y) * 4), y0 = y + Math.floor(hash(x, y + 1) * 4);
    if (dist[at(x0, y0)] < 10 || spots.some(([a, b]) => Math.hypot(a - x0, b - y0) < 9)) continue;
    if (fits(x0, y0, w, h, block)) put(kind, x0, y0, w, h, block);
  }
  // the edge of the world: a fence, wall, rock face or tree line all the way round
  const E = O.edge, step = E === 'snowpine' ? 3 : E === 'rock' ? 4 : 10, deep = E === 'snowpine' ? 2 : E === 'rock' ? 3 : 1;
  const edgeOk = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (!inFloor(x, y) || !open(at(x, y))) return false; return true; };
  for (let x = gf.gx; x < gf.gx + gf.w; x += step) for (const y of [0, gf.h - deep]) { const w = Math.min(step, gf.gx + gf.w - x); if (w >= deep && edgeOk(x, y, w, deep)) put(E, x, y, w, deep, 1); }
  for (let y = deep; y < gf.h - deep; y += step) for (const x of [gf.gx, gf.gx + gf.w - deep]) { const h = Math.min(step, gf.h - deep - y); if (h >= deep && edgeOk(x, y, deep, h)) put(E, x, y, deep, h, 1); }
  return { planned, placed, missing };
}
