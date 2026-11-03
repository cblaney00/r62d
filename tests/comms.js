// Bots understand what people tell them, typed or spoken, answer in chat and really do it. Lines vary a lot, nobody talks
// in a clutch, and a call for quiet is respected. Run: node tests/comms.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { botHear, flushReplies, talk, teamHushed } from '../server/bots.js';
import { parseCommand } from '../shared/commands.js';
import { LINES, CAST, compose } from '../shared/comms.js';
import { PHASE, TEAM, CELL, PX_PER_M, DUR } from '../shared/constants.js';
import { floorAt, roomAt } from '../shared/map.js';
let bad = 0; const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
const ctx = { rooms: ['1F Kitchen', '2F Main Office', 'Lobby', 'Server Room', 'Stairs'], ops: ['EMBER', 'ONYX'], enemyOps: ['EMBER'], mates: [{ id: 'p2', name: 'Kaze', op: 'ONYX' }, { id: 'p3', name: 'Moth', op: 'RUSH' }] };
const T = {
  enemies: ['where are they', 'where are the enemies', 'any info', 'what do you see', 'uh where are they at', 'anyone see them?', 'anything on cams', 'where is everyone', 'who do you see'],
  count: ['how many are left', 'how many left', 'who is alive'], time: ['how much time is left', 'how long left'],
  go: ['where should I go', 'what should i do', 'where do you want me'], plan: ["what's the plan", 'whats the strat', 'what are we doing'],
  carrier: ['who has the defuser', "who's got the bomb"], site: ['where is the site', 'where is the objective', 'which site', 'do we know the site'],
  status: ['are you good', 'you ok', 'what is your health'], whereyou: ['where are you', 'where you at', 'what are you doing'],
  follow: ['follow me', 'come with me', 'cover me', 'stay with me', 'on me', 'watch my back', 'kaze follow me'],
  hold: ['hold here', 'wait here', 'stay there', 'stop', 'do not move', 'wait'], push: ['push', 'go in now', 'everyone push', "let's go", 'attack', 'move up', 'rush'],
  flank: ['flank them', 'go around', 'other side', 'get behind them'], fallback: ['fall back', 'retreat', 'get back'], regroup: ['regroup', 'group up', 'regroup on me'],
  goto: ['go to the kitchen', 'check the kitchen', 'head to the lobby', 'kaze go to the server room', 'go upstairs', 'get to site', 'kitchen', 'rotate to main office'],
  watch: ['watch the lobby', 'hold the kitchen', 'cover the server room', 'moth watch site'],
  report: ['enemy in the kitchen', 'one in the lobby', 'ember in the kitchen', 'ember kitchen', 'someone in the server room', 'i see one in the lobby', 'heard footsteps in the kitchen'],
  help: ['help', 'help me', 'need backup', 'come here'], revive: ['revive me', 'pick me up', "i'm down"], plant: ['plant it', 'put it down', 'plant the defuser'], defuse: ['defuse it', 'tap it', 'retake'],
  smoke: ['throw a smoke', 'smoke the kitchen'], stun: ['throw a flash', 'flash it', 'stun the lobby'], frag: ['frag the kitchen'], reinforce: ['reinforce the walls', 'reinforce'], drone: ['drone the kitchen', 'scout the lobby', 'send your drone'],
  quiet: ['be quiet', 'shut up', 'stop talking'], thanks: ['thanks', 'good job', 'nice shot'], cancel: ['forget it', 'never mind', 'stop following'], hello: ['hello', 'hey team'], insult: ['you suck'], sorry: ['my bad'],
};
let fails = 0, total = 0; for (const k in T) for (const s of T[k]) { total++; const r = parseCommand(s, ctx); if (r.intent !== k) { fails++; console.log(`  "${s}" read as ${r.intent}, wanted ${k}`); } }
check(!fails, `${total - fails} of ${total} sentences understood`);
check(parseCommand('kaze follow me', ctx).who[0] === 'p2', 'a name picks that bot');
check(parseCommand('onyx hold here', ctx).who[0] === 'p2', 'an operator name picks that bot');
check(parseCommand('everyone push', ctx).all, '"everyone" means everyone');
check(parseCommand('go to the kitchen', ctx).room === '1F Kitchen', 'finds the room');
check(!parseCommand('banana sandwich', ctx).intent, 'nonsense is not a command');
// variety
const cats = Object.keys(LINES), few = cats.filter(c => LINES[c].lines.length < 5);
check(!few.length, `every kind of line has several ways (${cats.length} kinds, ${cats.reduce((n, c) => n + LINES[c].lines.length, 0)} lines, casters ${Object.values(CAST).reduce((n, c) => n + c.lines.length, 0)}); short: ${few.join(' ')}`);
{ const seen = new Set(), rec = []; for (let i = 0; i < 12; i++) seen.add(compose('Kaze', 'ansFollow', {}, rec).text); check(seen.size >= 9, `a person doesn't repeat soon (${seen.size} different of 12)`); }
// in a live match
function make(side = TEAM.ATK) {
  const g = new Game({ free: false }); g.botLevel = 2;
  for (let i = 0; i < 10; i++) g.addBot(i % 2);
  g.startMatch(); for (const p of g.players.values()) if (p.op == null) g.pickOp?.(p, null);
  let guard = 0; while (g.phase !== PHASE.ACTION && guard++ < 6000) g.tick(1 / 30);
  const team = [...g.players.values()].filter(q => g.side(q) === side), me = team[0]; me.bot = false; me.hold = {}; me.ai = null;
  const said = []; const ch = g.chat.bind(g); g.chat = (q, m) => { if (q.squad === me.squad) said.push(`${q.name}: ${m.text}`); ch(q, m); };
  return { g, me, said, team };
}
const answer = (g, said, me, text) => { said.length = 0; g.time += 3; const c = botHear(g, me, text); g.time += 2; flushReplies(g); return c; };
const A = make(TEAM.ATK), D = make(TEAM.DEF);
for (const [w, t] of [[A, 'where are they'], [A, 'how many are left'], [A, 'how much time is left'], [A, 'whats the plan'], [A, 'where is the site'], [A, 'where are you'], [A, 'are you good'], [A, 'who has the defuser'], [A, 'follow me'], [A, 'hold here'], [A, 'push'], [A, 'flank them'], [A, 'fall back'], [A, 'throw a smoke'], [A, 'plant it'], [A, 'send your drone'], [D, 'defuse it'], [D, 'reinforce the walls'], [D, 'plant it'], [A, 'blah blah blah']]) {
  const c = answer(w.g, w.said, w.me, t); const talks = t.startsWith('blah') ? w.said.length === 0 : w.said.length >= 1;
  check(talks, `"${t}" → ${c.intent}: ${w.said[0] || '(silence)'}`);
}
{ const c = botHear(A.g, A.me, 'asdf qwer', true); A.g.time += 2; A.said.length = 0; flushReplies(A.g); check(A.said.length === 1, 'not understood on the mic: a bot says so: ' + A.said[0]); }
check(A.team.filter(q => q !== A.me).some(q => q.ai && q.ai.cmd), 'orders stick to a bot');
{ // a bot told to go to a room gets there
  const { g, me } = make(TEAM.DEF), b = [...g.players.values()].find(q => q.bot && q.alive && q.squad === me.squad);
  g.free = true; for (const q of [...g.players.values()]) if (q.squad !== me.squad || (q !== me && q !== b)) g.players.delete(q.id);
  g.timer = 150; const fl = floorAt(g.map, b.x, b.y), r = g.map.rooms.filter(r => r.fl === fl && r.w * r.h > 20).sort((x, y) => Math.hypot(y.x - b.x / CELL, y.y - b.y / CELL) - Math.hypot(x.x - b.x / CELL, x.y - b.y / CELL))[0];
  const name = r.name.replace(/^\dF /, ''); me.x = b.x; me.y = b.y; const c = botHear(g, me, `${b.name.replace(/^\[\w+\] /, '')} go to ${name}`);
  let at = null; for (let i = 0; i < 40 * 30 && !at; i++) { g.timer = 100; g.tick(1 / 30); if (b.ai.cmd && Math.hypot(b.ai.cmd.x - b.x, b.ai.cmd.y - b.y) < 1.5 * PX_PER_M) at = i; }
  check(c.intent === 'goto' && at !== null, `told "${name}" (${c.intent}): got there in ${at === null ? 'never' : (at / 30).toFixed(1) + ' s'}`);
}
{ const { g, me, team } = make(TEAM.ATK), [a, b] = team.filter(q => q !== me); g.time += 30; check(talk(g, a, 'see', { op: 'Onyx', place: 'Archive' }), 'a call goes out'); g.time += 20; answer(g, [], me, 'be quiet'); check(teamHushed(g, a), '"be quiet" quiets the team'); g.time += 1; check(!talk(g, b, 'quiet', { place: 'Archive' }), 'quiet asked: chatter waits'); }
{ const { g, me, team } = make(TEAM.ATK); g.time += 30; for (const q of team) if (q !== team[1]) { q.alive = false; q.downed = false; } check(!talk(g, team[1], 'see', { op: 'Onyx', place: 'Hall' }), 'someone clutching: nobody talks'); }
console.log(bad ? `${bad} FAILED` : 'PASS'); process.exit(bad ? 1 : 0);
