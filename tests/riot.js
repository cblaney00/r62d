// Riot shields (he asked: a few operators get one as their third primary, each with its own personality): every
// shield is up in front with the pistol behind it, stops bullets from the front but not the back, each one's own
// rule works (VISOR fires round it, GLASS cracks, RAM smashes a barricade, THORN stuns, BASTION covers more planted),
// and bots carrying one fight with it. Run: node tests/riot.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { T, TEAM, CELL } from '../shared/constants.js';
import { RIOT, LOADOUTS, OPERATORS, WEAPONS } from '../shared/operators.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const owners = Object.entries(LOADOUTS).filter(([, L]) => L.primaries.some(w => RIOT[w]));
if (owners.filter(([o]) => OPERATORS[o].team === 'atk').length !== 3 || owners.filter(([o]) => OPERATORS[o].team === 'def').length !== 3) fail('want 3 shield operators per side');
for (const [op, L] of owners) {
  const sh = L.primaries.find(w => RIOT[w]), R = RIOT[sh];
  const g = new Game({ free: true }); g.mapId = 'harbor'; g.map = buildMap('harbor');
  const a = g.addPlayer('Holder', false), b = g.addPlayer('Shooter', false);
  g.handle(a, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
  a.op = op; a.loadout = null; g.store = null;
  const store = { primary: sh, secondary: L.secondaries[0], gadget: L.gadgets[0], att: {} };
  a.bot = true; g.botLoadout = () => store; g.equip(a); a.bot = false;
  if (!a.riot || a.guns.length !== 1 || WEAPONS[a.guns[0].w].cls !== 'Pistol') { fail(op, 'shield not equipped with a pistol', a.riot, a.guns.map(x => x.w)); continue; }
  const tick = (s, ia = {}) => { for (let i = 0; i < s * 30; i++) { a.prevInput = a.input; a.input = { ...ia }; b.prevInput = b.input; b.input = {}; g.tickPlayer(a, 1 / 30); g.time += 1 / 30; } };
  const spot = g.freeSpotNear(g.map.sites[0].bombs[0].x, g.map.sites[0].bombs[0].y, 30);
  Object.assign(a, { x: spot.x, y: spot.y, aim: 0, alive: true, hp: 100, ctrl: 'body', downed: false });
  b.squad = 1 - a.squad; b.op = OPERATORS[b.op] && OPERATORS[b.op].team !== OPERATORS[op].team ? b.op : Object.keys(OPERATORS).find(o => OPERATORS[o].team !== OPERATORS[op].team);
  Object.assign(b, { x: spot.x + 40, y: spot.y, aim: Math.PI, alive: true, hp: 100, ctrl: 'body', downed: false });
  tick(0.2);
  if (!a.bracing) { fail(op, 'shield not up'); continue; }
  const hp0 = a.hp, r = g.hitscan(b, b.x, b.y, Math.PI, 300, 30, 'K4', 'AR');
  if (r.k !== 'shield' || a.hp !== hp0) fail(op, sh, 'front shot not stopped', r.k);
  b.x = spot.x - 40; const r2 = g.hitscan(b, b.x, b.y + 4, 0, 300, 10, 'K4', 'AR'); // from behind (off the head: a head shot would end the test)
  if (r2.k === 'shield') fail(op, sh, 'a shot from behind hit the shield');
  a.hp = 100; b.x = spot.x + 40;
  // shooting: VISOR at once, the others only once swung aside (aim in)
  const canShoot = () => { a.guns[0].ammo = 10; a.fireCd = 0; a.reloadT = 0; const before = a.guns[0].ammo; a.click = { ax: a.x + 50, ay: a.y }; tick(0.1, { fire: 1 }); return a.guns[0].ammo < before; };
  const now = canShoot();
  if (!!R.hip !== now) fail(op, sh, R.hip ? 'VISOR cannot fire with it up' : 'fired with the shield up');
  tick(R.aside + 0.2, { ads: 1 }); a.prevInput = { ads: 1 };
  if (!R.hip && !(() => { a.guns[0].ammo = 10; a.fireCd = 0; const be = a.guns[0].ammo; a.click = { ax: a.x + 50, ay: a.y }; tick(0.1, { ads: 1, fire: 1 }); return a.guns[0].ammo < be; })()) fail(op, sh, 'cannot fire after swinging it aside');
  tick(1);
  // its own rule
  if (R.hp) { for (let i = 0; i < 40 && !a.riotBroken; i++) g.hitscan(b, b.x, b.y, Math.PI, 300, 30, 'K4', 'AR'); if (!a.riotBroken) fail(op, 'GLASS never cracked'); }
  if (R.plant) { a.input = { crouch: 1 }; a.moving = 0; const wide = g.shieldOf(a).arc; a.input = {}; const nar = g.shieldOf(a).arc; if (!(wide > nar + 0.3)) fail(op, 'BASTION planted covers no more', wide, nar); }
  if (R.stun || R.bash) { a.meleeCd = 0; a.aim = 0; b.x = spot.x + 20; b.hp = 100; b.stunUntil = 0; g.melee(a); if (b.hp > 100 - R.bash + 1) fail(op, sh, 'bash did not hit', b.hp); if (R.stun && !(b.stunUntil > g.time)) fail(op, 'THORN bash did not stun'); }
  if (R.breaks) { // a whole barricade in one bash
    const o = g.map.openings.find(o => o.kind === 'door'), k = o.cells[0]; g.barricade(o.id, T.BARRI);
    const W = g.map.W, cx = k % W, cy = Math.floor(k / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const f = (cy + dy) * W + cx + dx; if (g.map.tiles[f] === T.FLOOR) { a.x = (cx + dx + 0.5) * CELL; a.y = (cy + dy + 0.5) * CELL; a.aim = Math.atan2(-dy, -dx); break; } }
    b.x = -999; a.meleeCd = 0; g.melee(a);
    if (o.cells.some(c => g.map.tiles[c] === T.BARRI)) fail(op, 'RAM bash did not smash the barricade');
  }
  console.log(`${OPERATORS[op].name.padEnd(8)} ${R.name.padEnd(14)} ok`);
}
console.log(fails ? `${fails} failure(s)` : 'PASS riot shields');
process.exit(fails ? 1 : 0);
