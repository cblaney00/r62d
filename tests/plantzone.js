// Where the defuser can be planted (he asked 2026-11-15): anywhere within PLANT_R (5 m) of a bomb marker, only inside that
// bomb's own room. On every map and site: each bomb's own spot works, its room has a real area (not just the marker),
// no plantable cell lies in another room, and a server plant away from the marker lands where it was planted.
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST, plantBomb, roomAt, PLANT_R } from '../shared/map.js';
import { CELL, PHASE, TEAM } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const it of MAP_LIST) {
  const id = it.id || it, m = buildMap(id), sizes = [];
  m.sites.forEach((site, si) => { for (const b of site.bombs) {
    if (plantBomb(m, site, b.x, b.y) !== b) fail(id, site.name, b.id, 'its own marker spot is not plantable');
    const room = b.room || roomAt(m, b.x, b.y); let n = 0;
    const r = Math.ceil(PLANT_R / CELL) + 1, bx = Math.floor(b.x / CELL), by = Math.floor(b.y / CELL);
    for (let y = by - r; y <= by + r; y++) for (let x = bx - r; x <= bx + r; x++) { const wx = (x + 0.5) * CELL, wy = (y + 0.5) * CELL; if (plantBomb(m, site, wx, wy) !== b) continue; n++; if (roomAt(m, wx, wy) !== room) fail(id, site.name, b.id, 'plantable outside its room at', wx, wy); }
    sizes.push(n); if (n < 40) fail(id, site.name, b.id, 'plant area only', n, 'cells');
  } });
  console.log(`${id}: plant areas ${Math.min(...sizes)}-${Math.max(...sizes)} cells`);
}
// a server plant 3 m from the marker, inside the room
const g = new Game({ free: true }), a = g.addPlayer('Att', false); g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(a, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
const site = g.map.sites[g.site], b = site.bombs[0]; let spot = null;
for (let t = 0; t < 40 && !spot; t++) { const ang = t * 0.6, x = b.x + Math.cos(ang) * 3 * 36, y = b.y + Math.sin(ang) * 3 * 36; if (plantBomb(g.map, site, x, y) === b && g.map.tiles[Math.floor(y / CELL) * g.map.W + Math.floor(x / CELL)] === 1) spot = { x, y }; }
if (!spot) fail('no spot 3 m from the Harbor bomb'); else {
  if (g.side(a) !== TEAM.ATK) g.freeSwitch(a, 'ember');
  Object.assign(a, { x: spot.x, y: spot.y, hasDefuser: true, alive: true, downed: false, ctrl: 'body' }); g.phase = PHASE.ACTION; g.planted = null;
  const busy = g.startInteract(a); if (!busy || busy.k !== 'plant') fail('could not start planting 3 m from the marker'); else {
    a.busy = busy; a.input = { interact: 1 }; for (let i = 0; i < 300 && !g.planted; i++) g.continueInteract(a, 1 / 30);
    if (!g.planted) fail('plant did not finish'); else if (Math.hypot(g.planted.x - spot.x, g.planted.y - spot.y) > 1) fail('defuser not where it was planted', g.planted, spot);
  }
}
console.log(fails ? `FAIL ${fails}` : 'PASS plant areas');
process.exit(fails ? 1 : 0);
