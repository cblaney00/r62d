// Game modes (he asked 2026-11-12): Quick Match (first to 3, swap every round, site shown, 2 doors boarded, no bans),
// Unranked / Ranked (bans before round 1, first to 4, swap at half, overtime at 3-3 to 5). Run: node tests/modes.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { store } from '../server/store.js';
import { PHASE, T } from '../shared/constants.js';
import { MODES, attackSquad, roundsToWin } from '../shared/modes.js';
import { OPERATORS } from '../shared/operators.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const person = (g, name) => { const login = store.login(name); const p = g.addPlayer(login.profile.name, false); p.token = login.token; p.pid = login.profile.id; p.sock = { open: true, send() {} }; return p; };

// sides
const Q = MODES.quick, U = MODES.unranked;
if ([1, 2, 3, 4].map(r => attackSquad(Q, r)).join() !== '0,1,0,1') fail('quick match does not swap every round');
if ([1, 2, 3, 4, 5, 6, 7, 8, 9].map(r => attackSquad(U, r)).join() !== '0,0,0,1,1,1,0,1,0') fail('unranked sides wrong', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(r => attackSquad(U, r)).join());
if (roundsToWin(U, [3, 2]) !== 4 || roundsToWin(U, [3, 3]) !== 5 || roundsToWin(U, [4, 3]) !== 5) fail('overtime target wrong');
if (roundsToWin(Q, [2, 2]) !== 3) fail('quick match has overtime');

// Quick Match: boards + site shown
{
  const g = new Game(), p = person(g, 'Mode Quick');
  g.handle(p, { t: 'lobby', a: 'fillBots' }); g.startMatch();
  if (g.mode !== 'quick' || g.bans.length) fail('quick match not default or has bans');
  if (g.banning()) fail('quick match runs a ban phase');
  const before = g.map.tiles.filter(t => t === T.BARRI).length;
  g.beginPrep();
  const boarded = g.map.openings.filter(o => g.map.tiles[o.cells[0]] === T.BARRI && !o.cells.some(c => g.map.win[c])).length;
  if (boarded < 1) fail('quick match: no doorway boarded at the start', boarded, before);
  if (!g.siteRevealed) fail('quick match: the site is not shown to attackers');
  console.log(`quick: ${boarded} doorways boarded at the start, site shown`);
}

// Unranked: bans, then picks; whole match with forced results
{
  const g = new Game(), p = person(g, 'Mode Unranked');
  g.handle(p, { t: 'lobby', a: 'mode', id: 'unranked' });
  if (g.mode !== 'unranked') fail('mode message ignored');
  g.handle(p, { t: 'lobby', a: 'fillBots' }); g.startMatch();
  if (!g.banning() && g.playerBanStep() === false) fail('no ban phase in unranked');
  let mine = 0;
  for (let i = 0; i < 2000 && g.phase === PHASE.SELECT && (g.banning() || g.banRun?.i === 0 || !g.banRun); i++) {
    if (g.banning()) {
      const [sq, sd] = g.banRun.order[g.banRun.i];
      if (sq === p.squad) {
        p.op = null; g.handle(p, { t: 'pick', op: Object.keys(OPERATORS).find(o => OPERATORS[o].team === sd) }); if (p.op) fail('picked during bans');
        const op = Object.keys(OPERATORS).find(o => OPERATORS[o].team === sd && !g.isBanned(o)); g.handle(p, { t: 'ban', op }); mine++;
        if (!g.isBanned(op)) fail('player ban ignored');
      }
    }
    g.tick(1 / 30);
  }
  if (g.bans.length !== 4) fail('unranked: expected 4 bans, got', g.bans.length);
  if (mine !== 2) fail('the player banned', mine, 'times, not 2');
  const banned = g.bans[0].op;
  for (const q of g.players.values()) if (q.op === banned) fail('a banned operator was picked');
  // play forced results: 3-3 then overtime
  const squads = []; const win = sq => { g.beginPrep(); g.phase = PHASE.ACTION; squads.push(g.atkSquad()); g.endRound(g.atkSquad() === sq ? 'atk' : 'def', 'test'); g.timer = 0; g.tick(1 / 30); };
  for (const sq of [0, 0, 0, 1, 1, 1]) win(sq);
  if (g.phase === PHASE.MATCH_END) fail('match ended at', g.score.join('-'));
  win(0); if (g.phase === PHASE.MATCH_END) fail('overtime ended at 4-3');
  win(1); win(0);
  if (g.phase !== PHASE.MATCH_END) fail('match did not end at', g.score.join('-'));
  if (squads.join() !== '0,0,0,1,1,1,0,1,0') fail('attacking squads by round', squads.join());
  console.log(`unranked: bans ${g.bans.map(b => OPERATORS[b.op].name).join(', ')}; final ${g.score.join('-')}; attackers by round ${squads.join('')}`);
}

// Ranked = unranked rules + rank
{
  const g = new Game(), p = person(g, 'Mode Ranked');
  g.handle(p, { t: 'lobby', a: 'mode', id: 'ranked' });
  if (!g.ranked || !g.rules.bans || g.rules.winRounds !== 4) fail('ranked rules wrong');
  g.handle(p, { t: 'lobby', a: 'mode', id: 'zombies' });
  if (g.mode !== 'ranked') fail('a mode that is not ready could be chosen');
}
// tutorial / free / TV keep the classic rules
{
  const g = new Game({ free: true }); g.mode = 'ranked';
  if (g.rules.bans || g.ranked) fail('free play got ranked rules');
}
console.log(fails ? `FAIL modes (${fails})` : 'PASS modes');
process.exit(fails ? 1 : 0);
