// All maps. Each map file builds its floors with the kit in mapkit.js.
import { CELL, T } from './constants.js';
import { castSight } from './physics.js';
import { build as harbor } from './maps/harbor.js';
import { build as villa } from './maps/villa.js';
import { build as depot } from './maps/depot.js';
import { build as embassy } from './maps/embassy.js';
import { build as lodge } from './maps/lodge.js';
import { build as school } from './maps/school.js';

export const MAPS = {
  harbor: { name: 'Harbor Office', floors: '1F · 2F', desc: 'Offices and a garage by the docks.', build: harbor },
  villa: { name: 'Cliffside Villa', floors: 'B · 1F · 2F', desc: 'A luxury house on a cliff, wine cellar and panic room below.', build: villa },
  depot: { name: 'Rail Depot', floors: '1F · 2F', desc: 'A train shed with catwalks above the tracks and an office wing.', build: depot },
  embassy: { name: 'The Embassy', floors: 'B · 1F · 2F', desc: 'A consulate round an open courtyard, with a vault and cells below.', build: embassy },
  lodge: { name: 'Alpine Lodge', floors: '1F · 2F', desc: 'A timber mountain lodge with a great hall, bar and guest suites.', build: lodge },
  school: { name: 'Clocktower School', floors: '1F · 2F · 3F', desc: 'An old school with a gym, labs upstairs and a clock tower on top.', build: school },
};
export const MAP_LIST = Object.keys(MAPS);

const cache = new Map();
export function buildMap(id = 'harbor') {
  if (!MAPS[id]) id = 'harbor';
  return MAPS[id].build();
}

// Which floor a world position is on (index into map.floors), or -1.
export function floorAt(map, wx, wy) {
  const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
  if (cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) return -1;
  const f = map.flAt[cy * map.W + cx]; return f === 255 ? -1 : f;
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
  const wall = (cx, cy) => { if (cx < 0 || cy < 0 || cx >= W || cy >= map.H) return false; const k = cy * W + cx; return MOUNT_WALL.has(map.tiles[k]) && map.openId[k] < 0 && !map.dhole[k]; };
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
