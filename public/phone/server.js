// The game server on a phone (he asked 2026-11-16: the Android app plays the whole game without a computer). The same
// Game as server/server.js runs, in the page itself; shim.js hands it the page's WebSocket and /api/ calls. One person,
// so: the shared lobby, free play, tutorials and Esports TV; no hosting, no replays, no pro practice (too heavy for a
// phone: the pros play with what they know from the release). See public/phone/README.md.
import { Game } from '/server/game.js';
import { store, publicProfile } from '/server/store.js';
import { training, seedTraining } from '/server/training.js';
import { META } from '/shared/meta.js';
import { TICK_RATE, SNAP_RATE } from '/shared/constants.js';

const VERSION = { id: (window.r62dApp && r62dApp.gameVersion && r62dApp.gameVersion()) || 'phone', date: '' };
const game = new Game();
// he asked (2026-11-18): the game saves on the phone itself. Saves are written every 3 s; when the app is put away or
// closed (the phone may end it without warning) whatever changed since is written straight away.
const saveNow = () => { try { store.flush(); } catch {} };
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
// the pros' knowledge from the release (server/pro-seed.json, packed by android/build.sh), when it beats what this phone has
fetch('/server/pro-seed.json').then(r => r.ok ? r.json() : null).then(j => { for (const k of ['guns', 'att', 'pro', 'opinions']) if (j && !j[k]) j[k] = {}; if (j && !j.drills) j.drills = training.drills; seedTraining(j); }).catch(() => {});
const tutorials = new Set();

// a socket the Game can use: open, send(text), on('message' | 'close')
export function connect(url, toPage) {
  const ev = { message: [], close: [] };
  const sock = { open: true, send: s => { if (sock.open) toPage('msg', s); }, on: (k, f) => { (ev[k] || (ev[k] = [])).push(f); return sock; },
    close: () => { if (!sock.open) return; sock.open = false; for (const f of ev.close) f(); toPage('close'); } };
  const q = new URL(url, 'https://x').searchParams;
  if (q.has('replay')) { setTimeout(() => sock.close(), 0); return { sock, fromPage: () => {} }; } // no replays on a phone
  const tut = q.get('tut') === '1', free = q.get('free') === '1', tv = q.get('tv') === '1';
  if (!tut && !free && !tv) game.connect(sock);
  else { const g = new Game({ tut, free, tv }); tutorials.add(g); g.onEmpty = () => tutorials.delete(g); g.connect(sock); }
  return { sock, fromPage: s => { for (const f of ev.message) f(s); } };
}

// the /api/ calls the menus make
export function api(pathname, q, method) {
  const summary = m => ({ id: m.id, date: m.date, duration: m.duration, map: m.map, mode: m.mode, score: m.score, winner: m.winner, players: m.players });
  if (pathname === '/api/profile') {
    const p = q.get('token') ? store.byToken(q.get('token')) : store.byId(q.get('id'));
    return p ? [200, { profile: publicProfile(p), matches: store.matchesFor(p.id, 40).map(summary) }] : [404, { error: 'no such profile' }];
  }
  if (pathname === '/api/addr') return [200, { urls: [], host: 'this phone', version: VERSION, port: 0, players: 1, local: true, phone: true }];
  if (pathname === '/api/meta') return [200, META];
  if (pathname === '/api/training') return [200, { version: training.version, at: training.at, rounds: training.rounds, verRounds: training.verRounds || 0, perVersion: 200, plans: training.plans, ops: training.ops, opx: training.opx, guns: training.guns, att: training.att, pro: training.pro, drills: training.drills, opinions: training.opinions, suggestions: training.suggestions, skillDrills: training.skillDrills, skill: training.skill, tested: training.tested, ends: training.ends, running: false, session: 0, current: training.version }];
  if (pathname === '/api/train') return [200, { running: false, why: 'pros practise on a computer, not on a phone' }];
  if (pathname === '/api/replays') return [200, { list: [], phone: true }];
  if (pathname === '/api/replay/open') return [200, { error: 'Replays play on a computer, not on a phone.' }];
  if (pathname === '/api/match') { const m = store.match(q.get('id')); return m ? [200, m] : [404, { error: 'no such match' }]; }
  if (pathname === '/api/players') return [200, Object.values(store.profiles).map(p => ({ id: p.id, name: p.name, matches: p.stats.matches, wins: p.stats.wins, kills: p.stats.kills, deaths: p.stats.deaths }))];
  if (pathname === '/api/window') return [200, { can: false }];
  if (pathname === '/api/perf' || pathname === '/api/quit') return [200, { ok: true }];
  return [404, { error: 'unknown' }];
}

// the same loop as server/server.js: 30 ticks and 20 snapshots a second, sleeping in between
let last = performance.now(), acc = 0, snapAcc = 0;
const step = () => {
  const now = performance.now();
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  const dt = 1 / TICK_RATE;
  while (acc >= dt) {
    acc -= dt; game.tick(dt); for (const g of tutorials) g.tick(dt);
    snapAcc += dt;
    if (snapAcc >= 1 / SNAP_RATE - 1e-6) { snapAcc = Math.min(snapAcc - 1 / SNAP_RATE, 1 / SNAP_RATE); game.broadcast(); for (const g of tutorials) g.broadcast(); } // (keeps the remainder: 20 updates a second, not 15)
  }
};
const loop = () => { try { step(); } catch (e) { console.error('phone server:', e); } finally { setTimeout(loop, Math.max(1, (1 / TICK_RATE - acc) * 1000)); } };
setTimeout(loop, 1000 / TICK_RATE);
