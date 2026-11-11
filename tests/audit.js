// Bot audit for the 2026-11-10 batch (he asked: train the bots and look for bugs or odd bot habits). Plays bot
// matches with the new operators forced onto some bots each round and counts: ability uses and refusals, kills by the
// new guns, people stuck on one spot, people inside walls or in holes, falls through holes, teamkills, killcam bug
// reports, errors. Run: node tests/audit.js [level 0-7] [matches per map] [map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST, floorAt } from '../shared/map.js';
import { PHASE, T, CELL, PX_PER_M } from '../shared/constants.js';
import { OPERATORS, WEAPONS } from '../shared/operators.js';
import { pointSolid } from '../shared/physics.js';
import { botPrep } from '../server/bots.js';
import { store } from '../server/store.js';

const lvl = +(process.argv[2] ?? 7), per = +process.argv[3] || 1, only = process.argv[4] || null;
const NEW_OPS = { atk: ['perch', 'moss', 'osprey', 'nail', 'gimlet', 'hoist'], def: ['lockjaw', 'deadfall'] };
const NEW_GUNS = new Set(['verdict', 'tandem', 'ferret', 'auger', 'quill', 'hedge', 'cyclone', 'trestle', 'ranger', 'mammoth', 'needle', 'couplet', 'whisper', 'hatchet'].map(w => WEAPONS[w].name));
const A = { fallBy: {}, traps: new Map(), rounds: 0, uses: {}, denies: {}, kills: {}, gunKills: {}, stuck: [], inWall: [], holeFalls: 0, tk: {}, bugs: [], errors: [], grappleDone: 0, peeps: 0, floorHoles: 0, opRounds: {}, opWins: {}, opKills: {}, opDeaths: {} };
const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
store.saveBug = b => { A.bugs.push(`${b.map} ${b.weapon}: ${b.bug.join('; ')}`); return 'x'; };
for (let n = 0; n < per; n++) for (const id of only ? [only] : MAP_LIST) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = lvl; if (lvl === 7) g.proExplore = true;
  for (let i = 0; i < 10; i++) g.addBot();
  // instrument
  const use0 = g.useAbility.bind(g);
  g.useAbility = p => { const op = OPERATORS[p.op]; const c = p.abilityCount, nh = g.map.hatches.length; const ev0 = g.events.length; use0(p);
    if (!op) return; const id2 = op.ability.id, denied = g.events.slice(ev0).find(e => e.e === 'deny' && e.id === p.id);
    if (denied) inc(A.denies, `${p.op}: ${denied.why}`); else if (NEW_OPS.atk.includes(p.op) || NEW_OPS.def.includes(p.op)) inc(A.uses, `${p.op} ${id2}`); };
  const kill0 = g.kill ? g.kill.bind(g) : null;
  const dmg0 = g.damage.bind(g);
  g.damage = (q, d, src, wname, ang) => { const was = q.alive && !q.downed; dmg0(q, d, src, wname, ang);
    if (was && (!q.alive || q.downed) && src && src !== q) { inc(A.kills, wname || '?'); if (NEW_GUNS.has(wname)) inc(A.gunKills, wname); if (g.side(src) === g.side(q)) inc(A.tk, `${src.op} -> ${q.op} (${wname})`); if (src.op) inc(A.opKills, src.op); if (q.op) inc(A.opDeaths, q.op);
      const j = g.judgeKill(q, src, wname, (g.camBuf || []).filter(f => f.t >= g.time - 5.5)); if (j.bug) A.bugs.push(`${id} ${src.op} -> ${q.op} ${wname}: ${j.bug.join('; ')}`); } };
  g.startMatch();
  let t = 0, lastRound = -1; const seen = new Map();
  try {
    while (t < 60 * 30 && !(g.phase === PHASE.LOBBY && t > 5)) {
      if (g.phase === PHASE.PREP && g.round !== lastRound) { // a new round: put the new operators on some bots
        lastRound = g.round; A.rounds++;
        for (const side of ['atk', 'def']) {
          const bots = [...g.players.values()].filter(p => g.side(p) === side).sort(() => Math.random() - 0.5), list = [...NEW_OPS[side]].sort(() => Math.random() - 0.5);
          bots.slice(0, side === 'atk' ? 3 : 2).forEach((p, i) => { const keep = { staged: p.staged, x: p.x, y: p.y, spawn: p.spawn, ctrl: p.ctrl, droneId: p.droneId }; p.op = list[i % list.length]; g.equip(p); Object.assign(p, keep); if (side === 'def') botPrep(g, p); }); // (re-plan preparation for the new operator) // (equip resets the waiting state: keep it)
        }
        for (const p of g.players.values()) inc(A.opRounds, p.op);
        seen.clear();
      }
      const hb = g.map.hatches.length, pb = (g.map.peeps || []).length, fl0 = new Map([...g.players.values()].map(p => [p.id, floorAt(g.map, p.x, p.y)]));
      g.tick(1 / 30); t += 1 / 30;
      for (const h of g.map.hatches.slice(hb)) if (h.dyn) A.floorHoles++;
      A.peeps += (g.map.peeps || []).length - pb;
      for (const e of g.ents) if (e.type === 'htrap' && !A.traps.has(e.id)) A.traps.set(e.id, { rig: e.rig, gone: false });
      for (const [eid, tr] of A.traps) if (!tr.gone && !g.ents.some(e => e.id === eid)) { tr.gone = true; tr.end = g.phase !== PHASE.ACTION; tr.open = g.map.hatches[tr.rig] && g.map.tiles[g.map.hatches[tr.rig].cells[0]] === T.HOLE; }
      for (const p of g.players.values()) {
        if (!p.alive || p.staged || p.ctrl !== 'body') continue;
        const f1 = floorAt(g.map, p.x, p.y);
        if (fl0.get(p.id) > f1 && g.map.hatches.some(h => !h.peep && Math.hypot(h.bx - p.x, h.by - p.y) < 40)) { A.holeFalls++; const pa = p.ai && p.ai.path, last = pa && pa.length ? pa[pa.length - 1] : -1, goal = last >= 0 && g.map.flAt[last] === f1 ? 'meant' : 'by accident'; inc(A.fallBy, `${g.side(p)} ${g.phase} ${goal}`); }
        if (fl0.get(p.id) < f1 && p.op === 'hoist') A.grappleDone++;
        const k = Math.floor(p.y / CELL) * g.map.W + Math.floor(p.x / CELL), tt = g.map.tiles[k];
        if (!p.vault && !p.rope && pointSolid(g.map, p.x, p.y, t => [T.HARD, T.REINF, T.TALL, T.VOID, T.SOFT].includes(t))) { const key = `${id} r${g.round} ${g.phase} ${p.op} in tile ${tt} at ${Math.round(p.x)},${Math.round(p.y)} (was ${p._lx},${p._ly})`; if (!A.inWall.includes(key)) A.inWall.push(key); }
        p._lx = Math.round(p.x); p._ly = Math.round(p.y);
        if (g.phase === PHASE.ACTION) { // stuck: under 1 m of travel in 25 s while not on a hold/plant/defuse
          const s = seen.get(p.id); if (!s || Math.hypot(s.x - p.x, s.y - p.y) > PX_PER_M) seen.set(p.id, { x: p.x, y: p.y, t });
          else if (t - s.t > 25 && !s.said && !p.busy && !g.planted && g.side(p) === 'atk') { s.said = true; A.stuck.push(`${id} r${g.round} ${g.side(p)} ${p.op} ${p.bipodSet ? '(bipod)' : ''} ${g.map.floors[floorAt(g.map, p.x, p.y)]?.name} ${p.ai && p.ai.roofSt && p.ai.roofSt.round === g.round ? 'roof:' + p.ai.roofSt.s : ''} at ${Math.round(p.x)},${Math.round(p.y)}`); }
        }
      }
      if (g.phase === PHASE.ROUND_END && !g._counted) { g._counted = true; const win = g.lastWinner || null; if (win !== null && win !== undefined) for (const p of g.players.values()) if (p.squad === win) inc(A.opWins, p.op); }
      if (g.phase !== PHASE.ROUND_END) g._counted = false;
    }
  } catch (e) { A.errors.push(`${id}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
}
const top = (o, n = 40) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
console.log(`level ${lvl}, ${A.rounds} rounds`);
console.log('\nnew ability uses:'); for (const [k, v] of top(A.uses)) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log('\nrefusals (deny):'); for (const [k, v] of top(A.denies)) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log('\nnew operators: rounds / kills / deaths'); for (const op of [...NEW_OPS.atk, ...NEW_OPS.def]) console.log(`  ${op.padEnd(9)} ${A.opRounds[op] || 0} / ${A.opKills[op] || 0} / ${A.opDeaths[op] || 0}`);
console.log('\nkills by new guns:'); for (const [k, v] of top(A.gunKills)) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log('\nall kills by cause (top 25):'); for (const [k, v] of top(A.kills, 25)) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log(`\nLOCKJAW traps: ${A.traps.size} set, ${[...A.traps.values()].filter(t => t.gone && t.open).length} went off (hatch open), ${[...A.traps.values()].filter(t => t.gone && !t.open && !t.end).length} destroyed shut, the rest still waiting at the round's end`);
console.log('falls by side / phase:', JSON.stringify(A.fallBy));
console.log(`\nfloor holes blown: ${A.floorHoles}, peepholes: ${A.peeps}, HOIST climbs up: ${A.grappleDone}, falls through holes: ${A.holeFalls}`);
console.log('\nteamkills:'); for (const [k, v] of top(A.tk, 20)) console.log(`  ${String(v).padStart(4)}  ${k}`);
console.log(`\nstuck (${A.stuck.length}):`); for (const s of A.stuck.slice(0, 25)) console.log('  ' + s);
console.log(`\ninside walls (${A.inWall.length}):`); for (const s of A.inWall.slice(0, 15)) console.log('  ' + s);
console.log(`\nkillcam bug reports (${A.bugs.length}):`); for (const s of A.bugs.slice(0, 15)) console.log('  ' + s);
console.log(`\nerrors (${A.errors.length}):`); for (const s of A.errors) console.log('  ' + s);
