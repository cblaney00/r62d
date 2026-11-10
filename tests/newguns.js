// The 14 guns added 2026-11-10 (he asked: two more of every type, each one unique). Checks each one's own rule in a
// live match: Verdict (semi + heavy aimed in, auto from the hip), Tandem (every other reload quick), Ferret (gun up at
// once after a sprint, tight hip), Hedge (hits slow), Cyclone (winds up), Trestle (bipod: less recoil crouched and
// still), Mammoth (one body shot through one soft wall, scoped; the Pike can't). Run: node tests/newguns.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { PHASE, T, CELL } from '../shared/constants.js';
import { WEAPONS, ARMOR_HP, gunMods, fireAuto, fireDmg, fireRpm, spreadCone, SIDEARMS, LOADOUTS, OPERATORS } from '../shared/operators.js';

let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const NEW = ['verdict', 'tandem', 'ferret', 'auger', 'quill', 'hedge', 'cyclone', 'trestle', 'ranger', 'mammoth', 'needle', 'couplet', 'whisper', 'hatchet'];
for (const w of NEW) if (!WEAPONS[w]) fail('missing gun', w);
const per = {}; for (const w of NEW) per[WEAPONS[w].cls] = (per[WEAPONS[w].cls] || 0) + 1;
for (const c of ['AR', 'SMG', 'Shotgun', 'LMG', 'DMR', 'Pistol', 'MP']) if (per[c] !== 2) fail('not two new', c, per[c]);

// Verdict
const V = WEAPONS.verdict;
if (!fireAuto(V, 0) || fireAuto(V, 1)) fail('Verdict: auto from the hip, single shots aimed in');
if (fireDmg(V, 1) <= fireDmg(V, 0) * 1.5) fail('Verdict: aimed shots not heavier');
// Cyclone
const C = WEAPONS.cyclone;
if (!(fireRpm(C, 0, 0) < C.rpm * 0.5 && Math.abs(fireRpm(C, 0, 5) - C.rpm) < 1)) fail('Cyclone does not wind up', fireRpm(C, 0, 0), fireRpm(C, 0, 5));
if (C.rpm <= Math.max(...Object.values(WEAPONS).filter(w => w !== C).map(w => w.rpm))) fail('Cyclone is not the fastest firing at full spin');
// Ferret
const F = WEAPONS.ferret, m0 = gunMods('ferret');
for (const o of ['javelin', 'wasp', 'lark', 'marten', 'auger']) if (spreadCone(F, m0, { shots: 3 }) >= spreadCone(WEAPONS[o], gunMods(o), { shots: 3 })) fail('Ferret hip spray not the tightest SMG vs', o);

const g = new Game({ free: true });
for (let i = 0; i < 2; i++) g.addBot();
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.startMatch();
for (let i = 0; i < 400 && g.phase !== PHASE.ACTION; i++) g.tick(1 / 30);
const [p, q] = [...g.players.values()];
q.hold = true; p.hold = true; // bots stand still
// Tandem
p.guns = [{ w: 'tandem', ammo: 0, reserve: 200, att: {} }]; p.slot = 0; p.reloadT = 0;
const lens = []; for (let i = 0; i < 4; i++) { g.startReload(p); lens.push(p.reloadT); p.reloadT = 0; p.guns[0].ammo = 0; }
if (!(lens[0] > 2 && lens[1] < 1.2 && lens[2] > 2 && lens[3] < 1.2)) fail('Tandem reloads', lens);

// Hedge: a hit slows
const clear = () => { const s = g.freeSpotNear(g.map.atkSpawns[0].x, g.map.atkSpawns[0].y, 200); return s; };
let slowed = false;
for (let tries = 0; tries < 40 && !slowed; tries++) {
  const s = clear(); p.x = s.x; p.y = s.y; q.alive = true; q.downed = false; q.hp = 999; q.maxHp = 999; q.x = s.x + 40; q.y = s.y; q.slowUntil = 0;
  g.shotW = WEAPONS.hedge; g.shotAim = { x: q.x, y: q.y + 5 };
  const r = g.hitscan(p, p.x, p.y, 0, 400, 14, WEAPONS.hedge.name, 'Shotgun'); g.shotW = null; g.shotAim = null;
  if (r.k === 'flesh') slowed = q.slowUntil > g.time;
}
if (!slowed) fail('Hedge hit did not slow');

