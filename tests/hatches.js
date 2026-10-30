// Floor hatches: 2x2 trapdoors in upper floors above a room. Defenders reinforce them (E), melee / shotguns /
// explosives open them, an open one drops you to the floor below, and a shot aimed into it hits whoever is
// at that spot on the other floor. Run: node tests/hatches.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap, floorAt, roomAt } from '../shared/map.js';
import { PHASE, T, CELL, TEAM, CELL_HP } from '../shared/constants.js';
import { WEAPONS } from '../shared/operators.js';

let fails = 0, total = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
for (const id of MAP_LIST) {
  const m0 = buildMap(id);
  total += m0.hatches.length;
  for (const h of m0.hatches) {
    if (!h.cells.every(k => m0.tiles[k] === T.HATCH)) fail(id, 'hatch', h.id, 'cells are not hatch tiles');
    if (!h.below.every(k => m0.tiles[k] === T.FLOOR)) fail(id, 'hatch', h.id, 'has no clear floor below');
    if (floorAt(m0, h.bx, h.by) !== h.fl - 1) fail(id, 'hatch', h.id, 'is not over the floor below');
  }
  if (!m0.hatches.length) continue;
  const g = new Game();
  for (let i = 0; i < 4; i++) g.addBot();
  g.mapId = id; g.map = buildMap(id); g.startMatch();
  while (g.phase !== PHASE.ACTION) g.tick(1 / 30);
  for (const q of g.players.values()) q.bot = false; // hold still: this test moves them by hand
  for (const h of g.map.hatches) for (const k of h.cells) if (g.map.tiles[k] === T.HATCHR) { g.map.tiles[k] = T.HATCH; g.map.hp[k] = CELL_HP[T.HATCH]; } // bots reinforce hatches over the site in prep: start from plain ones
  const ps = [...g.players.values()], def = ps.find(q => g.side(q) === TEAM.DEF), atk = ps.find(q => g.side(q) === TEAM.ATK);
  const ready = q => { q.alive = true; q.downed = false; q.hp = 100; q.ctrl = 'body'; q.busy = null; q.meleeCd = 0; q.stunUntil = 0; q.input = { ...q.input, up: 0, down: 0, left: 0, right: 0, fire: 0, interact: 0 }; };
  for (const h of g.map.hatches) {
    const tag = `${id} hatch ${h.id} (${roomAt(g.map, h.x, h.y)}):`;
    // a defender standing on it reinforces it
    ready(def); def.x = h.x - 12; def.y = h.y; def.aim = 0; g.reinforce = 5;
    const b = g.startInteract(def);
    if (!b || b.hatch !== h.id) { fail(tag, 'defender could not start reinforcing', b && b.k); continue; }
    def.busy = b; for (let i = 0; i < 200 && def.busy; i++) g.continueInteract(def, 1 / 30);
    if (g.map.tiles[h.cells[0]] !== T.HATCHR) fail(tag, 'not reinforced');
    def.x = h.bx; def.y = h.by; // out of the way downstairs
    // a reinforced hatch shrugs off melee
    ready(atk); atk.x = h.x - 12; atk.y = h.y; atk.aim = 0;
    for (let i = 0; i < 5; i++) { atk.meleeCd = 0; g.melee(atk); }
    if (g.map.tiles[h.cells[0]] !== T.HATCHR) fail(tag, 'melee broke a reinforced hatch');
    // put it back to a plain hatch: three melee hits open it
    for (const c of h.cells) { g.map.tiles[c] = T.HATCH; g.map.hp[c] = 60; g.map.portal[c] = -1; }
    for (let i = 0; i < 3; i++) { atk.meleeCd = 0; g.melee(atk); }
    if (g.map.tiles[h.cells[0]] !== T.HOLE) { fail(tag, 'three melee hits did not open it', g.map.hp[h.cells[0]]); continue; }
    // walking onto it drops you to the floor below
    const f0 = floorAt(g.map, atk.x, atk.y);
    atk.input = { ...atk.input, right: 1 };
    for (let i = 0; i < 30 && floorAt(g.map, atk.x, atk.y) === f0; i++) g.applyMove(atk, 1 / 30);
    atk.input = { ...atk.input, right: 0 };
    if (floorAt(g.map, atk.x, atk.y) !== h.fl - 1) fail(tag, 'walking onto the hole did not drop to the floor below');
    // a shot aimed into the hole hits someone standing under it
    ready(atk); atk.x = h.x - 22; atk.y = h.y; atk.aim = 0; atk.aimX = h.x; atk.aimY = h.y; atk.viewTime = null;
    ready(def); def.x = h.bx; def.y = h.by;
    const hp0 = def.hp, gun = { w: 'r4', ammo: 30, reserve: 0, att: {}, m: null };
    const wk = Object.keys(WEAPONS).find(k => WEAPONS[k].cls === 'AR');
    gun.w = wk; atk.rc = 0; atk.adsT = 1; atk.bloom = 0; atk.vx = atk.vy = 0;
    for (let i = 0; i < 3 && def.hp === hp0; i++) g.fire(atk, gun, WEAPONS[wk]);
    if (def.hp === hp0) fail(tag, 'a shot into the hole did not hit the defender below');
    // and back up: from underneath, aiming at the hole hits someone at its edge upstairs
    ready(atk); atk.x = h.bx - 30; atk.y = h.by; atk.aimX = h.bx; atk.aimY = h.by;
    ready(def); def.x = h.x; def.y = h.y - 2; // standing right over the hole (would fall, but not moved here)
    const hp1 = def.hp;
    for (let i = 0; i < 3 && def.hp === hp1; i++) g.fire(atk, gun, WEAPONS[wk]);
    if (def.hp === hp1) fail(tag, 'a shot up through the hole did not hit the defender above');
  }
  // a breaching charge set on a hatch blows it open
  const g2 = new Game(); g2.addBot(); g2.mapId = id; g2.map = buildMap(id); g2.startMatch();
  while (g2.phase !== PHASE.ACTION) g2.tick(1 / 30);
  const h = g2.map.hatches[0], p = [...g2.players.values()][0];
  g2.explode({ x: h.x, y: h.y, team: TEAM.ATK, owner: p.id }, { r: 40, dmg: 0, cellR: 21, cells: [T.SOFT, T.BARRI, T.HATCH], kind: 'breach', at: h.cells[0] });
  if (g2.map.tiles[h.cells[0]] !== T.HOLE) fail(id, 'a breaching charge did not open a hatch');
}
console.log(`${total} hatches on ${MAP_LIST.length} maps`);
console.log(fails ? `${fails} failure(s)` : 'PASS hatches');
process.exit(fails ? 1 : 0);
