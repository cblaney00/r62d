// Saved data: player profiles (loadouts + lifetime stats) and match history.
// Stored as JSON files in data/ next to the game (not committed to git).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { OP_LIST, cleanLoadout } from '../shared/operators.js';

const DIR = process.env.R62D_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const PROFILES = path.join(DIR, 'profiles.json');
const MATCHES = path.join(DIR, 'matches.json');
const MAX_MATCHES = 500;

function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function saveNow(file, data) {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file); // never leaves a half-written file
}

export const blankStats = () => ({
  matches: 0, wins: 0, losses: 0, rounds: 0, roundsWon: 0, kills: 0, deaths: 0, downs: 0, revives: 0,
  plants: 0, defuses: 0, shots: 0, hits: 0, damage: 0, playSeconds: 0, ops: {},
});

class Store {
  constructor() {
    this.profiles = load(PROFILES, {});
    this.matches = load(MATCHES, []);
    this.dirty = new Set();
    setInterval(() => this.flush(), 3000).unref();
  }
  flush() {
    if (this.dirty.has('p')) saveNow(PROFILES, this.profiles);
    if (this.dirty.has('m')) saveNow(MATCHES, this.matches);
    this.dirty.clear();
  }

  // Find a profile by its secret browser token, or make a new one.
  login(token, name) {
    let p = token && this.profiles[token];
    if (!p) {
      token = crypto.randomBytes(16).toString('hex');
      p = this.profiles[token] = { id: crypto.randomBytes(5).toString('hex'), name, created: Date.now(), lastSeen: Date.now(), loadouts: {}, stats: blankStats(), history: [] };
    }
    p.name = name || p.name; p.lastSeen = Date.now();
    this.dirty.add('p');
    return { token, profile: p };
  }
  byToken(token) { return token ? this.profiles[token] || null : null; }
  byId(id) { return Object.values(this.profiles).find(p => p.id === id) || null; }

  setLoadout(token, op, l) {
    const p = this.byToken(token); if (!p || !OP_LIST.includes(op)) return null;
    p.loadouts[op] = cleanLoadout(op, l); this.dirty.add('p');
    return p.loadouts[op];
  }
  loadout(token, op) { const p = this.byToken(token); return cleanLoadout(op, p && p.loadouts[op]); }

  // A finished match: add it to history and to each player's lifetime stats.
  recordMatch(m) {
    this.matches.unshift(m);
    if (this.matches.length > MAX_MATCHES) this.matches.length = MAX_MATCHES;
    for (const pl of m.players) {
      const prof = pl.token && this.profiles[pl.token]; if (!prof) continue;
      const s = prof.stats, won = pl.squad === m.winner;
      s.matches++; if (pl.left) s.losses++; else if (won) s.wins++; else s.losses++;
      for (const k of ['rounds', 'roundsWon', 'kills', 'deaths', 'downs', 'revives', 'plants', 'defuses', 'shots', 'hits', 'damage', 'playSeconds']) s[k] += pl[k] || 0;
      for (const [op, o] of Object.entries(pl.ops || {})) {
        const t = s.ops[op] || (s.ops[op] = { rounds: 0, roundsWon: 0, kills: 0, deaths: 0 });
        for (const k in t) t[k] += o[k] || 0;
      }
      prof.history.unshift(m.id); if (prof.history.length > 200) prof.history.length = 200;
    }
    for (const pl of m.players) delete pl.token; // tokens stay secret
    this.dirty.add('p'); this.dirty.add('m');
    this.flush();
  }
  match(id) { return this.matches.find(m => m.id === id) || null; }
  matchesFor(profileId, limit = 30) { return this.matches.filter(m => m.players.some(p => p.pid === profileId)).slice(0, limit); }
}

export const store = new Store();
export const publicProfile = p => p && ({ id: p.id, name: p.name, created: p.created, lastSeen: p.lastSeen, loadouts: p.loadouts, stats: p.stats });
