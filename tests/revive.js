// Reviving (he asked: it kept failing): a teammate holding E beside a downed player always gets them up, even when the
// downed player keeps crawling away, and even right under a rope (E revives there, it doesn't start a climb).
// Run: node tests/revive.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { TEAM, DUR } from '../shared/constants.js';

let fails = 0, n = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const g = new Game({ free: true });
  const a = g.addPlayer('Medic', false), d = g.addPlayer('Hurt', false);
  g.mapId = id; g.map = buildMap(id); g.handle(a, { t: 'free', a: 'start', map: id, bots: 0 });
  d.squad = a.squad;
  const tick = (s, ia = {}, id2 = {}) => { for (let i = 0; i < s * 30; i++) { for (const [p, inp] of [[a, ia], [d, id2]]) { p.prevInput = p.input; p.input = { ...inp }; g.applyMove(p, 1 / 30); g.tickPlayer(p, 1 / 30); } g.time += 1 / 30; } };
  const spots = [g.freeSpotNear(g.map.sites[0].bombs[0].x, g.map.sites[0].bombs[0].y, 40)];
  if (g.map.ropes.length && g.side(a) === TEAM.ATK) spots.push(g.map.ropes[0].base);
  for (const s of spots) {
    n++;
    for (const p of [a, d]) Object.assign(p, { alive: true, downed: false, ctrl: 'body', rope: null, vault: null, busy: null, hp: 100, x: s.x, y: s.y });
    a.hasDefuser = false; d.x += 12; d.downed = true; d.hp = DUR.bleedout; d.selfUp = 0; d.op = a.op === 'mason' ? 'shunt' : d.op;
    tick(0.1); const d0 = Math.round(Math.hypot(d.x - a.x, d.y - a.y));
    tick(DUR.revive + 0.6, { interact: 1, crouch: 1 }, { right: 1 }); // the downed one tries to crawl away the whole time
    if (d.downed) fail(id, 'not revived', s === spots[0] ? 'by the site' : 'under a rope', 'dist', Math.round(Math.hypot(d.x - a.x, d.y - a.y)), 'rope', !!a.rope, 'start dist', d0, g.side(a), g.side(d), d.downed, a.busy && a.busy.k);
  }
}
console.log(fails ? `${fails} failure(s)` : `PASS revive (${n} revives)`);
process.exit(fails ? 1 : 0);
