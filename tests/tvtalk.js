// ESPORTS TV team talk: 15 s before each round, both teams talk over the site, picks and spawns, someone asks for an
// operator and gets an answer, then everyone is locked in. Run: node tests/tvtalk.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE } from '../shared/constants.js';
let fails = 0; const ok = (c, ...a) => { if (!c) { fails++; console.log('FAIL', ...a); } };
for (const level of [7, 1]) {
  const g = new Game({ tv: true }), said = [];
  const chat = g.chat.bind(g); g.chat = (p, m) => { said.push({ t: g.time, sq: p.squad, who: p.name, text: m.text }); chat(p, m); };
  g.tvStart('villa', level);
  for (let r = 0; r < 2; r++) {
    said.length = 0; const t0 = g.time;
    while (g.phase === PHASE.SELECT) g.tick(1 / 30);
    const took = g.time - t0; // (15 s of talk, plus the bans before it: 4 in the first round, 1 after)
    ok(took > 14 && took < 30, `level ${level}: select took ${took.toFixed(1)} s`);
    ok([...g.players.values()].every(p => p.op && p.locked), 'someone not locked in');
    for (const sq of [0, 1]) { const lines = said.filter(s => s.sq === sq); ok(lines.length >= 6, `team ${sq} said only ${lines.length} lines`); ok(lines.some(s => /can you play/.test(s.text)), `team ${sq}: no request`); }
    console.log(`level ${level} round ${g.round} (${took.toFixed(1)} s):`); for (const s of said) console.log(`  ${s.t.toFixed(1).padStart(6)} ${s.sq ? 'ORA' : 'BLU'} ${s.who}: ${s.text}`);
    while (g.phase !== PHASE.ROUND_END) g.tick(1 / 30); while (g.phase !== PHASE.SELECT) g.tick(1 / 30);
  }
}
console.log(fails ? `${fails} failure(s)` : 'PASS');
process.exit(fails ? 1 : 0);
