// Strategy probe (no saving): plays bot matches and asks what wins. For each round: how the first attacker got into
// the site (door, window, broken wall, hatch, stairs) and when, how many ways in the attack used, how many defenders
// were in the site rooms 30 s in, who got the first kill, and how the round ended.
// Run: node tests/strats.js <level 0-7, 7 = pro teams> <matches per map> [--json]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST, floorAt, roomAt } from '../shared/map.js';
import { PHASE, TEAM, CELL, T } from '../shared/constants.js';

const mi = process.argv.indexOf('--merge'); // node tests/strats.js --merge a.json b.json: one report from several --json runs
const lvl = +(process.argv[2] ?? 7), per = mi > 0 ? 0 : +process.argv[3] || 2;
const rows = [];
if (mi > 0) { const fs = (await import('node:fs')).default; for (const f of process.argv.slice(mi + 1)) rows.push(...JSON.parse(fs.readFileSync(f, 'utf8').trim().split('\n').pop())); }
for (let n = 0; n < per; n++) for (const id of MAP_LIST) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = lvl; if (lvl === 7) g.proExplore = true;
  for (let i = 0; i < 10; i++) g.addBot();
  g.startMatch();
  const m = g.map, W = m.W, openAt = new Map();
  for (const o of m.openings) for (const k of o.cells) openAt.set(k, o.kind === 'window' ? 'window' : 'door');
  let t = 0, last = g.phase, R = null, prev = new Map();
  const cell = p => Math.floor(p.y / CELL) * W + Math.floor(p.x / CELL);
  const how = (k, kp, p, q) => {
    if (floorAt(m, p.x, p.y) !== floorAt(m, q.x, q.y)) { for (const d of [0, 1, -1, W, -W, 2, -2, 2 * W, -2 * W]) if (m.tiles[k + d] === T.STAIR || m.tiles[kp + d] === T.STAIR) return 'stairs'; return 'hatch'; }
    for (const c of [k, kp]) for (const d of [0, 1, -1, W, -W]) if (openAt.has(c + d)) return openAt.get(c + d);
    return 'breach';
  };
  while (t < 60 * 30 && !(g.phase === PHASE.LOBBY && t > 5)) {
    g.tick(1 / 30); t += 1 / 30;
    if (g.phase === PHASE.ACTION && R) {
      R.el += 1 / 30;
      const rooms = new Set(m.sites[g.site].rooms);
      for (const e of g.events) if (e.e === 'kill' && !R.first) { const k = g.players.get(e.killer), v = g.players.get(e.victim); if (k && v && g.side(k) !== g.side(v)) R.first = g.side(k) === TEAM.ATK ? 'atk' : 'def'; }
      for (const p of g.players.values()) {
        if (!p.alive || p.downed || p.staged) { prev.delete(p.id); continue; }
        const inSite = rooms.has(roomAt(m, p.x, p.y)), q = prev.get(p.id);
        if (g.side(p) === TEAM.ATK && inSite && q && !q.inSite) { const w = how(cell(p), cell(q), p, q); R.ways.add(w); if (!R.entry) { R.entry = w; R.entryT = R.el; } }
        prev.set(p.id, { x: p.x, y: p.y, inSite });
      }
      if (g.planted && !R.plantAt) { const alive = sd => [...g.players.values()].filter(p => p.alive && !p.downed && g.side(p) === sd).length; R.plantAt = `${alive(TEAM.ATK)}v${alive(TEAM.DEF)}`; R.plantT = R.el; }
      if (g.planted && R.plantAt && !R.postKills) R.postKills = { a: 0, d: 0 };
      if (R.postKills) for (const e of g.events) if (e.e === 'kill') { const k = g.players.get(e.killer); if (k) R.postKills[g.side(k) === TEAM.ATK ? 'a' : 'd']++; }
      if (R.el >= 30 && R.onSite === null) R.onSite = [...g.players.values()].filter(p => p.alive && g.side(p) === TEAM.DEF && rooms.has(roomAt(m, p.x, p.y))).length;
    }
    g.events = [];
    if (g.phase !== last) {
      if (g.phase === PHASE.ACTION) { R = { map: id, plantAt: null, postKills: null, el: 0, ways: new Set(), entry: null, entryT: null, onSite: null, first: null }; prev = new Map(); }
      if (g.phase === PHASE.ROUND_END && g.winner != null && R) {
        const atkSq = [...g.players.values()].find(p => g.side(p) === TEAM.ATK).squad;
        rows.push({ ...R, ways: [...R.ways], win: g.winner === atkSq ? 'atk' : 'def', reason: g.reason, planted: !!g.planted || /defus|plant/i.test(g.reason) });
        R = null;
      }
      last = g.phase;
    }
  }
}
if (process.argv.includes('--json')) { console.log(JSON.stringify(rows)); process.exit(0); }
report(rows);
function report(rows) {
  const pc = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
  const by = (name, key) => { const b = {}; for (const r of rows) { const k = key(r); if (k == null) continue; const x = b[k] || (b[k] = [0, 0]); x[0]++; if (r.win === 'atk') x[1]++; }
    console.log(`${name}: ` + Object.entries(b).sort().map(([k, [n, w]]) => `${k} ${pc(w, n)} atk of ${n}`).join(' | ')); };
  console.log(`${rows.length} rounds, attack wins ${pc(rows.filter(r => r.win === 'atk').length, rows.length)}`);
  by('first way into the site', r => r.entry || 'never got in');
  by('time of first entry', r => r.entryT == null ? null : r.entryT < 30 ? 'a <30s' : r.entryT < 75 ? 'b 30-75s' : r.entryT < 120 ? 'c 75-120s' : 'd >120s');
  by('ways in used', r => r.ways.length);
  by('defenders on site at 30 s', r => r.onSite);
  by('first kill', r => r.first || 'none');
  by('how it ended', r => r.reason.replace(/[0-9]/g, '').slice(0, 30));
  by('map', r => r.map);
  by('alive when planted (atk v def)', r => r.plantAt);
  const pk = rows.filter(r => r.postKills); console.log(`after the plant: attackers got ${pk.reduce((a, r) => a + r.postKills.a, 0)} kills, defenders ${pk.reduce((a, r) => a + r.postKills.d, 0)} (${pk.length} rounds)`);
}
