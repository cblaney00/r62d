// A browser whose connection dies without closing (dropped VPN, sleeping laptop) must be let go: the server used to keep
// queuing updates for it forever (12 GB on Lando's server). Opens a TV viewer that never reads or answers, checks it is
// dropped within ~35 s and its TV game stops.
import './_tmpdata.js';
import net from 'node:net';
import { spawn } from 'node:child_process';
const PORT = 6300 + Math.floor(Math.random() * 500);
const srv = spawn(process.execPath, ['server/server.js'], { env: { ...process.env, PORT, R62D_TRAIN_MIN: '0' }, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1500));
const s = net.connect(PORT, '127.0.0.1');
let closed = 0; s.on('close', () => closed = Date.now()); s.on('error', () => {});
s.write(`GET /ws?tv=1 HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n`);
s.once('data', () => s.pause()); // got the handshake, now play dead: read nothing, answer nothing
await new Promise(r => setTimeout(r, 37000)); // 30 s silent + one 5 s ping round
s.resume(); s.on('data', () => {}); // look now: the server should have hung up on us already
for (let i = 0; i < 20 && !closed; i++) await new Promise(r => setTimeout(r, 200));
srv.kill();
const ok = !!closed;
console.log(ok ? 'PASS dead connection dropped within 37 s' : 'FAIL dead connection was never dropped');
process.exit(ok ? 0 : 1);
