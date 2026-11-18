// Picking your own gadgets back up (he asked 2026-11-18): for every operator whose ability places something that can
// be picked up, and the placed gadgets (wire, claymore, deployable shield): place it, check a teammate can't take it,
// hold Use on it, check it is gone and the count is back, then place it again. Run: node tests/pickup.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { OPERATORS, OP_LIST } from '../shared/operators.js';
import { PHASE, T, CELL } from '../shared/constants.js';
const ABIL = new Set(['prox', 'concuss', 'clamp', 'sensor', 'plates', 'turret', 'grid', 'jammer', 'mine', 'alarm', 'pace', 'radar', 'station', 'catcher', 'cover']);
const cases = OP_LIST.filter(o => ABIL.has(OPERATORS[o].ability.id)).map(o => [o, null]).concat([['mason', 'wire'], ['bulwark', 'claymore'], ['mason', 'dshield']]);
const still = { up: 0, down: 0, left: 0, right: 0, fire: 0, ads: 0, ability: 0, interact: 0 };
function faceWall(g, p) { // for SHUNT's grid: stand in front of a soft wall
  const m = g.map;
  for (let k = 0; k < m.tiles.length; k++) { if (m.tiles[k] !== T.SOFT) continue; const x = k % m.W, y = Math.floor(k / m.W);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const f = (y + dy) * m.W + x + dx, f2 = (y + 2 * dy) * m.W + x + 2 * dx;
      if (m.tiles[f] !== T.FLOOR || m.tiles[f2] !== T.FLOOR) continue; p.x = (x + dx * 1.9 + 0.5) * CELL; p.y = (y + dy * 1.9 + 0.5) * CELL; p.aim = Math.atan2(-dy, -dx); return true; } }
}
function openSpot(g, p) { // a spot with open floor all round, so the gadget lands in front of us
  const m = g.map;
  for (let k = m.W * 4; k < m.tiles.length - m.W * 4; k += 7) { const x = k % m.W, y = Math.floor(k / m.W); let ok = true;
    for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3 && ok; dx++) if (m.tiles[(y + dy) * m.W + x + dx] !== T.FLOOR) ok = false;
    if (ok && m.floor[k] === g.map.floor[Math.floor(p.y / CELL) * m.W + Math.floor(p.x / CELL)]) { p.x = (x + 0.5) * CELL; p.y = (y + 0.5) * CELL; p.aim = 0; return true; } }
}
let fails = 0;
for (const [op, gadget] of cases) {
  const team = OPERATORS[op].team;
  let g, p, mate;
  do {
    g = new Game();
    for (let i = 0; i < 10; i++) g.addBot();
    g.startMatch();
    while (g.phase !== PHASE.ACTION) g.tick(1 / 30);
    p = [...g.players.values()].find(q => g.side(q) === team && q.alive);
    mate = p && [...g.players.values()].find(q => q !== p && g.side(q) === team && q.alive);
  } while (!p || !mate);
  for (const q of g.players.values()) { q.bot = false; q.input = { ...still }; } // everyone stands still (killing them would end the round)
  p.op = op; g.equip(p); p.bot = false; mate.bot = false;
  if (gadget) { p.gadget = gadget; p.gadgetCount = 1; }
  if (OPERATORS[op].ability.id === 'grid' && !gadget) faceWall(g, p); else openSpot(g, p);
  const count = () => gadget ? p.gadgetCount : p.abilityCount;
  const run = (n, who, inp) => { for (let i = 0; i < n; i++) { who.input = { ...still, ...inp }; g.tick(1 / 30); } };
  run(45, p, {}); // (a moment to get ready after switching operator)
  const c0 = count(), e0 = g.ents.length, sh0 = g.map.tiles.filter(t => t === T.DSHIELD).length;
  g.event(p, { k: gadget ? 'gadget' : 'ability' }); run(75, p, {});
  const placed = gadget === 'dshield' ? g.map.tiles.filter(t => t === T.DSHIELD).length > sh0 : g.ents.length > e0;
  const c1 = count();
  // a teammate standing where we stand, facing the same way, holding Use: must not get it
  const save = { x: p.x, y: p.y, aim: p.aim }; mate.x = p.x; mate.y = p.y; mate.aim = p.aim; p.x += 400;
  const mateSaw = !!g.pickTarget(mate); run(45, mate, { interact: 1 });
  const stillThere = gadget === 'dshield' ? g.map.tiles.filter(t => t === T.DSHIELD).length > sh0 : g.ents.length > e0;
  mate.x += 300; Object.assign(p, save);
  const saw = g.pickTarget(p); run(45, p, { interact: 1 }); run(3, p, {});
  const gone = gadget === 'dshield' ? g.map.tiles.filter(t => t === T.DSHIELD).length === sh0 : g.ents.length === e0;
  const c2 = count();
  g.event(p, { k: gadget ? 'gadget' : 'ability' }); run(75, p, {});
  const again = gadget === 'dshield' ? g.map.tiles.filter(t => t === T.DSHIELD).length > sh0 : g.ents.length > e0;
  const ok = placed && c1 === c0 - 1 && !mateSaw && stillThere && saw && gone && c2 === c0 && again;
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${op.padEnd(8)} ${(gadget || OPERATORS[op].ability.id).padEnd(9)} placed ${placed} count ${c0}->${c1}->${c2} teammate ${mateSaw ? 'SAW IT' : 'no'} kept ${stillThere} prompt ${saw ? saw.name : '-'} gone ${gone} again ${again}`);
}
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
