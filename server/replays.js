// Match replays (he asked 2026-11-15): the 3 most recent Quick Match / Unranked / Ranked matches played on this computer
// are kept, start to finish, and deleted once the game's gameplay changes (they would no longer play back the same).
// Watching works like Esports TV: the client gets the full snapshot stream the match had (everyone visible), follows
// anyone, with pause, speed and a timeline.
//
// A replay is $R62D_DATA/replays/<id>.r62d: gzip of lines. Line 1 = header {r62d: 1, v: gameplay version, id, map, mode,
// date}; every other line = one snapshot exactly as `Game.broadcast` built it (`common`) plus `m` = {player id: their
// private details (ammo, gadgets...)} for every alive player, so whoever you follow shows a full HUD.
// <id>.json next to it = the card in the REPLAYS menu (map, mode, date, length, score, players).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { playVersion } from './training.js';
import { buildMap, MAPS } from '../shared/map.js';
import { store, publicProfile } from './store.js';
import { T } from '../shared/constants.js';

const recording = []; // ids being written right now
const KEEP = 3, MODES = new Set(['quick', 'unranked', 'ranked']), MAX_UPLOAD = 300 * 1024 * 1024;
const DIR = path.join(process.env.R62D_DATA || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data'), 'replays');
let VERSION = null;
const version = () => VERSION || (VERSION = playVersion() || 'dev');
export const replayDir = () => DIR;
const MODE_NAME = { quick: 'Quick Match', unranked: 'Unranked', ranked: 'Ranked' };

// ---------------- recording ----------------
export function startRec(g) {
  stopRec(g, true);
  if (g.tut || g.free || g.tv || !MODES.has(g.mode)) return;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), file = path.join(DIR, id + '.r62d');
    const gz = zlib.createGzip({ level: 6 }), out = fs.createWriteStream(file);
    gz.pipe(out); out.on('error', () => {});
    const rec = g.rec = { id, file, gz, out, start: Date.now(), t0: null, t1: null, frames: 0, mapId: g.mapId, mode: g.mode, rounds: [] };
    recording.push(id);
    gz.write(JSON.stringify({ r62d: 1, v: version(), id, map: g.mapId, mode: g.mode, date: rec.start }) + '\n');
  } catch (e) { console.log('Replay could not start:', e.message); g.rec = null; }
}
// one snapshot (called at the end of Game.broadcast); mine = Map(player id -> JSON of their private details)
export function recFrame(g, common, mine) {
  const r = g.rec; if (!r) return;
  let m = '{';
  for (const [id, s] of mine) m += (m.length > 1 ? ',' : '') + JSON.stringify(String(id)) + ':' + s;
  r.gz.write('{"m":' + m + '},' + common.slice(1) + '\n');
  if (r.t0 === null) r.t0 = g.time;
  r.t1 = g.time; r.frames++;
  if (r.lastRound !== g.round) { r.lastRound = g.round; r.rounds.push(g.round); }
}
// the match is over (kept) or abandoned (kept if at least one round was finished, else thrown away)
export function stopRec(g, abandoned = false, winner = null) {
  const r = g.rec; if (!r) return;
  g.rec = null; const ri = recording.indexOf(r.id); if (ri >= 0) recording.splice(ri, 1);
  const keep = !abandoned || (g.roundLog && g.roundLog.length >= 1);
  const players = [...g.players.values()].map(p => ({ n: p.name, sq: p.squad, b: p.bot ? 1 : 0, k: p.kills || 0, d: p.deaths || 0 }));
  const meta = { id: r.id, v: version(), map: r.mapId, mapName: (MAPS[r.mapId] || {}).name || r.mapId, mode: r.mode, modeName: MODE_NAME[r.mode] || r.mode,
    date: r.start, duration: Math.round((r.t1 ?? 0) - (r.t0 ?? 0)), score: [...(g.score || [0, 0])], winner, rounds: (g.roundLog || []).length, players, done: !abandoned };
  r.gz.end();
  r.out.on('close', () => {
    if (!keep) { try { fs.unlinkSync(r.file); } catch {} return; }
    try { meta.size = fs.statSync(r.file).size; fs.writeFileSync(path.join(DIR, r.id + '.json'), JSON.stringify(meta)); } catch {}
    prune();
  });
}

