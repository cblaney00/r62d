// All maps. Each map file builds its floors with the kit in mapkit.js.
import { CELL, T } from './constants.js';
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
