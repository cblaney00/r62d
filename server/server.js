// Starts R62D: serves the game page and runs the match for everyone who connects.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { attachWebSocket } from './ws.js';
import { Worker } from 'node:worker_threads';
import dgram from 'node:dgram';
import { training, addResults, saveTraining, needsTraining, newVersion, roundsLeft, playVersion } from './training.js';
import { Game } from './game.js';
const perfLog = [];
import { store, publicProfile } from './store.js';
import { TICK_RATE, SNAP_RATE } from '../shared/constants.js';
import { makeCode } from '../shared/joincode.js';

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
  // Full screen / windowed for the game window on this computer (he asked). play.sh tells the server how: R62D_HYPRCTL (the
  // desktop) and R62D_WINFILE (where the choice is kept for next time; it holds "windowed" or nothing).
  if (u.pathname === '/api/window') {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress), hc = process.env.R62D_HYPRCTL;
    if (!local || !hc) return json(200, { can: false });
    if (req.method !== 'POST') return json(200, { can: true });
    if (u.searchParams.has('save')) { try { fs.writeFileSync(process.env.R62D_WINFILE, u.searchParams.get('save') === 'windowed' ? 'windowed' : ''); } catch {} return json(200, { ok: true }); }
    execFile(hc, ['activewindow', '-j'], (err, out) => {
      let w = null; try { w = JSON.parse(out); } catch {}
      if (err || !w || w.class !== 'firefox') return json(200, { ok: false }); // only ever the game window, which the click came from
      execFile(hc, ['--batch', w.fullscreen ? 'dispatch fullscreen 0; dispatch setfloating active; dispatch resizeactive exact 1280 720; dispatch centerwindow' : 'dispatch fullscreen 0'], () => json(200, { ok: true }));
    });
    return;
  }
  // the addresses friends type to join this server (shown in the lobby)
  if (u.pathname === '/api/addr') {
    const urls = [];
    // OPEN TO LAN (he asked: always the right VPN, whatever else he is connected to): read fresh on every ask, so it
    // follows the VPN going on or off. The homelab VPN (wg-homelab, 10.10.0.x) first whenever it is up, then any other
    // VPN, then the home network (cable, then Wi-Fi). Virtual networks (containers, virtual machines) are left out.
    for (const [dev, list] of Object.entries(os.networkInterfaces())) for (const a of list || []) if (a.family === 'IPv4' && !a.internal && !/^(docker|br-|veth|virbr|vboxnet|vmnet|lxc|podman|cni)/.test(dev)) {
      const homelab = dev === 'wg-homelab' || a.address.startsWith('10.10.0.'), vpn = homelab || /^(wg|tun|tap|tailscale|zt|nordlynx|proton|mullvad)/.test(dev), wifi = /^wl/.test(dev);
      urls.push({ url: `http://${a.address}:${PORT}`, code: makeCode(a.address, PORT), vpn, homelab, net: homelab ? 'homelab VPN' : vpn ? `VPN (${dev})` : wifi ? 'Wi-Fi' : 'cable' });
    }
    const rank = u => (u.homelab ? 0 : u.vpn ? 1 : u.net === 'Wi-Fi' ? 3 : 2);
    urls.sort((a, b) => rank(a) - rank(b));
    res.setHeader('Access-Control-Allow-Origin', '*'); // JOIN on a friend's copy checks this game is here before going to it
    return json(200, { urls, host: os.hostname(), version: VERSION, port: PORT, players: humans(), local: BIND === '127.0.0.1' });
  }
  if (u.pathname === '/api/perf') { // browsers report how smoothly they run (see perfRep in main.js)
    if (req.method !== 'POST') return json(200, perfLog);
    let b = ''; req.on('data', d => { if (b.length < 8000) b += d; }); req.on('end', () => { try { perfLog.push({ ip: req.socket.remoteAddress, ...JSON.parse(b) }); if (perfLog.length > 200) perfLog.shift(); } catch {} json(200, { ok: true }); });
    return;
  }
  if (u.pathname === '/api/training') return json(200, { version: training.version, at: training.at, rounds: training.rounds, verRounds: training.verRounds || 0, perVersion: 200, plans: training.plans, ops: training.ops, opx: training.opx, guns: training.guns, att: training.att, pro: training.pro, running: !!trainer, session: trainer ? trainer.rounds : 0, current: PLAY_VERSION });
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

