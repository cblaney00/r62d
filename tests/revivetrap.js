// Reviving on top of traps and gadgets (he saw it fail on LATCH's wire): for every placed trap/gadget type, of either
// side, under the downed player or the medic, holding E still gets them up.
// Run: node tests/revivetrap.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { TEAM, DUR } from '../shared/constants.js';

let fails = 0, n = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const KINDS = ['wire', 'alarm', 'mine', 'sensor', 'spike', 'station', 'catcher', 'radar', 'jammer', 'pace', 'echobox']; // (clamps and blast traps finish a downed player: not a revive question)
for (const kind of KINDS) for (const own of [0, 1]) for (const whoSide of ['def', 'atk']) {
  const g = new Game({ free: true });
  const a = g.addPlayer('Medic', false), d = g.addPlayer('Hurt', false);
  g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(a, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
  d.squad = a.squad;
  if ((g.side(a) === TEAM.DEF) !== (whoSide === 'def')) { a.squad = d.squad = 1 - a.squad; }
  const tick = (s, ia = {}) => { for (let i = 0; i < s * 30; i++) { const dx = d.x - a.x, dy = d.y - a.y, far = Math.hypot(dx, dy) > 16, step = far ? { right: dx > 4 ? 1 : 0, left: dx < -4 ? 1 : 0, down: dy > 4 ? 1 : 0, up: dy < -4 ? 1 : 0 } : {}; for (const [p, inp] of [[a, { ...ia, ...step }], [d, {}]]) { p.prevInput = p.input; p.input = { ...inp }; g.applyMove(p, 1 / 30); g.tickPlayer(p, 1 / 30); } g.tickEnts && g.tickEnts(1 / 30); g.time += 1 / 30; } };
  const s = g.freeSpotNear(g.map.sites[0].bombs[0].x, g.map.sites[0].bombs[0].y, 40);
  for (const p of [a, d]) Object.assign(p, { alive: true, downed: false, ctrl: 'body', rope: null, vault: null, busy: null, hp: 100, x: s.x, y: s.y });
  a.hasDefuser = false; const m0 = g.freeSpotNear(d.x - 54, d.y, 30); a.x = m0.x; a.y = m0.y; // a clear spot ~1.5 m away d.downed = true; d.hp = DUR.bleedout; d.selfUp = 0;
  const team = own ? g.side(a) : (g.side(a) === TEAM.DEF ? TEAM.ATK : TEAM.DEF);
  g.ents.push({ id: g.eid(), type: kind, x: d.x, y: d.y, ang: 0, team, owner: -1, arm: 0, hp: 1, life: 99, t: 99, pool: 100, hit: {} });
  n++;
  tick(DUR.revive + 4, { interact: 1 });
  if (d.downed || !d.alive) fail(kind, own ? 'own team' : 'enemy', g.side(a), 'downed', d.downed, 'alive', d.alive, 'busy', a.busy && a.busy.k, 'medic alive', a.alive, a.downed, 'gap', Math.round(Math.hypot(a.x - d.x, a.y - d.y)));
}
console.log(fails ? `${fails} failure(s) of ${n}` : `PASS revive on traps (${n})`);
process.exit(fails ? 1 : 0);
