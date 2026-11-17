// Two people on one match over the network (he asked 2026-11-15: nothing may stop him and Lando playing over the VPN).
// Starts a server the way HOST does (every network), then two browsers' worth of connections join through this
// computer's VPN address (wg-homelab 10.10.0.x when it is up, else its first network address, never localhost), one
// with VPN-like lag (LAG ms each way). Both must: be welcomed, see each other in the lobby, get through operator select
// and preparation into the action phase, receive their own details ('mine') and moving positions for each other, and
// have their walking reach the server. Usage: node tests/vpnplay.js [lagMs]
import './_tmpdata.js';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { OPERATORS, jobOf } from '../shared/operators.js';
import { PHASE } from '../shared/constants.js';

const LAG = Number(process.argv[2] || 90), PORT = 6300 + Math.floor(Math.random() * 500);
const nets = os.networkInterfaces(), addrs = [];
for (const [name, list] of Object.entries(nets)) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) addrs.push({ name, ip: a.address });
const pick = addrs.find(a => /^10\.10\.0\./.test(a.ip)) || addrs.find(a => !/^(172\.|169\.254)/.test(a.ip)) || addrs[0];
if (!pick) { console.log('FAIL no network address on this computer'); process.exit(1); }
console.log(`joining over ${pick.name} ${pick.ip}:${PORT}, lag ${LAG} ms each way on the second player`);
const srv = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT, R62D_FAST: '1', R62D_TRAIN_MIN: '0' }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1800));

function client(name, lag) {
  const ws = new WebSocket(`ws://${pick.ip}:${PORT}/ws`), c = { name, ws, snaps: 0, me: null, last: null, mineN: 0, phases: new Set(), sawOther: 0, otherMoves: 0, otherPos: null, locked: false };
  const later = fn => lag ? setTimeout(fn, lag) : fn();
  c.send = o => later(() => ws.readyState === 1 && ws.send(JSON.stringify(o)));
  ws.onopen = () => c.send({ t: 'join', name });
  ws.onmessage = ev => later(async () => {
    const txt = typeof ev.data === 'string' ? ev.data : await ev.data.text(); const m = JSON.parse(txt);
    if (m.t === 'welcome') c.me = m.id;
    if (m.t !== 'snap') return;
    c.snaps++; c.last = m; c.phases.add(m.ph); if (m.mine) c.mineN++;
    const others = (m.players || []).filter(p => p.id !== c.me && !p.b);
    if (others.length) c.sawOther++;
    const o = others[0]; if (o && o.x !== undefined) { if (c.otherPos && Math.hypot(o.x - c.otherPos.x, o.y - c.otherPos.y) > 0.5) c.otherMoves++; c.otherPos = { x: o.x, y: o.y }; }
    const me = (m.players || []).find(p => p.id === c.me);
    if (m.ph === PHASE.SELECT && me && !c.locked && me.tm) { // choose any operator of my side, then lock in
      const op = Object.keys(OPERATORS).find(k => OPERATORS[k].team === me.tm && !(m.bn || []).includes(k));
      c.send({ t: 'place' }); c.send({ t: 'role', job: jobOf(op) }); c.send({ t: 'pick', op }); c.send({ t: 'lock' }); c.locked = true;
    }
    if (m.ph !== PHASE.SELECT) c.locked = false;
  });
  ws.onerror = () => { c.err = true; };
  return c;
}
const A = client('VpnTestBlaney', 0), B = client('VpnTestLando', LAG);
await new Promise(r => setTimeout(r, 1500));
A.send({ t: 'lobby', a: 'start' });
let seq = 0; const t0 = Date.now(), walk = setInterval(() => { for (const c of [A, B]) c.send({ t: 'input', s: ++seq, dt: 0.033, a: 0, k: { right: 1 } }); }, 33);
while (Date.now() - t0 < 40000 && !(A.phases.has(PHASE.ACTION) && B.phases.has(PHASE.ACTION) && A.otherMoves > 10 && B.otherMoves > 10)) await new Promise(r => setTimeout(r, 250));
clearInterval(walk); A.ws.close(); B.ws.close(); srv.kill();
const fails = [];
for (const c of [A, B]) {
  if (c.err) fails.push(`${c.name}: connection error`);
  if (!c.me) fails.push(`${c.name}: never welcomed`);
  if (!c.sawOther) fails.push(`${c.name}: never saw the other player`);
  if (!c.phases.has(PHASE.ACTION)) fails.push(`${c.name}: never reached the action phase (phases ${[...c.phases].join(',')})`);
  if (!c.mineN) fails.push(`${c.name}: never got their own details`);
  if (c.otherMoves <= 10) fails.push(`${c.name}: the other player hardly moved (${c.otherMoves})`);
  console.log(`${c.name}: ${c.snaps} snapshots, phases ${[...c.phases].join(',')}, other moved in ${c.otherMoves}`);
}
console.log(fails.length ? 'FAIL ' + fails.join('; ') : `PASS two players joined over ${pick.ip}, played into a round with ${LAG * 2} ms ping`);
process.exit(fails.length ? 1 : 0);
