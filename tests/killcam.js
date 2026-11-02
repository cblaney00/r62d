// Killcam (he asked): when a person dies the server sends them the last seconds of everyone involved, a BS rating
// with reasons, and flags a bug (saved to data/bugs) when something impossible happened. Run: node tests/killcam.js
import './_tmpdata.js';
import fs from 'node:fs';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { T, CELL } from '../shared/constants.js';
import { WEAPONS } from '../shared/operators.js';
const K4 = WEAPONS.k4.name;

let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ free: true }); g.mapId = 'harbor'; g.map = buildMap('harbor');
const v = g.addPlayer('Victim', false), k = g.addPlayer('Killer', false);
g.handle(v, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
const got = []; v.sock = { open: true, send: s => got.push(JSON.parse(s)) };
k.squad = 1 - v.squad; k.op = Object.keys(g.players).length ? k.op : k.op;
const spot = g.freeSpotNear(360, 40, 10);
Object.assign(v, { x: spot.x, y: spot.y, aim: 0, alive: true, hp: 100, ctrl: 'body', downed: false, staged: false });
Object.assign(k, { x: spot.x + 120, y: spot.y, aim: Math.PI, alive: true, hp: 100, ctrl: 'body', downed: false, staged: false, viewTime: null });
for (let i = 0; i < 60; i++) { g.time += 1 / 30; g.recordHistory(); g.recordCam(); }
g.hitscan(k, k.x, k.y + 3, Math.PI, 400, 20, K4, 'AR');
g.kill(v, k, K4);
const m = got.find(x => x.t === 'killcam');
if (!m) fail('no killcam sent'); else {
  if (m.fr.length < 20) fail('too few frames', m.fr.length);
  if (!m.shots.length) fail('no shots recorded');
  if (m.rating > 2) fail('a face-to-face kill rated', m.rating, m.why);
  if (m.bug) fail('a clean kill flagged as a bug', m.bug);
  console.log('clean kill:', m.rating, m.why.join('; '));
}
// an impossible kill: through a solid wall
got.length = 0; v.alive = true; v.hp = 100; v.aim = Math.PI;
const W = g.map.W; let wallK = -1;
for (let kk = 0; kk < g.map.tiles.length && wallK < 0; kk++) if (g.map.tiles[kk] === T.HARD && g.map.tiles[kk - 1] === T.FLOOR && g.map.tiles[kk + 1] === T.FLOOR && g.map.tiles[kk - 2] === T.FLOOR && g.map.tiles[kk + 2] === T.FLOOR && !g.map.shape[kk]) wallK = kk;
const cx = wallK % W, cy = Math.floor(wallK / W);
Object.assign(v, { x: (cx - 1.5) * CELL, y: (cy + 0.5) * CELL }); Object.assign(k, { x: (cx + 2.5) * CELL, y: (cy + 0.5) * CELL });
for (let i = 0; i < 30; i++) { g.time += 1 / 30; g.recordHistory(); g.recordCam(); }
g.kill(v, k, K4);
const b = got.find(x => x.t === 'killcam');
if (!b || !b.bug) fail('kill through concrete not flagged', b && b.why); else {
  console.log('impossible kill:', b.rating, b.bug.join('; '), b.bugId);
  const f = process.env.R62D_DATA + '/bugs/' + b.bugId + '.json';
  if (!fs.existsSync(f)) fail('bug not saved', f);
}
console.log(fails ? `${fails} failure(s)` : 'PASS killcam');
process.exit(fails ? 1 : 0);
