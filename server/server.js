// Starts R62D: serves the game page and runs the match for everyone who connects.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { attachWebSocket } from './ws.js';
import { Game } from './game.js';
import { store, publicProfile } from './store.js';
import { TICK_RATE, SNAP_RATE } from '../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 6262;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return api(req, res);
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  const base = url.startsWith('/shared/') ? ROOT : path.join(ROOT, 'public');
  const file = path.normalize(path.join(base, url));
  if (!file.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// Saved profiles and match history, read by the Profile and Operators pages.
function api(req, res) {
  const u = new URL(req.url, 'http://x'), q = k => u.searchParams.get(k);
  const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify(o)); };
  const summary = m => ({ id: m.id, date: m.date, duration: m.duration, map: m.map, mode: m.mode, score: m.score, winner: m.winner, players: m.players });
  if (u.pathname === '/api/profile') {
    const p = q('token') ? store.byToken(q('token')) : store.byId(q('id'));
    if (!p) return json(404, { error: 'no such profile' });
    return json(200, { profile: publicProfile(p), matches: store.matchesFor(p.id, 40).map(summary) });
  }
  // "Quit to desktop": closes the full-screen game window on this computer only (the server keeps running for friends).
  if (u.pathname === '/api/quit') {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if (!local) return json(403, { error: 'only on the game computer' });
    json(200, { ok: true });
    setTimeout(() => execFile('pkill', ['-f', 'r62d/firefox-kiosk'], () => {}), 300);
    return;
  }
  // the addresses friends type to join this server (shown in the lobby)
  if (u.pathname === '/api/addr') {
    const urls = [];
    for (const [dev, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) urls.push({ url: `http://${a.address}:${PORT}`, vpn: /^wg|^tun/.test(dev) || a.address.startsWith('10.10.') });
    urls.sort((a, b) => b.vpn - a.vpn); // the homelab VPN address first: that's how friends join from outside
    return json(200, { urls });
  }
  if (u.pathname === '/api/match') { const m = store.match(q('id')); return m ? json(200, m) : json(404, { error: 'no such match' }); }
  if (u.pathname === '/api/players') return json(200, Object.values(store.profiles).map(p => ({ id: p.id, name: p.name, matches: p.stats.matches, wins: p.stats.wins, kills: p.stats.kills, deaths: p.stats.deaths })));
  json(404, { error: 'unknown' });
}

const game = new Game();
// /ws?tut=1 gets its own private tutorial match (/ws?free=1 a free-play one), gone when that player leaves it
const tutorials = new Set();
attachWebSocket(server, '/ws', (sock, req) => {
  const tut = /[?&]tut=1/.test(req.url), free = /[?&]free=1/.test(req.url);
  if (!tut && !free) return game.connect(sock);
  const g = new Game({ tut, free }); tutorials.add(g);
  g.onEmpty = () => tutorials.delete(g);
  g.connect(sock);
});

let last = performance.now(), acc = 0, snapAcc = 0;
setInterval(() => {
  const now = performance.now();
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  const dt = 1 / TICK_RATE;
  while (acc >= dt) {
    acc -= dt; game.tick(dt); for (const g of tutorials) g.tick(dt);
    snapAcc += dt;
    if (snapAcc >= 1 / SNAP_RATE - 1e-6) { snapAcc = 0; game.broadcast(); for (const g of tutorials) g.broadcast(); }
  }
}, 1000 / 120);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`R62D is running.  On this computer open:  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  Friends on the same network open:  http://${a.address}:${PORT}`);
});