// He asked: no wasted work. The loop used to wake 120 times a second to run 30 ticks; now it sleeps until the next
// tick is due (the catch-up below still handles a late wake-up).
let last = performance.now(), acc = 0, snapAcc = 0;
const loop = () => { try { step(); } finally { setTimeout(loop, Math.max(1, (1 / TICK_RATE - acc) * 1000)); } }; // an error in a tick never stops the loop
const step = () => {
  const now = performance.now();
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  const dt = 1 / TICK_RATE;
  while (acc >= dt) {
    acc -= dt; game.tick(dt); for (const g of tutorials) if (!held(g)) g.tick(dt);
    snapAcc += dt;
    if (snapAcc >= 1 / SNAP_RATE - 1e-6) { snapAcc = 0; game.broadcast(); for (const g of tutorials) if (!g.heldUntil) g.broadcast(); }
  }
};
setTimeout(loop, 1000 / TICK_RATE);

// Practice for the pro teams (he asked): 200 rounds whenever the game's version changes (not daily any more); they run
// in a background thread while nobody is playing (they stop the moment someone joins a match). No AI service: all here.
// He asked: practice with each new GAMEPLAY change. The practice version is a fingerprint of the code that plays the
// matches (server/ and shared/), so a change to menus, pictures or sounds doesn't send the pros back to practice.
const PLAY_VERSION = playVersion() || VERSION.id;
// He asked for it a lot faster and allowed more of the computer: several practice threads at once, each flat out
// (a quarter of the computer's cores, 1 to 6; R62D_TRAIN_WORKERS changes it). Still only while no match is on.
const TRAIN_WORKERS = Math.max(1, Math.min(6, Number(process.env.R62D_TRAIN_WORKERS) || Math.floor(os.cpus().length / 4)));
let trainer = null; // { list: workers, rounds: this session's }
const stopTrainer = () => { if (trainer) for (const w of trainer.list) w.terminate(); trainer = null; };
// a match being played: the main one, free play, a tutorial or Esports TV (people in the menus are fine)
const matchOn = () => game.phase !== 'lobby' || [...tutorials].some(g => g.phase !== 'lobby' && !g.heldUntil);
function trainCheck(force = false) {
  const busy = matchOn();
  if (trainer && busy) { stopTrainer(); return 'a match is being played'; } // someone is playing: practice another time
  if (busy) return 'a match is being played';
  if (trainer) return '';
  newVersion(PLAY_VERSION);
  if (!needsTraining(PLAY_VERSION)) return `they have done their ${training.verRounds} rounds on this version`;
  const left = roundsLeft(PLAY_VERSION), n = Math.min(TRAIN_WORKERS, left), me = trainer = { list: [], rounds: 0, live: n };
  for (let i = 0; i < n; i++) { // the rounds shared out between the threads
    const w = new Worker(new URL('./train-worker.js', import.meta.url), { resourceLimits: { maxOldGenerationSizeMb: 512 }, workerData: { minutes: Number(process.env.R62D_TRAIN_MIN) || 60, rounds: Math.ceil((left - i) / n), duty: 1 } });
    me.list.push(w);
    w.on('message', m => { if (trainer !== me) return; if (m.done) { if (--me.live === 0) { training.at = Date.now(); console.log(`Pro teams trained on version ${PLAY_VERSION}: ${training.rounds} practice rounds so far.`); } } else { addResults(m); me.rounds += m.rounds || 0; } saveTraining(); });
    w.on('error', e => console.log('Pro training stopped:', e.message));
    w.on('exit', () => { w.done = true; if (trainer === me && me.list.every(x => x.done)) trainer = null; });
  }
}
setInterval(trainCheck, 5 * 60 * 1000); setTimeout(trainCheck, 60 * 1000);
// he asked: never practise while a game is running. Checked every 2 s while practice runs, so it stops right away
// (the 5-minute check above only starts it again once nobody is playing).
setInterval(() => { if (trainer && matchOn()) { stopTrainer(); console.log('Pro practice stopped: a match started.'); } }, 2000);

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
