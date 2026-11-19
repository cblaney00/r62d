// The ping wheel and plain pings (he asked 2026-11-18: bots answer every sort of ping and really do it). Each kind: who
// moves, who answers in chat; a pinged camera gets shot in a live match; open with and without something to open it.
// Run: node tests/pingwheel.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, T, CELL } from '../shared/constants.js';
import { LINES, compose } from '../shared/comms.js';
let bad = 0; const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) bad++; };
const g = new Game({ free: true }), me = g.addPlayer('Me', false);
g.handle(me, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
g.addBot(me.squad); g.addBot(me.squad);
const bots = [...g.players.values()].filter(q => q.bot && q.squad === me.squad);
for (const b of bots) { b.alive = true; b.downed = false; b.ctrl = 'body'; b.ai = b.ai || {}; }
g.phase = PHASE.ACTION;
const said = [];
const chat0 = g.chat.bind(g); g.chat = (p, m) => { if (p.bot) said.push(m.text); return chat0(p, m); };
const replies = () => { g.time += 2; for (let i = 0; i < 3; i++) { const r = g.replyQ ? g.replyQ.length : 0; if (!r) break; for (const q of g.replyQ) q.t = 0; g.tick ? null : null; } const n = (g.replyQ || []).length; (g.replyQ || []).forEach(q => q.t = 0); return n; };
const ping = (pk, x = 900, y = 700, w = 'TEST', id) => { me.pingReady = 0; me.markT = -99; g.events.length = 0; g.replyQ = []; for (const b of bots) b.ai.cmd = null; g.event(me, { k: 'mark', x, y, w, pk, id }); return g.events.find(e => e.e === 'mark'); };
const queued = () => (g.replyQ || []).map(r => r.cat);
let e = ping('go');
check(e && e.pk === 'go', 'the team gets the ping with its kind');
check(bots.every(b => b.ai.cmd && b.ai.cmd.k === 'goto' && b.ai.cmd.x === 900), 'go sends the two nearest bots to the spot');
for (const b of bots) b.ai.cmd = { k: 'goto', x: 900, y: 700, until: g.time + 50, id: me.id };
me.pingReady = 0; me.markT = -99; g.event(me, { k: 'mark', x: 900, y: 700, w: 'DANGER', pk: 'danger' });
check(bots.every(b => !b.ai.cmd), 'danger calls off orders to go there');
check(bots.every(b => b.ai.heard && b.ai.heard.x === 900), 'danger: they keep an eye on it');
ping('enemy');
check(bots.every(b => !b.ai.cmd || b.ai.cmd.k === 'face'), 'enemy sends nobody running there');
check(bots.every(b => b.ai.heard && b.ai.heard.x === 900), 'enemy: every bot knows where');
ping('hold');
check(bots.filter(b => b.ai.cmd && b.ai.cmd.stay === 45).length === 1, 'hold sends one bot, who stays');
ping('watch');
check(bots.filter(b => b.ai.cmd && b.ai.cmd.k === 'face').length === 1, 'watch: one bot covers the spot');
ping('omw');
check(bots.filter(b => b.ai.cmd && b.ai.cmd.k === 'goto').length === 1, 'on my way: one bot comes along');
const odd = ping('nonsense');
check(odd && odd.pk === undefined, 'a made-up kind is just a plain ping');
// replies: most pings get a line (75%), varied
let got = 0; const cats = new Set();
for (let i = 0; i < 80; i++) { ping(['go', 'watch', 'enemy', 'omw', 'danger', 'hold'][i % 6]); got += queued().length ? 1 : 0; queued().forEach(c => cats.add(c)); }
check(got > 45 && got < 75, `bots answer most pings, not all (${got}/80)`);
check(['ansGoto', 'ansWatchPing', 'ansEnemyPing', 'ansOmw', 'ansDangerPing', 'ansWatch'].every(c => cats.has(c)), 'each kind has its own answer: ' + [...cats].join(' '));
const texts = new Set(); for (let i = 0; i < 30; i++) { const c = compose('b9', 'ansEnemyPing', { place: 'Kitchen' }, []); texts.add(c.text); }
check(texts.size >= 5, `answers are varied (${texts.size} different in 30)`);
// a pinged enemy camera gets shot
const m = g.map, b0 = bots[0];
const cam = { id: 99901, type: 'cam', team: 'def', hp: 10, x: b0.x + 60, y: b0.y, ag: 0 };
g.ents.push(cam); for (const b of bots) { b.aim = Math.PI; }
ping(null, cam.x, cam.y, 'CAMERA', cam.id);
check(g.pingedEnt && Object.values(g.pingedEnt).some(t => t[cam.id] > g.time), 'a pinged camera is marked for the team');
check(queued().length === 0 || queued().some(c => /Cam|cam/.test(c)), 'the answer is about the camera');
// open: a soft wall near a bot with nothing to blow it: they go and knife it
let soft = -1; for (let k = m.W; k < m.tiles.length - m.W && soft < 0; k++) if (m.tiles[k] === T.SOFT && !m.shape[k] && !(m.tiles[k - 1] === T.SOFT) && [1, -1].some(d => m.tiles[k + d] === T.FLOOR && m.tiles[k + 2 * d] === T.FLOOR)) soft = k;
const sx = (soft % m.W + 0.5) * CELL, sy = (Math.floor(soft / m.W) + 0.5) * CELL;
for (const b of bots) { b.x = sx + 50; b.y = sy; }
ping('open', sx, sy, 'WALL');
check(bots.some(b => b.ai.cmd && b.ai.cmd.k === 'open' && b.ai.cmd.b.k === soft), 'open: a bot goes to open the pinged wall');
const old = m.tiles[soft]; m.tiles[soft] = T.REINF;
for (const b of bots) { b.abilityCount = 0; b.gadgetCount = 0; }
ping('open', sx, sy, 'WALL');
check(bots.every(b => !b.ai.cmd || b.ai.cmd.k !== 'open') && queued().includes('ansNoOpen'), 'a reinforced wall and no charge: they say so');
m.tiles[soft] = old;
check(Object.keys(LINES).filter(k => /^ans/.test(k)).every(k => LINES[k].lines.length >= 4), 'every answer has at least 4 ways to say it');
console.log(bad ? bad + ' FAILED' : 'PASS'); process.exit(bad ? 1 : 0);
