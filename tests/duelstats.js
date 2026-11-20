// 1V1 playtest by numbers (he asked 2026-11-20: play it hard, find what never happens): bot-only 1v1 matches on each
// small map, counting what each side did in preparation and action (reinforcing, barricades, gadgets, abilities,
// drones, ropes, hatches, wall breaches, plants), how and where rounds are decided, how long they last and how much
// the defender roams. Run: node tests/duelstats.js [matches per map] [bot level]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, T } from '../shared/constants.js';
import { MAPS, MAP_LIST, buildMap, roomAt, floorAt } from '../shared/map.js';
import { OPERATORS } from '../shared/operators.js';

const per = +process.argv[2] || 3, lvl = process.argv[3] !== undefined ? +process.argv[3] : 5;
const H = {}, add = (k, n = 1) => { H[k] = (H[k] || 0) + n; };
const ends = {}, perOp = {};
let rounds = 0, roundTime = 0, atkWins = 0, firstKill = [], roam = [0, 0], plantT = [];
for (const id of MAP_LIST.filter(k => MAPS[k].small)) for (let n = 0; n < per; n++) {
  const g = new Game(); g.mode = 'duel'; g.mapId = id; g.map = buildMap(id); g.botLevel = lvl;
  g.addBot(0); g.addBot(1);
  const pts0 = g.pts.bind(g); g.pts = (p, n, why) => { if (n) add('did:' + String(why || '').replace(/[0-9]+/g, '#').slice(0, 40)); return pts0(p, n, why); };
  g.startMatch();
  const dt = 1 / 30; let t = 0, last = null, start = 0, atk = null, killed = false, wasPlanted = false, phaseKey = '';
  const side = p => p.squad === atk ? 'atk' : 'def';
  while (t < 60 * 30) {
    g.tick(dt); t += dt;
    const ph = g.phase === PHASE.PREP ? 'prep' : g.phase === PHASE.ACTION ? 'act' : null;
    for (const e of g.events) {
      if (e.e === 'snd' && ph) add(`${ph}:${e.s}`);
      if (e.e === 'down' && ph === 'act') add('act:someone downed');
      if (e.e === 'kill' && ph === 'act') {
        const v = g.players.get(e.victim), k = g.players.get(e.killer);
        if (!killed) { firstKill.push(t - start); killed = true; }
        if (v) { const site = g.map.sites[g.site], r = roomAt(g.map, v.x, v.y), out = g.map.tiles[Math.floor(v.y / 16) * g.map.W + Math.floor(v.x / 16)] === T.GROUND;
          add(`kill:${side(v)} died ${out ? 'outside' : site.rooms.includes(r) ? 'in the site' : 'inside, off site'}${e.hs ? ' (headshot)' : ''}${k && k.squad === v.squad ? ' (own fault)' : ''}`); }
      }
    }
    g.events.length = 0;
    if (Math.round(t * 30) % 2 === 0) g.broadcast();
    if (ph === 'act' && Math.round(t * 30) % 15 === 0) for (const p of g.players.values()) if (p.alive && side(p) === 'def') { roam[1]++; if (!g.map.sites[g.site].rooms.includes(roomAt(g.map, p.x, p.y))) roam[0]++; }
    if (ph) for (const p of g.players.values()) { if (p.rope && !p._rope) add(`${ph}:${side(p)} on a rope`); p._rope = !!p.rope; if (p.ctrl === 'drone' && !p._dr) add(`${ph}:${side(p)} drone flown`); p._dr = p.ctrl === 'drone'; if (p.ctrl === 'cam' && !p._cam) add(`${ph}:${side(p)} watched cameras`); p._cam = p.ctrl === 'cam'; }
    if (g.planted && !wasPlanted) { plantT.push(t - start); wasPlanted = true; }
    if (g.phase !== last) {
      if (g.phase === PHASE.PREP || g.phase === PHASE.SELECT) { atk = g.atkSquad(); }
      if (g.phase === PHASE.PREP) { for (const p of g.players.values()) { const o = perOp[p.op] || (perOp[p.op] = { n: 0, abil: 0, gad: 0, side: side(p) }); o.n++; p._a0 = [p.abilityCount, p.gadgetCount]; } }
      if (g.phase === PHASE.ACTION) { start = t; killed = false; wasPlanted = false; }
      if (g.phase === PHASE.ROUND_END) {
        for (const p of g.players.values()) { const o = perOp[p.op]; if (o && p._a0) { o.abil += Math.max(0, p._a0[0] - p.abilityCount); o.gad += Math.max(0, p._a0[1] - p.gadgetCount); } }
        rounds++; roundTime += t - start; ends[g.reason] = (ends[g.reason] || 0) + 1; if (g.winner === atk) atkWins++;
      }
      last = g.phase;
    }
    if (g.phase === PHASE.LOBBY && t > 5) break;
  }
}
const avg = a => a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0) : '-';
console.log(`${rounds} rounds, attackers won ${(100 * atkWins / rounds).toFixed(0)}%, action lasted ${avg([roundTime / rounds])} s on average, first kill after ${avg(firstKill)} s, plants ${plantT.length} (after ${avg(plantT)} s), defender off the site ${(100 * roam[0] / Math.max(1, roam[1])).toFixed(0)}% of the time`);
console.log('round ends:', JSON.stringify(ends));
for (const k of Object.keys(H).sort()) console.log(`  ${k}: ${H[k]}`);
console.log('operators (rounds · ability uses · gadget uses):');
for (const [o, v] of Object.entries(perOp).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${v.side} ${OPERATORS[o] ? OPERATORS[o].name : o}: ${v.n} · ${v.abil} · ${v.gad}`);
