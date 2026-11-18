// A game update's shared end is compressed once for everyone (server/ws.js sendJoined): each player's message, unpacked
// the way a browser unpacks permessage-deflate, must be exactly the plain text. Also prints what it saves.
// Run: node tests/wsjoin.js
import './_tmpdata.js';
import zlib from 'node:zlib';
import { Socket } from '../server/ws.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
// a Socket over a fake connection that keeps every frame written to it
const fakeConn = () => { const c = { out: [], writableLength: 0, setNoDelay() {}, setKeepAlive() {}, on() { return c; }, write(b) { c.out.push(Buffer.from(b)); }, destroy() {} }; return c; };
const unframe = b => { // one server frame -> its text
  const zip = !!(b[0] & 0x40); let len = b[1] & 0x7f, at = 2;
  if (len === 126) { len = b.readUInt16BE(2); at = 4; } else if (len === 127) { len = Number(b.readBigUInt64BE(2)); at = 10; }
  const p = b.subarray(at, at + len);
  return { zip, text: zip ? zlib.inflateRawSync(Buffer.concat([p, Buffer.from([0, 0, 0xff, 0xff])]), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8') : p.toString('utf8') };
};

// a real match: ten bots, four of them with compressing sockets, one with a plain one
const g = new Game(); g.mapId = 'harbor'; g.map = buildMap('harbor'); g.botLevel = 7;
for (let i = 0; i < 10; i++) g.addBot();
const ps = [...g.players.values()], conns = [];
ps.forEach((p, i) => { if (i < 5) { const c = fakeConn(), s = new Socket(c, i < 4); clearInterval(s.beat); s.on('error', () => {}); conns.push([p, c, s]); p.sock = s; } });
const plain = [], fake = p => ({ open: true, send: t => plain.push([p.id, t]) });
g.startMatch();
let joined = 0, zipT = 0, oldT = 0, sent = 0, oldSent = 0;
for (let i = 0; i < 30 * 60; i++) {
  g.tick(1 / 30); if (i % 3 === 2) continue;
  for (const [, c] of conns) c.out.length = 0;
  const t0 = performance.now(); g.broadcast(); zipT += performance.now() - t0;
  for (const [p, c, s] of conns) {
    const f = c.out.map(unframe).find(m => m.text.startsWith('{"t":"snap"'));
    if (!f) { fail('no update for', p.id); continue; }
    let m; try { m = JSON.parse(f.text); } catch (e) { fail('update does not unpack to JSON', p.id, e.message); continue; }
    if (m.you !== p.id) fail('update for the wrong player', p.id, m.you);
    if (s.deflate && !f.zip) fail('a compressing socket got plain text');
    if (s.deflate) joined++;
    if (s.deflate) sent += c.out.reduce((a, b) => a + b.length, 0);
    // what the old way (the whole update compressed for each player) would have cost
    if (s.deflate) { const t1 = performance.now(); oldSent += zlib.deflateRawSync(Buffer.from(f.text), { level: 3, finishFlush: zlib.constants.Z_SYNC_FLUSH }).length - 4 + 4; /* (minus the flush end, plus the frame head) */ oldT += performance.now() - t1; }
  }
}
// the joined message must be exactly what a plain socket gets for that player
{ const [p, , s] = conns[0]; p.sock = fake(p); g.broadcast(); const want = plain.at(-1)[1]; p.sock = s; conns[0][1].out.length = 0;
  // the same state again (nothing moved) through the compressing socket
  g.broadcast(); const got = conns[0][1].out.map(unframe).find(m => m.text.startsWith('{"t":"snap"'));
  const strip = t => t.replace(/"tm":[\d.]+|"time":[\d.]+/g, ''); if (!got || strip(got.text) !== strip(want)) fail('joined text differs from the plain text'); }
console.log(`${joined} compressed updates unpacked fine; per broadcast: ${(zipT / (30 * 40)).toFixed(3)} ms all in (4 compressing players), the old per-player compressing ${(oldT / (30 * 40)).toFixed(3)} ms; bytes ${(sent / oldSent * 100).toFixed(0)}% of the old size`);
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
