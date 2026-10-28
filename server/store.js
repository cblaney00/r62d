// Saved data: player profiles (loadouts + lifetime stats) and match history.
// Stored as JSON files in data/ next to the game (not committed to git).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { OP_LIST, cleanLoadout } from '../shared/operators.js';
import { matchXp, levelFor } from '../shared/progress.js';

const DIR = process.env.R62D_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const PROFILES = path.join(DIR, 'profiles.json');
const MATCHES = path.join(DIR, 'matches.json');
const MAX_MATCHES = 500;
// Profiles are found by name (no passwords, he asked): the same name, whatever the capitals or extra
// spaces, is the same profile on any computer.
export const cleanName = n => String(n || '').trim().replace(/\s+/g, ' ').slice(0, 16) || 'Operator';
const nameKey = n => cleanName(n).toLowerCase();

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
    this.mergeDuplicates();
    setInterval(() => this.flush(), 3000).unref();
  }
  flush() {
    if (this.dirty.has('p')) saveNow(PROFILES, this.profiles);
    if (this.dirty.has('m')) saveNow(MATCHES, this.matches);
    this.dirty.clear();
  }

  // Find the profile with this name, or make a new one. The token it hands back is only the server's
  // own key for the profile (kept secret so nobody else's browser can change it mid-match).
  login(name) {
    const k = nameKey(name);
    let token = Object.keys(this.profiles).find(t => nameKey(this.profiles[t].name) === k), p = token && this.profiles[token];
    if (!p) {
      token = crypto.randomBytes(16).toString('hex');
      p = this.profiles[token] = { id: crypto.randomBytes(5).toString('hex'), name: cleanName(name), created: Date.now(), lastSeen: Date.now(), loadouts: {}, stats: blankStats(), history: [] };
    }
    p.lastSeen = Date.now();
    this.dirty.add('p');
    return { token, profile: p };
  }
  // Before profiles went by name, one name could have several (one per browser). Join those into one:
  // stats, XP and match history add up; loadouts and settings come from the most recently used one.
  // The data from before is kept next to it as profiles.json.before-merge / matches.json.before-merge.
  mergeDuplicates() {
    const groups = new Map();
    for (const [t, p] of Object.entries(this.profiles)) { const k = nameKey(p.name); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([t, p]); }
    let merged = 0;
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      list.sort(([, a], [, b]) => (b.lastSeen || 0) - (a.lastSeen || 0));
      const [, keep] = list[0];
      for (const [t, p] of list.slice(1)) {
        for (const k in p.stats) if (typeof p.stats[k] === 'number') keep.stats[k] = (keep.stats[k] || 0) + p.stats[k];
        for (const [op, o] of Object.entries(p.stats.ops || {})) {
          const s = keep.stats.ops[op] || (keep.stats.ops[op] = { rounds: 0, roundsWon: 0, kills: 0, deaths: 0 });
          for (const k in s) s[k] += o[k] || 0;
        }
        keep.xp = (keep.xp || 0) + (p.xp || 0);
        keep.created = Math.min(keep.created || Date.now(), p.created || Date.now());
        for (const op in p.loadouts || {}) if (!keep.loadouts[op]) keep.loadouts[op] = p.loadouts[op];
        if (!keep.settings && p.settings) keep.settings = p.settings;
        for (const m of this.matches) for (const pl of m.players) if (pl.pid === p.id) pl.pid = keep.id;
        delete this.profiles[t]; merged++;
      }
      const ids = new Set(this.matches.map(m => m.id));
      keep.history = this.matches.filter(m => m.players.some(pl => pl.pid === keep.id)).map(m => m.id).filter(id => ids.has(id)).slice(0, 200);
    }
    if (!merged) return;
    for (const f of [PROFILES, MATCHES]) try { if (!fs.existsSync(f + '.before-merge')) fs.copyFileSync(f, f + '.before-merge'); } catch {}
    this.dirty.add('p'); this.dirty.add('m'); this.flush();
    console.log(`profiles: joined ${merged} duplicate profile(s) by name`);
  }
  byToken(token) { return token ? this.profiles[token] || null : null; }
  byId(id) { return Object.values(this.profiles).find(p => p.id === id) || null; }

  setLoadout(token, op, l) {
    const p = this.byToken(token); if (!p || !OP_LIST.includes(op)) return null;
    p.loadouts[op] = cleanLoadout(op, l); this.dirty.add('p');
    return p.loadouts[op];
  }
  // per-player settings: key bindings and volumes
  setSettings(token, st) {
    const p = this.byToken(token); if (!p || !st || typeof st !== 'object') return;
    const json = JSON.stringify(st); if (json.length > 8000) return;
    p.settings = JSON.parse(json); this.dirty.add('p');
  }
  loadout(token, op) { const p = this.byToken(token); return cleanLoadout(op, p && p.loadouts[op]); }

  // A finished match: add it to history and to each player's lifetime stats.
  recordMatch(m) {
    const xp = {};
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
      const before = prof.xp || 0, gain = matchXp(pl, won && !pl.left);
      prof.xp = before + gain.total; pl.xp = gain.total;
      xp[prof.id] = { lines: gain.lines, gain: gain.total, before, after: prof.xp };
    }
    for (const pl of m.players) delete pl.token; // tokens stay secret
    this.dirty.add('p'); this.dirty.add('m');
    this.flush();
    return xp;
  }
  match(id) { return this.matches.find(m => m.id === id) || null; }
  matchesFor(profileId, limit = 30) { return this.matches.filter(m => m.players.some(p => p.pid === profileId)).slice(0, limit); }
}

export const store = new Store();
export const publicProfile = p => p && ({ id: p.id, name: p.name, created: p.created, lastSeen: p.lastSeen, loadouts: p.loadouts, stats: p.stats, settings: p.settings || null, xp: p.xp || 0, level: levelFor(p.xp || 0) });
