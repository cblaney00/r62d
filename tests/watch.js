// Watches pro-vs-pro matches the way they are really played (normal operator picks) and prints what happened:
// operator picks per side, how rounds end and how long they take, ability and gadget use, kills by weapon kind,
// plants, and a sample of the pros' calls. Run: node tests/watch.js [matches per map] [--level N] [--only map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap, MAP_LIST } from '../shared/map.js';
import { PHASE, TEAM } from '../shared/constants.js';
import { OPERATORS, WEAPONS } from '../shared/operators.js';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const per = +process.argv[2] || 1, level = +arg('--level', 7), only = arg('--only', null);
const C = {}, inc = (k, n = 1) => { C[k] = (C[k] || 0) + n; };
const picks = { atk: {}, def: {} }, abil = {}, gad = {}, opRounds = {}, reasons = {}, durs = [], firstKill = [], calls = [];
let rounds = 0, atkWins = 0;
for (const id of only ? [only] : MAP_LIST) for (let n = 0; n < per; n++) {
  const g = new Game(); g.mapId = id; g.map = buildMap(id); g.botLevel = level;
  for (let i = 0; i < 10; i++) g.addBot();
  const ua = g.useAbility.bind(g), ug = g.useGadget.bind(g);
  g.useAbility = p => { const b = JSON.stringify([p.ability, p.abilityCount, p.charges]); const r = ua(p); if (JSON.stringify([p.ability, p.abilityCount, p.charges]) !== b || r) abil[p.op] = (abil[p.op] || 0) + 1; return r; };
  g.useGadget = p => { const b = JSON.stringify(p.gadgets || p.gadget); const r = ug(p); if (JSON.stringify(p.gadgets || p.gadget) !== b) gad[p.op] = (gad[p.op] || 0) + 1; return r; };
  g.startMatch();
  let t = 0, last = g.phase, rt = 0, fk = false;
  while (t < 60 * 30 && !(g.phase === PHASE.LOBBY && t > 5)) {
    g.tick(1 / 30); t += 1 / 30;
    if (g.phase === PHASE.ACTION) rt += 1 / 30;
    for (const e of g.events) {
      if (e.e === 'kill') {
        const k = g.players.get(e.killer), v = g.players.get(e.victim);
        const w = Object.values(WEAPONS).find(x => x.name === e.w);
        inc('kill:' + (w ? w.cls : e.w)); if (k && v && g.side(k) === g.side(v)) inc('teamkill');
        if (!fk && g.phase === PHASE.ACTION) { fk = true; firstKill.push(Math.round(rt)); if (k) inc('firstKillBy:' + g.side(k)); }
      }
      if (e.e === 'defuser') inc('defuserEvent');
      if (e.e === 'drone') inc('droneEvent');
    }
    g.events.length = 0;
    if (g.phase !== last && g.phase === PHASE.ACTION) {
      rt = 0; fk = false;
      for (const p of g.players.values()) if (p.op) { const s = g.side(p); picks[s][p.op] = (picks[s][p.op] || 0) + 1; opRounds[p.op] = (opRounds[p.op] || 0) + 1; }
    }
    if (g.phase !== last && g.phase === PHASE.ROUND_END) {
      rounds++; const L = g.roundLog[g.roundLog.length - 1];
      reasons[L.reason] = (reasons[L.reason] || 0) + 1; if (L.side === TEAM.ATK) atkWins++;
      durs.push(Math.round(rt)); if (g.planted || L.reason.startsWith('Defuser')) inc('planted');
    }
    last = g.phase;
  }
  for (const l of g.proLog || []) if (Math.random() < 0.04) calls.push(`${id} r${l.round} ${l.who || l.team}: ${l.text}`);
}
const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`${rounds} rounds, attackers won ${pct(atkWins, rounds)}; level ${level}`);
console.log('How rounds end:', top(reasons));
const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
durs.sort((a, b) => a - b); console.log(`Action phase length: median ${durs[durs.length >> 1]} s, avg ${avg(durs)} s; first kill avg ${avg(firstKill)} s in`);
console.log('Counts:', top(C));
console.log('\nATTACK picks:', top(picks.atk)); console.log('\nDEFENCE picks:', top(picks.def));
const never = Object.keys(OPERATORS).filter(k => !opRounds[k]); console.log('\nNever picked:', never.join(', ') || '-');
console.log('\nAbility uses per round played:'); console.log(Object.keys(opRounds).sort((a, b) => (abil[a] || 0) / opRounds[a] - (abil[b] || 0) / opRounds[b]).map(k => `${k} ${((abil[k] || 0) / opRounds[k]).toFixed(1)}`).join(', '));
console.log('\nGadget uses per round played:'); console.log(Object.keys(opRounds).sort((a, b) => (gad[a] || 0) / opRounds[a] - (gad[b] || 0) / opRounds[b]).map(k => `${k} ${((gad[k] || 0) / opRounds[k]).toFixed(1)}`).join(', '));
console.log('\nSome calls:'); for (const c of calls.slice(0, 30)) console.log('  ' + c);
process.exit(0);
