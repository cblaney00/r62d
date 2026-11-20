// 1V1 small talk (he asked 2026-11-20): the bot opponent talks to you by its personality, never too much. Plays bot 1v1s
// with each bot listening as if it were a person, prints what was said, and checks: all chat, at most 3 lines a round
// from one bot (plus the gg), at most 12 a match, 20 s between lines, the chatty bot talks more than the quiet one, nothing in 5v5.
// Run: node tests/duelchat.js [matches]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE } from '../shared/constants.js';
import { MAPS, MAP_LIST, buildMap } from '../shared/map.js';
import { ROSTER } from '../shared/botroster.js';
import { social } from '../server/bots.js';

let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const who = n => ROSTER.flat().find(e => e.n === n);
const said = {}, per = +process.argv[2] || 2;
function play(mode, names, lvl, mapId) {
  const g = new Game(); g.mode = mode; g.mapId = mapId; g.map = buildMap(mapId); g.botLevel = lvl;
  if (mode === 'duel') { g.addBot(0); g.addBot(1); } else for (const s of [0, 1]) for (let i = 0; i < 5; i++) g.addBot(s);
  const ps = [...g.players.values()], log = [];
  ps.forEach((p, i) => { const n = names[i % names.length]; p.bio = who(n); p.bioLv = lvl; p.persona = null; p.name = p.baseName = '[BOT] ' + n;
    p.sock = { open: true, send(s) { const m = JSON.parse(s); if (m.t === 'chat' && !m.team && m.from !== p.id) log.push({ t: g.time, rd: g.round, from: m.name, text: m.text }); } }; });
  g.startMatch(); let t = 0;
  while (t < 1800) { g.tick(1 / 30); t += 1 / 30; g.events.length = 0; if (g.phase === PHASE.LOBBY && t > 5) break; }
  const seen = new Set(); return log.filter(l => { const k = l.from + l.t; if (seen.has(k)) return false; seen.add(k); return true; });
}
const small = MAP_LIST.filter(k => MAPS[k].small);
for (const [names, lvl] of [[['Vortex', 'Hollow'], 5], [['Pickles', 'Wobbles'], 0]]) for (let n = 0; n < per; n++) {
  const log = play('duel', names, lvl, small[n % small.length]);
  console.log(`--- ${names.join(' vs ')} (chatty ${names.map(x => social({ bio: who(x) }).toFixed(2)).join(' / ')}) on ${MAPS[small[n % small.length]].name}`);
  for (const l of log) { console.log(`  round ${l.rd}  ${l.from}: ${l.text}`); said[l.from] = (said[l.from] || 0) + 1; }
  const by = {}; for (const l of log) { const k = l.from + ':' + l.rd; by[k] = (by[k] || []).concat(l); }
  for (const [k, ls] of Object.entries(by)) { const plain = ls.filter(l => !/^gg/i.test(l.text)); if (plain.length > 3) fail('too many lines in a round', k, plain.length);
    for (let i = 1; i < plain.length; i++) if (plain[i].t - plain[i - 1].t < 19.5) fail('two lines too close', k); }
}
for (const [n, c] of Object.entries(said)) if (c > 13 * per) fail('too many lines in a match', n, c);
for (const [a, b] of [['Vortex', 'Hollow'], ['Pickles', 'Wobbles']]) if ((said['[BOT] ' + a] || 0) < (said['[BOT] ' + b] || 0)) fail(`${a} (pushy) said less than ${b} (quiet)`, said);
const five = play('siege', ['Vortex'], 5, 'house'); if (five.some(l => l.text)) fail('all-chat small talk in 5v5', five.slice(0, 3));
console.log('lines said:', JSON.stringify(said));
console.log(fails ? `${fails} FAILED` : 'PASS'); process.exit(fails ? 1 : 0);
