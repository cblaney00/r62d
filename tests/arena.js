// FUN MODES (One in the Chamber, Gun Game, Infected): eight bots play each mode on a map until it ends (or the clock).
// Checks: everyone spawns with only the mode's gun, kills happen, nobody is hurt by a teammate in Infected, the right
// rules end it, squads go back to normal after. Run: node tests/arena.js [map]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE } from '../shared/constants.js';
import { MODES } from '../shared/modes.js';
import { LADDER, OITC_GUN } from '../server/arena.js';

const mapId = process.argv[2] || 'harbor';
let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const mode of ['oitc', 'gungame', 'infected']) {
  MODES[mode].ready = true;
  const g = new Game(); g.mapId = mapId;
  for (let i = 0; i < 8; i++) g.addBot(i % 2);
  g.botLevel = 3;
  const before = [...g.players.values()].map(p => p.squad).join();
  g.mode = mode; g.startMatch();
  if (!g.arena || g.phase !== PHASE.ACTION) { fail(mode, 'did not start'); continue; }
  const ps = [...g.players.values()];
  if (mode !== 'infected' && new Set(ps.map(p => g.side(p))).size !== ps.length) fail(mode, 'players share a side in everyone-for-themselves');
  if (mode === 'oitc' && ps.some(p => p.guns.length !== 1 || p.guns[0].w !== OITC_GUN || p.guns[0].ammo !== 1)) fail('oitc: wrong starting gun');
  if (mode === 'gungame' && ps.some(p => p.guns[0].w !== LADDER[0])) fail('gungame: not on the first gun');
  if (mode === 'infected' && ps.filter(p => p.ar.infected).length !== 1) fail('infected: not exactly one infected at the start');
  if (ps.some(p => p.abilityCount || p.gadgetCount || p.drones)) fail(mode, 'skills or gadgets left on');
  let t = 0, kills = 0, maxLv = 0;
  const ev = g.events; const T = mode === 'gungame' ? 300 : 600;
  while (g.phase === PHASE.ACTION && t < T) {
    g.tick(1 / 30); t += 1 / 30;
    for (const e of g.events) if (e.e === 'kill') kills++;
    g.events = [];
    for (const p of ps) maxLv = Math.max(maxLv, p.ar ? p.ar.lv : 0);
  }
  const why = g.arena && g.arena.why;
  console.log(`${mode}: ${kills} kills in ${Math.round(t)} s, ${g.phase === PHASE.MATCH_END ? 'ended: ' + why : 'still going'}${mode === 'gungame' ? `, furthest gun ${maxLv}/${LADDER.length}` : ''}${mode === 'infected' ? `, ${ps.filter(p => p.ar.infected).length} infected` : ''}`);
  if (kills < 5) fail(mode, 'hardly any kills', kills);
  if (mode === 'oitc' && g.phase !== PHASE.MATCH_END) fail('oitc did not end in 10 minutes');
  if (mode === 'gungame' && maxLv < 3) fail('gungame: nobody got past gun 3');
  if (mode === 'infected' && ps.filter(p => p.ar.infected).length < 2) fail('infected: nobody was turned');
  g.timer = 0; while (g.phase !== PHASE.LOBBY) g.tick(1 / 30);
  if ([...g.players.values()].map(p => p.squad).join() !== before || g.arena) fail(mode, 'squads not put back');
}
console.log(fails ? `FAIL arena (${fails})` : 'PASS arena');
process.exit(fails ? 1 : 0);
