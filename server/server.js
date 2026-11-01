// Starts R62D: serves the game page and runs the match for everyone who connects.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { attachWebSocket } from './ws.js';
import { Worker } from 'node:worker_threads';
import { training, addResults, saveTraining, needsTraining, newVersion } from './training.js';
import { Game } from './game.js';
import { store, publicProfile } from './store.js';
import { TICK_RATE, SNAP_RATE } from '../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 6262;
// Which build this server is (OPEN TO LAN shows it, so a phone can tell his own PC's game from someone else's server):
// the git commit when run from his project folder, otherwise R62D_VERSION if the packaged app sets it.
let VERSION = { id: process.env.R62D_VERSION || 'packaged', date: '' };
execFile('git', ['-C', ROOT, 'log', '-1', '--format=%h|%cs'], (err, out) => { if (!err && out.trim()) { const [id, date] = out.trim().split('|'); VERSION = { id, date }; } });
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
    // OPEN TO LAN (he asked): the home-network address first (cable, then Wi-Fi), the homelab VPN last
    for (const [dev, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal) {
      const vpn = /^wg|^tun|^tailscale/.test(dev) || a.address.startsWith('10.10.'), wifi = /^wl/.test(dev);
      urls.push({ url: `http://${a.address}:${PORT}`, vpn, net: vpn ? 'homelab VPN' : wifi ? 'Wi-Fi' : 'cable' });
    }
    const rank = u => (u.vpn ? 2 : u.net === 'Wi-Fi' ? 1 : 0);
    urls.sort((a, b) => rank(a) - rank(b));
    return json(200, { urls, host: os.hostname(), version: VERSION, port: PORT });
  }
  if (u.pathname === '/api/training') return json(200, { version: training.version, at: training.at, rounds: training.rounds, plans: training.plans, running: !!trainer, session: trainer ? trainer.rounds : 0, current: VERSION.id });
  if (u.pathname === '/api/train' && req.method === 'POST') { const r = trainCheck(true); return json(200, { running: !!trainer, why: r || '' }); } // TRAIN THE PROS button
  if (u.pathname === '/api/match') { const m = store.match(q('id')); return m ? json(200, m) : json(404, { error: 'no such match' }); }
  if (u.pathname === '/api/players') return json(200, Object.values(store.profiles).map(p => ({ id: p.id, name: p.name, matches: p.stats.matches, wins: p.stats.wins, kills: p.stats.kills, deaths: p.stats.deaths })));
  json(404, { error: 'unknown' });
}

const game = new Game();
// /ws?tut=1 gets its own private tutorial match (/ws?free=1 a free-play one), gone when that player leaves it
const tutorials = new Set();
attachWebSocket(server, '/ws', (sock, req) => {
  const tut = /[?&]tut=1/.test(req.url), free = /[?&]free=1/.test(req.url), tv = /[?&]tv=1/.test(req.url);
  if (!tut && !free && !tv) return game.connect(sock);
  const g = new Game({ tut, free, tv }); tutorials.add(g); // tv: ESPORTS TV, the pro teams playing while you watch
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

// Daily practice for the pro teams (he asked): once a day, and whenever the game's version changes, practice matches run
// in a background thread while nobody is playing (they stop the moment someone joins a match). No AI service: all here.
let trainer = null;
function trainCheck(force = false) {
  const busy = game.phase !== 'lobby' || [...tutorials].some(g => g.phase !== 'lobby'); // a match being played (people in the menus are fine)
  if (trainer && busy) { trainer.terminate(); trainer = null; return 'a match is being played'; } // someone is playing: practice another time
  if (busy) return 'a match is being played';
  if (trainer || !VERSION.id || (!force && !needsTraining(VERSION.id))) return trainer ? '' : 'already trained today';
  newVersion(VERSION.id);
  trainer = new Worker(new URL('./train-worker.js', import.meta.url), { workerData: { minutes: Number(process.env.R62D_TRAIN_MIN) || 20 } }); trainer.rounds = 0;
  trainer.on('message', m => { if (m.done) { training.version = VERSION.id; training.at = Date.now(); console.log(`Pro teams trained on version ${VERSION.id}: ${training.rounds} practice rounds so far.`); } else { addResults(m); if (trainer) trainer.rounds += m.rounds || 0; } saveTraining(); });
  trainer.on('error', e => console.log('Pro training stopped:', e.message));
  trainer.on('exit', () => { trainer = null; });
}
setInterval(trainCheck, 5 * 60 * 1000); setTimeout(trainCheck, 60 * 1000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`R62D is running.  On this computer open:  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  Friends on the same network open:  http://${a.address}:${PORT}`);
});
