// Snipers (he asked): the Pike and the Saker LR drop anyone with one clean body shot (not through a wall) when aimed in
// through the sniper scope (not with a prism or from the hip, he asked for a nerf), other guns don't, and everyone has more health. Run: node tests/sniper.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { WEAPONS, ARMOR_HP } from '../shared/operators.js';

let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
if (ARMOR_HP[1] !== 150 || ARMOR_HP[3] !== 120) fail('health not raised', ARMOR_HP);
const g = new Game({ free: true });
for (let i = 0; i < 2; i++) g.addBot();
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.startMatch();
for (let i = 0; i < 400 && g.phase !== PHASE.ACTION; i++) g.tick(1 / 30);
const [p, q] = [...g.players.values()];
for (const [w, want, sight = 'sniper', ads = 1] of [['pike', 'dead'], ['saker', 'dead'], ['pike', 'alive', 'prism'], ['saker', 'alive', 'prism'], ['saker', 'alive', 'sniper', 0], ['longbow', 'alive'], ['k4', 'alive']]) {
  p.guns[p.slot] = { w, att: { sight }, m: {} }; p.adsT = ads;
  let res = null;
  for (let tries = 0; tries < 40 && !(res && res.k === 'flesh'); tries++) { // a clear line of open floor (props get in the way)
    q.alive = true; q.downed = false; q.maxHp = ARMOR_HP[1] + 15; q.hp = q.maxHp; // a heavy with plates
    const s = g.freeSpotNear(g.map.atkSpawns[0].x, g.map.atkSpawns[0].y, 200); p.alive = true; p.x = s.x; p.y = s.y; q.x = s.x + 60; q.y = s.y;
    g.shotW = WEAPONS[w]; g.shotAim = { x: q.x, y: q.y + 5 }; // the body, not the head
    res = g.hitscan(p, p.x, p.y, Math.atan2(4, 60), 600, WEAPONS[w].dmg, w, WEAPONS[w].cls); g.shotW = null; g.shotAim = null;
  }
  const r = q.alive && !q.downed ? 'alive' : 'dead';
  console.log(w.padEnd(8), sight.padEnd(7), ads ? 'aimed' : 'hip  ', r, Math.round(q.hp));
  if (r !== want) fail(w, 'body shot left them', r);
}
console.log(fails ? `${fails} failure(s)` : 'PASS sniper');
process.exit(fails ? 1 : 0);
