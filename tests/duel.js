// 1V1 (he asked 2026-11-20): one a side, small maps only, first to 4, sides swap every round, and before every round
// each player bans one operator of the side they face (that round only). Plays whole bot matches on each small map.
// Run: node tests/duel.js [matches per map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { store } from '../server/store.js';
import { PHASE } from '../shared/constants.js';
import { MAPS, MAP_LIST, floorAt } from '../shared/map.js';
import { MODES } from '../shared/modes.js';
import { OPERATORS } from '../shared/operators.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const person = (g, name) => { const login = store.login(name); const p = g.addPlayer(login.profile.name, false); p.token = login.token; p.pid = login.profile.id; p.sock = { open: true, send() {} }; return p; };
const small = MAP_LIST.filter(k => MAPS[k].small);
if (small.length < 2) fail('fewer than two small maps', small);
const D = MODES.duel;
if (!D || !D.fun || D.size !== 1 || D.winRounds !== 4 || D.swap !== 'round' || D.bans !== 'round') fail('1V1 rules wrong', D);

// the lobby: choosing 1V1 sends extra bots away, moves to a small map, refuses big maps, one bot a side at most
{
  const g = new Game(), p = person(g, 'Duel Lobby');
  g.handle(p, { t: 'lobby', a: 'fillBots' });
  if (g.players.size !== 10) fail('fill bots did not fill the 5v5 lobby', g.players.size);
  g.handle(p, { t: 'lobby', a: 'mode', id: 'duel' });
  if (g.mode !== 'duel') fail('1V1 not chosen');
  if (g.squadCount(0) !== 1 || g.squadCount(1) !== 1) fail('1V1 lobby not one a side', g.squadCount(0), g.squadCount(1));
  if (!MAPS[g.mapId].small) fail('1V1 kept a big map', g.mapId);
  g.handle(p, { t: 'lobby', a: 'map', id: 'embassy' });
  if (g.mapId === 'embassy') fail('1V1 took a big map');
  g.handle(p, { t: 'lobby', a: 'addBot', squad: 1 }); g.handle(p, { t: 'lobby', a: 'fillBots' });
  if (g.players.size !== 2) fail('1V1 lobby took more bots', g.players.size);
  g.handle(p, { t: 'lobby', a: 'map', id: 'random' }); g.startMatch();
  if (!MAPS[g.mapId].small) fail('random map in 1V1 was big', g.mapId);
  console.log(`lobby: one a side, ${MAPS[g.mapId].name}, big maps refused`);
}
// alone in the lobby: a bot to play against
{
  const g = new Game(), p = person(g, 'Duel Alone');
  g.handle(p, { t: 'lobby', a: 'mode', id: 'duel' });
  g.removeBot(); g.removeBot();
  g.startMatch();
  if (g.squadCount(0) + g.squadCount(1) !== 2 || !g.squadCount(1 - p.squad)) fail('alone: no opponent bot', g.squadCount(0), g.squadCount(1));
  // a person bans when it is their turn, only the side they face, and only then
  for (let i = 0; i < 30 * 3 && !g.banning(); i++) g.tick(1 / 30);
  if (!g.banning()) fail('no ban phase in round 1');
  const [sq, sd] = g.banRun.order[g.banRun.i];
  const mineSide = g.side(p) === 'atk' ? 'def' : 'atk';
  if (sq === p.squad) {
    if (sd !== mineSide) fail('you ban the wrong side', sd, mineSide);
    const wrong = Object.keys(OPERATORS).find(o => OPERATORS[o].team !== sd), right = Object.keys(OPERATORS).find(o => OPERATORS[o].team === sd);
    g.playerBan(p, wrong); if (g.bans.length) fail('banned an operator of your own side');
    g.playerBan(p, right); if (!g.bans.some(b => b.op === right)) fail('your ban did not count');
  }
  console.log('alone: a bot opponent, bans go to the side you face');
}

// whole matches with bots
const per = +process.argv[2] || 2;
for (const id of small) for (let n = 0; n < per; n++) {
  const g = new Game();
  g.mode = 'duel'; g.mapId = id; g.map = (await import('../shared/map.js')).buildMap(id); g.botLevel = 4;
  g.addBot(0); g.addBot(1); g.addBot(0); // the third is refused
  if (g.players.size !== 2) fail('more than two bots in a 1V1', g.players.size);
  g.startMatch();
  const dt = 1 / 30; let t = 0, last = null;
  const rounds = [], wins = [0, 0], bansPer = {}, atk = {}, ops = new Set(), floors = new Set(), ev = {};
  while (t < 60 * 30) {
    g.tick(dt); t += dt;
    for (const e of g.events) ev[e.e] = (ev[e.e] || 0) + 1;
    if (Math.round(t * 30) % 2 === 0) g.broadcast();
    for (const p of g.players.values()) { if (p.alive) floors.add(floorAt(g.map, p.x, p.y)); if (p.op) ops.add(p.op); }
    if (g.phase === PHASE.PREP && atk[g.round] === undefined) {
      atk[g.round] = g.atkSquad();
      bansPer[g.round] = g.bans.length;
      for (const b of g.bans) for (const p of g.players.values()) if (p.op === b.op) fail(`round ${g.round}: ${OPERATORS[b.op].name} was banned but picked`);
      if (g.bans.some(b => b.rd !== g.round)) fail(`round ${g.round}: an old ban is still on`);
    }
    if (g.phase !== last) { if (g.phase === PHASE.ROUND_END) wins[g.winner]++, rounds.push(`${g.round}:${g.winner === atk[g.round] ? 'A' : 'D'}(${g.reason})`); last = g.phase; }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
  const r = rounds.length, w = Math.max(...wins);
  if (w !== 4) fail(`${id}: match did not end at 4`, wins, rounds.join(' '));
  if (r > 7) fail(`${id}: more than 7 rounds`, r);
  for (let i = 2; i <= r; i++) if (atk[i] === atk[i - 1]) fail(`${id}: sides did not swap before round ${i}`);
  for (let i = 1; i <= r; i++) if (bansPer[i] !== 2) fail(`${id}: round ${i} had ${bansPer[i]} bans, not 2`);
  console.log(`${MAPS[id].name}: score ${wins.join("-")} in ${r} rounds (${rounds.join(' ')}), ${(t / 60).toFixed(1)} min, kills ${ev.kill || 0}, plants ${ev.plant || 0}, floors ${[...floors].sort().join(',')}, ${ops.size} operators`);
}
console.log(fails ? `${fails} FAILED` : 'PASS');
process.exit(fails ? 1 : 0);
