// Free play bots and dummies (he asked: add them while playing), no shooting before you are on the map (he noticed),
// and melee cracks a board more with each hit, breaking on the third (he asked). Run: node tests/freebots.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { store } from '../server/store.js';
import { PHASE, TEAM, T, CELL_HP } from '../shared/constants.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
// --- free play: bots and dummies ---
const g = new Game({ free: true });
const p = g.addPlayer('Tester', false); p.token = store.login('Tester').token; p.pid = 'x';
g.handle(p, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
g.handle(p, { t: 'free', a: 'dummy' });
g.handle(p, { t: 'free', a: 'bot', side: 'enemy' });
g.handle(p, { t: 'free', a: 'bot', side: 'team' });
const bots = [...g.players.values()].filter(q => q.bot), d = bots.find(q => q.dummyAt);
if (bots.length !== 3) fail('expected 3 added, got', bots.length);
if (!d || g.side(d) === g.side(p)) fail('no dummy on the enemy side');
if (!bots.some(q => !q.dummyAt && q.squad === p.squad) || !bots.some(q => !q.dummyAt && q.squad !== p.squad)) fail('team / enemy bots missing');
if (d && Math.hypot(d.x - p.x, d.y - p.y) > 160) fail('dummy not in front of you', Math.hypot(d.x - p.x, d.y - p.y));
const at = d && { x: d.x, y: d.y };
for (let i = 0; i < 30 * 5; i++) g.tick(1 / 30);
if (d && Math.hypot(d.x - at.x, d.y - at.y) > 1) fail('dummy moved');
if (d) { d.alive = false; d.downed = false; for (let i = 0; i < 30 * 4; i++) g.tick(1 / 30); if (!d.alive || Math.hypot(d.x - at.x, d.y - at.y) > 1) fail('dummy did not come back to its spot'); }
for (let i = 0; i < 6; i++) g.handle(p, { t: 'free', a: 'dummy' });
if (g.players.size > 10) fail('more than 10 in the match');
g.handle(p, { t: 'free', a: 'clearBots' });
if ([...g.players.values()].some(q => q.bot)) fail('remove all left bots');
// --- a waiting attacker (drone lost in preparation) cannot shoot ---
const m = new Game();
const a = m.addPlayer('Waiter', false); for (let i = 0; i < 9; i++) m.addBot();
m.startMatch(); while (m.phase !== PHASE.PREP) m.tick(1 / 30);
const atk = m.side(a) === TEAM.ATK ? a : [...m.players.values()].find(q => q.bot && m.side(q) === TEAM.ATK);
if (atk === a) {
  const dr = m.ent(a.droneId); if (dr) m.droneLost?.(a) ?? (dr.hp = 0);
  a.ctrl = 'body'; const before = a.guns[a.slot].ammo;
  for (let i = 0; i < 20; i++) { a.input = { ...(a.input || {}), fire: 1 }; a.click = { t: m.time }; m.tick(1 / 30); }
  m.event(a, { k: 'gadget' }); m.event(a, { k: 'melee' });
  if (a.guns[a.slot].ammo !== before) fail('a waiting attacker fired', before, a.guns[a.slot].ammo);
} else console.log('(player defended this round: staged check skipped)');
// --- board: three melee hits, cracking more each time ---
const b = new Game(); b.mapId = 'harbor';
const o = b.map.openings.find(o => o.kind === 'door'); b.barricade(o.id, T.BARRI, true);
const k = o.cells[0], hp = [b.map.hp[k] / CELL_HP[T.BARRI]];
for (let i = 0; i < 3; i++) { b.barriHit(k); hp.push(b.map.tiles[k] === T.BARRI ? b.map.hp[k] / CELL_HP[T.BARRI] : 0); }
const stage = f => f > 0.95 ? 0 : f > 0.5 ? 1 : 2; // the same rule mapdraw.js uses to draw the cracks
if (stage(hp[0]) !== 0 || stage(hp[1]) !== 1 || stage(hp[2]) !== 2 || hp[3] !== 0) fail('crack stages per hit wrong', hp.map(x => x.toFixed(2)));
console.log('board after each hit:', hp.map(x => x.toFixed(2)).join(' → '));
console.log(fails ? `FAIL freebots (${fails})` : 'PASS freebots');
process.exit(fails ? 1 : 0);
