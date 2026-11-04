// Starts R62D: serves the game page and runs the match for everyone who connects.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { attachWebSocket } from './ws.js';
import { Worker } from 'node:worker_threads';
import dgram from 'node:dgram';
import { training, addResults, saveTraining, needsTraining, newVersion, roundsLeft } from './training.js';
import { Game } from './game.js';
const perfLog = [];
import { store, publicProfile } from './store.js';
import { TICK_RATE, SNAP_RATE } from '../shared/constants.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 6262;
// R62D_BIND 127.0.0.1 = this computer only (the program's PLAY); openTo('0.0.0.0') opens it to the network (HOST)
let BIND = process.env.R62D_BIND || '0.0.0.0';
const FIND_PORT = 6264; // JOIN in the program asks the network "R62D?" on this UDP port; servers open to the network answer
// Which build this server is (OPEN TO LAN shows it, so a phone can tell his own PC's game from someone else's server):
// the git commit when run from his project folder, otherwise R62D_VERSION if the packaged app sets it.
let VERSION = { id: process.env.R62D_VERSION || 'packaged', date: '' };
execFile('git', ['-C', ROOT, 'log', '-1', '--format=%h|%cs'], (err, out) => { if (!err && out.trim()) { const [id, date] = out.trim().split('|'); VERSION = { id, date }; } });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.tar.gz': 'application/gzip', '.gz': 'application/gzip' };

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
    return json(200, { urls, host: os.hostname(), version: VERSION, port: PORT, players: humans(), local: BIND === '127.0.0.1' });
  }
  if (u.pathname === '/api/miclog' && req.method === 'POST') { // what the microphone heard (words only, no sound), so it can be tuned to a real voice; the last 300 lines, on this computer
    let b = ''; req.on('data', d => { if (b.length < 600) b += d; }); req.on('end', () => { try { const f = path.join(process.env.R62D_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data'), 'mic-log.txt'); const lines = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(-299) : []; lines.push(new Date().toISOString() + ' ' + String(b).replace(/\s+/g, ' ').slice(0, 500)); fs.writeFile(f, lines.join('\n') + '\n', () => {}); } catch {} res.writeHead(204); res.end(); });
    return;
  }
  if (u.pathname === '/api/perf') { // browsers report how smoothly they run (see perfRep in main.js)
    if (req.method !== 'POST') return json(200, perfLog);
    let b = ''; req.on('data', d => { if (b.length < 8000) b += d; }); req.on('end', () => { try { perfLog.push({ ip: req.socket.remoteAddress, ...JSON.parse(b) }); if (perfLog.length > 200) perfLog.shift(); } catch {} json(200, { ok: true }); });
    return;
  }
  if (u.pathname === '/api/training') return json(200, { version: training.version, at: training.at, rounds: training.rounds, verRounds: training.verRounds || 0, perVersion: 200, plans: training.plans, ops: training.ops, opx: training.opx, running: !!trainer, session: trainer ? trainer.rounds : 0, current: VERSION.id });
  if (u.pathname === '/api/train' && req.method === 'POST') { const r = trainCheck(true); return json(200, { running: !!trainer, why: r || '' }); } // TRAIN THE PROS button
  if (u.pathname === '/api/match') { const m = store.match(q('id')); return m ? json(200, m) : json(404, { error: 'no such match' }); }
  if (u.pathname === '/api/players') return json(200, Object.values(store.profiles).map(p => ({ id: p.id, name: p.name, matches: p.stats.matches, wins: p.stats.wins, kills: p.stats.kills, deaths: p.stats.deaths })));
  json(404, { error: 'unknown' });
}

const game = new Game();
// /ws?tut=1 gets its own private tutorial match (/ws?free=1 a free-play one), gone when that player leaves it
const tutorials = new Set();
// ESPORTS TV someone left (he asked): kept 20 s, paused, in case they come straight back (same key = the same broadcast),
// then closed so it never slows down a real match
const TV_HOLD_MS = +process.env.R62D_TV_HOLD_MS || 20000, heldTv = new Map();
attachWebSocket(server, '/ws', (sock, req) => {
  const tut = /[?&]tut=1/.test(req.url), free = /[?&]free=1/.test(req.url), tv = /[?&]tv=1/.test(req.url);
  if (!tut && !free && !tv) return game.connect(sock);
  const key = tv ? (/[?&]key=([a-z0-9]{6,24})(&|$)/.exec(req.url) || [])[1] : null;
  if (key && heldTv.has(key)) { const g = heldTv.get(key); heldTv.delete(key); g.heldUntil = 0; return g.connect(sock); }
  const g = new Game({ tut, free, tv }); tutorials.add(g); // tv: ESPORTS TV, the pro teams playing while you watch
  g.onEmpty = tv ? () => { g.heldUntil = Date.now() + TV_HOLD_MS; if (key) heldTv.set(key, g); } : () => tutorials.delete(g);
  g.tvKey = key;
  g.connect(sock);
});
const held = g => { // a TV nobody is watching: paused; gone after its 20 s
  if (!g.heldUntil) return false;
  if (Date.now() > g.heldUntil) { tutorials.delete(g); if (heldTv.get(g.tvKey) === g) heldTv.delete(g.tvKey); }
  return true;
};

let last = performance.now(), acc = 0, snapAcc = 0;
setInterval(() => {
  const now = performance.now();
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  const dt = 1 / TICK_RATE;
  while (acc >= dt) {
    acc -= dt; game.tick(dt); for (const g of tutorials) if (!held(g)) g.tick(dt);
    snapAcc += dt;
    if (snapAcc >= 1 / SNAP_RATE - 1e-6) { snapAcc = 0; game.broadcast(); for (const g of tutorials) if (!g.heldUntil) g.broadcast(); }
  }
}, 1000 / 120);

// Practice for the pro teams (he asked): 200 rounds whenever the game's version changes (not daily any more); they run
// in a background thread while nobody is playing (they stop the moment someone joins a match). No AI service: all here.
let trainer = null;
function trainCheck(force = false) {
  const busy = game.phase !== 'lobby' || [...tutorials].some(g => g.phase !== 'lobby' && !g.heldUntil); // a match being played (people in the menus are fine)
  if (trainer && busy) { trainer.terminate(); trainer = null; return 'a match is being played'; } // someone is playing: practice another time
  if (busy) return 'a match is being played';
  if (trainer || !VERSION.id) return '';
  newVersion(VERSION.id);
  if (!needsTraining(VERSION.id)) return `they have done their ${training.verRounds} rounds on this version`;
  trainer = new Worker(new URL('./train-worker.js', import.meta.url), { resourceLimits: { maxOldGenerationSizeMb: 512 }, workerData: { minutes: Number(process.env.R62D_TRAIN_MIN) || 60, rounds: roundsLeft(VERSION.id) } }); trainer.rounds = 0;
  trainer.on('message', m => { if (m.done) { training.at = Date.now(); console.log(`Pro teams trained on version ${VERSION.id}: ${training.rounds} practice rounds so far.`); } else { addResults(m); if (trainer) trainer.rounds += m.rounds || 0; } saveTraining(); });
  trainer.on('error', e => console.log('Pro training stopped:', e.message));
  trainer.on('exit', () => { trainer = null; });
}
setInterval(trainCheck, 5 * 60 * 1000); setTimeout(trainCheck, 60 * 1000);

const humans = () => [...game.players.values()].filter(p => !p.bot).length;

// answers "R62D?" from programs looking for games (not while this computer only)
let finder = null;
function answerFinders() {
  if (finder || BIND === '127.0.0.1') return;
  finder = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  finder.on('error', () => { try { finder.close(); } catch {} finder = null; });
  finder.on('message', (m, from) => {
    if (m.toString() !== 'R62D?') return;
    finder.send(JSON.stringify({ r62d: 1, port: PORT, host: os.hostname(), version: VERSION.id, players: humans() }), from.port, from.address);
  });
  finder.bind(FIND_PORT);
}
export function openTo(bind) {
  if (bind === BIND) return Promise.resolve();
  BIND = bind;
  server.close(); // stops listening now; games already connected carry on
  return new Promise((ok, no) => server.listen(PORT, BIND, () => { answerFinders(); ok(); }).once('error', no));
}
answerFinders();

server.listen(PORT, BIND, () => {
  console.log(`R62D is running.  On this computer open:  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) console.log(`  Friends on the same network open:  http://${a.address}:${PORT}`);
});
