// Map cameras hang on walls (never mid-floor) and break like drones: one bullet from inside the room,
// a melee hit, or knocking down the wall they hang on. Run: node tests/wallcams.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, T, CELL } from '../shared/constants.js';
import { tileAt } from '../shared/physics.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game();
  for (let i = 0; i < 10; i++) g.addBot();
  g.mapId = id; g.map = buildMap(id); g.startMatch();
  while (g.phase !== PHASE.ACTION) g.tick(1 / 30);
  const cams = g.ents.filter(e => e.type === 'cam' && !e.owner && !e.tu);
  const atk = [...g.players.values()].find(q => g.side(q) !== cams[0].team && q.alive);
  for (const q of g.players.values()) if (q !== atk) { q.x = -9000; q.y = -9000; q.bot = false; } // nobody standing in the line of fire
  let shot = 0, swung = 0;
  for (const c of cams) {
    if (c.wn === null || !c.wall.length) { fail(id, 'camera not on a wall at', c.x, c.y); continue; }
    const cx = Math.floor(c.x / CELL), cy = Math.floor(c.y / CELL), t = tileAt(g.map, cx, cy);
    if (t !== T.FLOOR && t !== T.GROUND) fail(id, 'camera inside a wall at', c.x, c.y);
    // shoot it from 3 cells out in front of its wall
    c.hp = 1;
    const sx = c.x + Math.cos(c.wn) * CELL * 3, sy = c.y + Math.sin(c.wn) * CELL * 3;
    const r = g.hitscan(atk, sx, sy, Math.atan2(c.y - sy, c.x - sx), 600, 30, 'test', 'AR');
    if (c.hp === 0) shot++; else fail(id, 'bullet did not break camera at', c.x, c.y, r && r.k);
    // swing at it
    c.hp = 1; atk.x = c.x + Math.cos(c.wn) * 14; atk.y = c.y + Math.sin(c.wn) * 14; atk.aim = c.wn + Math.PI; atk.meleeCd = 0; atk.ctrl = 'body'; atk.downed = false; atk.bracing = false;
    g.melee(atk);
    if (c.hp === 0) swung++; else fail(id, 'melee did not break camera at', c.x, c.y);
    // a defender looking through it can't turn it to face into its wall
    c.hp = 1;
  }
  // knocking down the wall a camera hangs on takes the camera with it
  const soft = cams.find(c => c.wall.some(k => g.map.tiles[k] === T.SOFT));
  if (soft) { soft.hp = 1; g.destroyCell(soft.wall.find(k => g.map.tiles[k] === T.SOFT)); if (soft.hp !== 0) fail(id, 'camera survived its wall'); }
  console.log(`${id.padEnd(8)} ${cams.length} cameras on walls, ${shot} broken by a bullet, ${swung} by melee${soft ? ', wall-fall ok' : ''}`);
}
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