// ---------------- the list: newest 3, current version only ----------------
export function prune() {
  let metas = [];
  try { fs.mkdirSync(DIR, { recursive: true }); } catch {}
  let files = []; try { files = fs.readdirSync(DIR); } catch { return []; }
  for (const f of files) if (f.endsWith('.json')) {
    let m = null; try { m = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch {}
    if (!m || m.v !== version() || !fs.existsSync(path.join(DIR, m.id + '.r62d'))) { remove(f.slice(0, -5)); continue; } // out of date (or broken): gone
    metas.push(m);
  }
  metas.sort((a, b) => b.date - a.date);
  for (const m of metas.slice(KEEP)) remove(m.id);
  metas = metas.slice(0, KEEP);
  // a recording with no card that isn't being written now is left over from a crash: gone too
  const live = new Set(metas.map(m => m.id).concat(recording));
  for (const f of files) if (f.endsWith('.r62d') && !live.has(f.slice(0, -5)) && Date.now() - statTime(path.join(DIR, f)) > 6 * 3600e3) remove(f.slice(0, -5));
  return metas;
}
const statTime = f => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
function remove(id) { for (const e of ['.r62d', '.json']) try { fs.unlinkSync(path.join(DIR, id + e)); } catch {} if (cache && cache.id === id) cache = null; }
export const listReplays = () => prune();
export const replayFile = id => /^[a-z0-9]{4,20}$/.test(id || '') && fs.existsSync(path.join(DIR, id + '.r62d')) ? path.join(DIR, id + '.r62d') : null;
export function downloadName(id) {
  let m = null; try { m = JSON.parse(fs.readFileSync(path.join(DIR, id + '.json'), 'utf8')); } catch {}
  const d = new Date(m ? m.date : Date.now()), p = n => String(n).padStart(2, '0');
  return `R62D ${m ? m.mapName : 'replay'} ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}`;
}

// ---------------- opening a replay file someone downloaded ----------------
const opened = new Map(); // id -> Buffer (kept until the server stops; not one of the 3)
export function openUpload(buf) {
  if (!buf || buf.length > MAX_UPLOAD) return { error: 'That file is too big to be a replay.' };
  let head; try { head = JSON.parse(zlib.gunzipSync(buf).toString('utf8', 0, 4000).split('\n')[0]); } catch { return { error: 'That is not an R62D replay file.' }; }
  if (!head || head.r62d !== 1) return { error: 'That is not an R62D replay file.' };
  if (head.v !== version()) return { error: 'That replay was made with an older version of the game, so it can no longer play back.' };
  for (const k of opened.keys()) if (opened.size >= 2) opened.delete(k); // only the last couple
  const id = 'f' + Math.random().toString(36).slice(2, 10); opened.set(id, buf);
  return { id, map: head.map, mode: head.mode, date: head.date };
}

// ---------------- playing back ----------------
let cache = null; // the last replay loaded: { id, lines, frames: [{t, mv, rd, cells, holes}], ... }
function load(id) {
  if (cache && cache.id === id) return cache;
  let buf = opened.get(id);
  if (!buf) { const f = replayFile(id); if (!f) return null; buf = fs.readFileSync(f); }
  let text; try { text = zlib.gunzipSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8'); } catch { return null; }
  const lines = text.split('\n'); if (!lines[lines.length - 1]) lines.pop();
  let head; try { head = JSON.parse(lines.shift()); } catch { return null; }
  if (!head || head.v !== version() || !MAPS[head.map]) return null;
  const frames = [], rounds = [];
  for (let i = 0; i < lines.length; i++) {
    let f; try { f = JSON.parse(lines[i]); } catch { lines.length = i; break; } // a match cut off mid-line (crash): keep what is whole
    frames.push({ t: f.time, mv: f.mv, rd: f.rd, ph: f.ph, cells: f.cells, holes: f.holes || [] });
    if (!rounds.length || rounds[rounds.length - 1].rd !== f.rd) rounds.push({ rd: f.rd, t: f.time });
  }
  if (!frames.length) return null;
  const base = buildMap(head.map);
  const t0 = frames[0].t, out = { id, head, lines, frames, t0, dur: frames[frames.length - 1].t - t0, rounds: rounds.map(r => ({ rd: r.rd, t: Math.round((r.t - t0) * 10) / 10 })),
    base: { tiles: Array.from(base.tiles), hp: Array.from(base.hp), holes: JSON.parse(JSON.stringify(base.holes || {})) } };
  return (cache = out);
}
// the map as it was at frame i: fresh at the start of that frame's round (same map version), then every change since
function mapAt(R, i) {
  const tiles = R.base.tiles.slice(), hp = R.base.hp.slice(), holes = JSON.parse(JSON.stringify(R.base.holes)), mv = R.frames[i].mv;
  let j = i; while (j > 0 && R.frames[j - 1].mv === mv) j--;
  for (let k = j; k <= i; k++) {
    const f = R.frames[k];
    for (let c = 0; c < f.cells.length; c += 3) { const key = f.cells[c]; if (f.cells[c + 1] === T.BARRI && tiles[key] !== T.BARRI) delete holes[key]; tiles[key] = f.cells[c + 1]; hp[key] = f.cells[c + 2]; }
    for (let c = 0; c < f.holes.length; c += 3) (holes[f.holes[c]] || (holes[f.holes[c]] = [])).push(f.holes[c + 1], f.holes[c + 2]);
  }
  return { tiles, hp, holes, mv };
}

export class ReplayView {
  constructor(sock, id) {
    this.sock = sock; this.id = id; this.R = null; this.i = 0; this.rt = 0; this.speed = 1; this.paused = false; this.follow = null; this.ended = false;
    sock.on('message', raw => { let m; try { m = JSON.parse(raw); } catch { return; } this.handle(m); });
    sock.on('close', () => { this.closed = true; });
  }
  send(o) { if (this.sock.open) this.sock.send(typeof o === 'string' ? o : JSON.stringify(o)); }
  handle(m) {
    if (m.t === 'join' && !this.R) {
      const R = this.R = load(this.id);
      const login = store.login(String(m.name || 'Viewer').slice(0, 20));
      if (!R) { this.send({ t: 'rpgone' }); return; }
      const mp = mapAt(R, 0);
      this.send({ t: 'welcome', id: null, tv: 1, replay: 1, mapVersion: mp.mv, mapId: R.head.map, token: login.token, profile: publicProfile(login.profile), tiles: mp.tiles, hp: mp.hp, holes: mp.holes });
      this.send({ t: 'rpinfo', d: R.dur, rounds: R.rounds, map: R.head.map, mode: R.head.mode, date: R.head.date });
      this.i = 0; this.rt = R.frames[0].t; this.sendFrames(0, 0);
    } else if (!this.R) return;
    else if (m.t === 'tv' && m.a === 'follow') this.follow = m.id ?? null;
    else if (m.t === 'rp') {
      if (m.a === 'pause') this.paused = m.v === undefined ? !this.paused : !!m.v;
      else if (m.a === 'speed') this.speed = Math.max(0.25, Math.min(8, +m.v || 1));
      else if (m.a === 'seek') this.seek(+m.v || 0);
      if (this.ended && m.a === 'pause' && !this.paused) this.seek(0); // play again from the start
      this.sendStatus();
    }
  }
  seek(sec) {
    const R = this.R, target = R.t0 + Math.max(0, Math.min(R.dur, sec));
    let i = 0, lo = 0, hi = R.frames.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (R.frames[mid].t <= target) { i = mid; lo = mid + 1; } else hi = mid - 1; }
    const mp = mapAt(R, i);
    this.send({ t: 'rpmap', mapVersion: mp.mv, mapId: R.head.map, tiles: mp.tiles, hp: mp.hp, holes: mp.holes });
    this.i = i; this.rt = R.frames[i].t; this.ended = false;
    this.sendFrames(i, i, true);
  }
  // frames a..b go out as one snapshot: the last one, carrying every map change and event of the ones before it
  sendFrames(a, b, quiet = false) {
    const R = this.R; let f = null; const cells = [], cb = [], holes = [], hb = [], ev = [];
    for (let k = a; k <= b; k++) {
      try { f = JSON.parse(R.lines[k]); } catch { continue; }
      if (k < b || !quiet) { cells.push(...f.cells); cb.push(...(f.cb || [])); holes.push(...(f.holes || [])); hb.push(...(f.hb || [])); }
      if (!quiet) ev.push(...(f.ev || []));
    }
    if (!f) return;
    if (quiet) { f.cells = []; f.cb = []; f.holes = []; f.hb = []; f.ev = []; } else { f.cells = cells; f.cb = cb; f.holes = holes; f.hb = hb; f.ev = ev.slice(-80); }
    const m = f.m || {}; delete f.m;
    const fl = this.follow != null && f.players.some(p => String(p.id) === String(this.follow)) ? this.follow : null;
    const msg = { t: 'snap', tv: 1, you: fl, ...(fl != null && m[String(fl)] ? { mine: m[String(fl)] } : {}), ...f, rp: this.status() };
    this.send(msg);
  }
  status() { const R = this.R; return { t: Math.round((this.rt - R.t0) * 10) / 10, d: R.dur, p: this.paused ? 1 : 0, s: this.speed, e: this.ended ? 1 : 0 }; }
  sendStatus() { if (this.R) this.send({ t: 'rpst', ...this.status() }); }
  tick(dt) {
    const R = this.R; if (!R || this.closed || this.paused || this.ended) return;
    this.rt += dt * this.speed;
    let j = this.i; while (j + 1 < R.frames.length && R.frames[j + 1].t <= this.rt) j++;
    if (j > this.i) { this.sendFrames(this.i + 1, j); this.i = j; }
    if (this.i >= R.frames.length - 1) { this.ended = true; this.paused = true; this.rt = R.t0 + R.dur; this.sendStatus(); }
  }
}
