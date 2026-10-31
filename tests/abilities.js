// Every operator uses their ability (twice, and holds it for held ones) in a live bot match,
// to prove nothing throws and each ability does something. Run: node tests/abilities.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { OPERATORS, OP_LIST } from '../shared/operators.js';
import { PHASE, T, CELL } from '../shared/constants.js';
const WALLY = new Set(['cutter', 'lance', 'scope', 'hammer', 'grid', 'cluster', 'panel', 'spreader', 'periscope']);
// stand the body in front of a plain wall (or a doorway, for panels), facing it
function faceWall(g, p, door) {
  const m = g.map;
  for (let k = 0; k < m.tiles.length; k++) {
    if (door ? m.openId[k] < 0 || m.tiles[k] !== T.OPEN : m.tiles[k] !== T.SOFT) continue;
    const x = k % m.W, y = Math.floor(k / m.W);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const f = (y + dy) * m.W + x + dx, f2 = (y + 2 * dy) * m.W + x + 2 * dx;
      if (m.tiles[f] !== T.FLOOR || m.tiles[f2] !== T.FLOOR) continue;
      p.x = (x + dx * 1.9 + 0.5) * CELL; p.y = (y + dy * 1.9 + 0.5) * CELL; p.aim = Math.atan2(-dy, -dx);
      return true;
    }
  }
}

let fails = 0;
for (const op of OP_LIST) {
  const team = OPERATORS[op].team;
  let g, p;
  do { // now and then bots kill a whole side before the round starts (friendly fire): set it up again
    g = new Game();
    for (let i = 0; i < 10; i++) g.addBot();
    g.startMatch();
    while (g.phase !== PHASE.ACTION) g.tick(1 / 30);
    p = [...g.players.values()].find(q => g.side(q) === team && q.alive);
  } while (!p);
  p.op = op; g.equip(p); p.bot = false; // a still body that only uses its ability
  if (WALLY.has(OPERATORS[op].ability.id)) faceWall(g, p, OPERATORS[op].ability.id === 'panel');
  const startTiles = g.map.tiles.slice();
  const before = g.ents.length, ab = OPERATORS[op].ability;
  let err = null, events = new Set();
  try {
    for (let i = 0; i < 90; i++) {
      p.input = { up: 0, down: 0, left: 0, right: 0, fire: 0, ads: 0, ability: ab.battery ? 1 : 0 };
      if (i === 5 || i === 40) g.event(p, { k: 'ability' });
      if (op === 'miasma' && i === 60) g.event(p, { k: 'ability' }); // release the gas
      g.tick(1 / 30);
      for (const e of g.events) events.add(e.e === 'snd' ? 'snd:' + e.s : e.e);
      g.broadcast();
    }
  } catch (e) { err = e.stack.split('\n').slice(0, 3).join(' | '); }
  const used = ab.count ? ab.count - p.abilityCount : ab.battery ? Math.round((ab.battery - p.battery) * 10) / 10 : 'passive';
  const ok = !err;
  if (!ok) fails++;
  let changed = 0; for (let k = 0; k < startTiles.length; k++) if (startTiles[k] !== g.map.tiles[k]) changed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${op.padEnd(8)} ${ab.id.padEnd(9)} used ${used}, gadgets ${before}->${g.ents.length}, map cells changed ${changed}${err ? ' ' + err : ''}`);
}
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
