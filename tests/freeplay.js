// Free play: a private match on the chosen map, straight into the action with no clock and no rounds;
// N / B switch to the next / previous operator (both sides) where you stand, the dead come back after 3 s.
// Run: node tests/freeplay.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { store } from '../server/store.js';
import { MAP_LIST } from '../shared/map.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { OPERATORS, opsForTeam } from '../shared/operators.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const ALL = [...opsForTeam(TEAM.ATK), ...opsForTeam(TEAM.DEF)];
for (const mapId of MAP_LIST) for (const bots of [0, 3]) {
  const g = new Game({ free: true });
  const p = g.addPlayer('Tester', false); p.token = store.login('Tester').token; p.pid = 'x';
  g.handle(p, { t: 'free', a: 'start', map: mapId, bots });
  const tag = `${mapId} bots=${bots}:`;
  if (g.mapId !== mapId) fail(tag, 'wrong map', g.mapId);
  if (g.phase !== PHASE.ACTION) fail(tag, 'not in action phase', g.phase);
  if (!p.alive || !p.op || g.side(p) !== TEAM.ATK) fail(tag, 'not spawned as an attacker', p.alive, p.op);
  const botList = [...g.players.values()].filter(q => q.bot);
  if (botList.length !== bots || botList.some(q => !q.alive || g.side(q) !== TEAM.DEF)) fail(tag, 'enemy bots wrong', botList.length);
  for (let i = 0; i < 30 * 20; i++) g.tick(1 / 30); // 20 s: the clock must not move, no round end
  if (g.phase !== PHASE.ACTION) fail(tag, 'left the action phase', g.phase);
  // go round every operator, forwards then backwards, checking each comes out alive, armed, on the right side
  for (const dir of [1, -1]) for (let i = 0; i < ALL.length; i++) {
    const before = p.op, x = p.x, y = p.y, was = p.alive;
    g.handle(p, { t: 'free', a: 'op', dir });
    const want = ALL[(ALL.indexOf(before) + dir + ALL.length) % ALL.length];
    if (p.op !== want) { fail(tag, 'switch went to', p.op, 'not', want); break; }
    if (!p.alive || !p.guns.length || g.side(p) !== OPERATORS[p.op].team) fail(tag, 'bad after switching to', p.op);
    if (was && (p.x !== x || p.y !== y)) fail(tag, 'moved when switching to', p.op);
    for (const q of g.players.values()) if (q.bot && g.side(q) === g.side(p)) fail(tag, 'bot on your side after switching to', p.op);
    for (let k = 0; k < 3; k++) g.tick(1 / 30);
  }
  // dying brings you back after about 3 s, at your side's start
  g.kill(p, null, 'test');
  if (p.alive) fail(tag, 'did not die');
  for (let i = 0; i < 30 * 4 && !p.alive; i++) g.tick(1 / 30);
  if (!p.alive) fail(tag, 'no respawn after 4 s');
  if (g.phase !== PHASE.ACTION) fail(tag, 'dying ended the round', g.phase);
  if (g.saveMatch(0) !== null) fail(tag, 'free play would be saved');
}
console.log(fails ? `${fails} failure(s)` : 'PASS free play');
process.exit(fails ? 1 : 0);