// Trestle: same five shots, crouched and still vs standing
const rcAfter = low => {
  p.guns = [{ w: 'trestle', ammo: 50, reserve: 0, att: {}, m: gunMods('trestle') }]; p.slot = 0;
  p.rc = 0; p.shots = 0; p.lastShot = -9; p.vx = p.vy = 0; p.input = { crouch: low ? 1 : 0 }; p.pr = 0; p.adsT = 1;
  for (let i = 0; i < 5; i++) g.fire(p, p.guns[0], WEAPONS.trestle);
  return Math.abs(p.rc);
};
const up = rcAfter(false), down = rcAfter(true);
if (!(down < up * 0.5)) fail('Trestle bipod: recoil standing', up, 'crouched', down);

// Mammoth: one body shot through one soft wall (scoped); the Pike can't
let wall = null;
for (let y = 2; y < g.map.H - 2 && !wall; y++) for (let x = 4; x < g.map.W - 4 && !wall; x++) {
  const k = y * g.map.W + x; if (g.map.tiles[k] !== T.SOFT || g.map.shape && g.map.shape[k]) continue;
  const open = dx => [1, 2, 3].every(d => g.map.tiles[k + dx * d] === T.FLOOR && g.map.tiles[k + dx * d - g.map.W] === T.FLOOR && g.map.tiles[k + dx * d + g.map.W] === T.FLOOR);
  if (open(-1) && open(1) && g.map.tiles[k - g.map.W] === T.SOFT && g.map.tiles[k + g.map.W] === T.SOFT) wall = { x, y, k };
}
if (!wall) fail('no soft wall found for the Mammoth test');
else for (const [w, want] of [['mammoth', 'dead'], ['pike', 'alive']]) {
  g.map.tiles[wall.k] = T.SOFT; g.map.hp[wall.k] = 999;
  p.guns = [{ w, ammo: 5, reserve: 0, att: { sight: 'sniper' }, m: gunMods(w, { sight: 'sniper' }) }]; p.slot = 0; p.adsT = 1;
  p.x = (wall.x - 2.5) * CELL; p.y = (wall.y + 0.5) * CELL; q.x = (wall.x + 3.5) * CELL; q.y = p.y;
  q.alive = true; q.downed = false; q.maxHp = ARMOR_HP[1]; q.hp = q.maxHp;
  g.shotW = WEAPONS[w]; g.shotAim = { x: q.x, y: q.y + 5 };
  g.hitscan(p, p.x, p.y, 0, 600, WEAPONS[w].dmg, WEAPONS[w].name, 'DMR'); g.shotW = null; g.shotAim = null;
  const r = q.alive && !q.downed ? 'alive' : 'dead';
  console.log(`${w} through a soft wall: ${r} (${Math.round(q.hp)} hp)`);
  if (r !== want) fail(w, 'through a wall left them', r);
}
// every attacker but the shield carriers and a few close-quarters ones has a marksman rifle to choose
const atk = Object.keys(OPERATORS).filter(o => OPERATORS[o].team === 'atk');
const dmr = atk.filter(o => LOADOUTS[o].primaries.some(w => WEAPONS[w] && WEAPONS[w].cls === 'DMR'));
console.log(`attackers with a marksman rifle: ${dmr.length} of ${atk.length}`);
if (dmr.length < atk.length * 0.6) fail('too few attackers with a marksman rifle');
for (const w of ['needle', 'couplet', 'whisper', 'hatchet']) if (!SIDEARMS.has(w)) fail(w, 'not a sidearm');
console.log(fails ? `${fails} failure(s)` : 'PASS newguns');
process.exit(fails ? 1 : 0);
