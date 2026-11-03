// Esports TV someone leaves (he asked): the server keeps it paused for a while (20 s; 3 s here) so coming straight back
// resumes the same broadcast, then closes it. Checks: back in time = same match, not moved on while away; too late = a new one.
import './_tmpdata.js';
import { spawn } from 'node:child_process';
const PORT = 6300 + Math.floor(Math.random() * 500), HOLD = 3000, key = 'tvhold' + Math.floor(Math.random() * 1e6);
const srv = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT, R62D_TRAIN_MIN: '0', R62D_TV_HOLD_MS: HOLD }, stdio: 'ignore' });
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(1500);
// open a TV viewer, optionally start a match, return the first snapshot after `ms`
async function watch(start, ms) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws?tv=1&key=${key}`); let last = null;
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.t === 'welcome') { if (start) ws.send(JSON.stringify({ t: 'tv', a: 'start', map: null, level: 7, req: [] })); } else if (m.t === 'snap') last = m; };
  await new Promise(r => ws.onopen = r); ws.send(JSON.stringify({ t: 'join', name: 'TvHoldTest' }));
  await wait(ms); ws.close(); await wait(200);
  return { mp: last && last.mp, ph: last && last.ph, rd: last && last.rd, tm: last && last.tm, n: last ? last.players.length : 0 };
}
const a = await watch(true, 2500); // a match running
await wait(1000);
const b = await watch(false, 400); // back within the hold: the same match, carried on from where it was
await wait(HOLD + 1500);
const c = await watch(false, 400); // too late: a fresh TV, nothing running
srv.kill();
const fails = [];
if (!(a.n >= 10 && a.ph !== 'lobby')) fails.push(`no match ran at first (${JSON.stringify(a)})`);
if (!(b.mp === a.mp && b.n === a.n && b.ph === a.ph && b.rd === a.rd)) fails.push(`coming back in time was not the same match (${JSON.stringify(a)} → ${JSON.stringify(b)})`);
if (!(Math.abs(a.tm - b.tm) < 1.5)) fails.push(`the clock ran while nobody watched (${a.tm} → ${b.tm})`);
if (!(c.n === 0 && c.ph === 'lobby')) fails.push(`the held match was not closed after the hold (${JSON.stringify(c)})`);
console.log(fails.length ? 'FAIL\n' + fails.join('\n') : `PASS back in time resumes the same paused match (${a.mp}, round ${b.rd}); after the hold it is gone`);
process.exit(fails.length ? 1 : 0);
