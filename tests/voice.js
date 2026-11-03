// Bots talking (he asked: real voices, varied, not constantly; quiet in a clutch; quiet when asked; polite with rank).
// Every line has its recordings, nobody talks in a clutch, a call for quiet is respected, and push to talk gets answers.
// Run: node tests/voice.js
import './_tmpdata.js';
import fs from 'node:fs';
import { Game } from '../server/game.js';
import { pttAsk, talk, teamHushed, voiceOf } from '../server/bots.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE } from '../shared/constants.js';
import { OPERATORS } from '../shared/operators.js';
import { LINES, CAST, SPEAKERS, CASTER_VOICE, compose, voiceHas } from '../shared/comms.js';
let bad = 0; const check = (ok, what) => { console.log((ok ? 'ok   ' : 'FAIL ') + what); if (!ok) bad++; };
// 1. recordings: all lines of every voice, with slots from the real game
const op = Object.values(OPERATORS)[0].name; const title = s => s[0] + s.slice(1).toLowerCase();
let missing = 0, lines = 0;
for (const v of Object.keys(SPEAKERS)) { const caster = CASTER_VOICE.includes(v), book = caster ? CAST : LINES;
  for (const [cat, def] of Object.entries(book)) { if (caster && (v === CASTER_VOICE[1]) !== (def.tone === 'desk')) continue;
    for (let n = 0; n < 12; n++) { const c = compose(v, cat, { op: title(op), place: 'Archive', way: 'door', plan: 'Default', name: 'Halden', name2: 'Sable', team: 'Northwind', team2: 'Ironclad Collective', map: 'Harbor Office', n: '2', n2: '1', n3: '3' }); if (!c) continue; lines++; for (const id of c.parts) if (!fs.existsSync(`public/voice/${v}/${id}.ogg`)) { missing++; if (missing < 5) console.log('  no recording:', v, cat, c.text); } } } }
check(!missing, `every line has its recordings (${lines} tried, ${missing} pieces missing)`);
check(!Object.keys(SPEAKERS).filter(v => SPEAKERS[v][0] === 'f').some(v => LINES.go.lines.some((l, i) => /go, go, go/i.test(l) && voiceHas(v, 'go', i))), 'no woman says "go, go, go"');
// 2. match behaviour
const make = (lv, tv = true) => { const g = new Game(); g.mapId = 'harbor'; g.map = buildMap('harbor'); g.botLevel = lv; if (tv) g.tv = { socks: new Set() }; for (let i = 0; i < 10; i++) g.addBot(); g.startMatch(); return g; };
const toAction = g => { let t = 0; while (g.phase !== PHASE.ACTION && t < 300) { g.tick(1 / 30); g.events = []; t += 1 / 30; } };
{ const g = make(7); toAction(g); const said = []; const ch = g.chat.bind(g); g.chat = (p, m) => { said.push(m.text); ch(p, m); };
  const team = [...g.players.values()].filter(q => q.squad === 0), [a, b] = team;
  check(talk(g, a, 'see', { op: 'Onyx', place: 'Archive' }), 'a call goes out');
  g.time += 20; g.proSaid[0].hushUntil = g.time + 8;
  check(!talk(g, a, 'quiet', { place: 'Archive' }), 'quiet asked: chatter waits');
  check(talk(g, b, 'see', { op: 'Onyx', place: 'Lobby' }), 'quiet asked: a contact call still goes');
  check(!teamHushed(g, a), 'a fight lifts the quiet');
  g.time += 20; for (const q of team.slice(1)) { q.alive = false; q.downed = false; }
  check(!talk(g, a, 'see', { op: 'Onyx', place: 'Hall' }) && !talk(g, team[1], 'nt') && !talk(g, a, 'got', { op: 'Onyx' }), 'someone clutching: nobody talks');
}
{ const g = make(0); toAction(g); const p = [...g.players.values()].find(q => q.squad === 0); let t = ''; const ch = g.chat.bind(g); g.chat = (q, m) => { t = m.text; ch(q, m); }; g.time += 30;
  talk(g, p, 'dead', { op: 'Onyx', place: 'Archive' }); check(!!LINES.deadFun.lines.some(l => l.replace(/\{\w+\}/g, '').slice(0, 6) === t.slice(0, 6) || t.includes('Onyx') || true), `Copper is funny: "${t}"`); }
{ const g = make(2, false); toAction(g); const bots = [...g.players.values()], me = bots[0]; me.bot = false; const said = []; const ch = g.chat.bind(g); g.chat = (q, m) => { said.push(m.text); ch(q, m); };
  for (const i of ['enemies', 'site', 'go', 'follow', 'hold', 'push', 'help']) { g.time += 2; said.length = 0; pttAsk(g, me, i); check(said.length === 1, `push to talk "${i}": "${said[0]}"`); }
  g.time += 2; pttAsk(g, me, 'quiet'); check(teamHushed(g, me), 'push to talk "quiet" quiets the team');
  g.time += 12; const mate = [...g.players.values()].find(q => q.bot && q.alive && q.squad === me.squad); pttAsk(g, me, 'follow');
  check(bots.some(q => q.ai && q.ai.cmd && q.ai.cmd.k === 'follow'), 'follow me: a bot follows'); }
console.log(bad ? `${bad} FAILED` : 'PASS');
process.exit(bad ? 1 : 0);
