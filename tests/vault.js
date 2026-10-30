// Vaulting: bodies can't walk through windows, low furniture or the stub of a knocked-through wall, but Space
// carries them over (no shooting meanwhile, a short wait before aiming); explosions clear stubs, melee too.
// Run: node tests/vault.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { MAP_LIST, buildMap } from '../shared/map.js';
import { PHASE, T, CELL, FL } from '../shared/constants.js';
import { vaultable, findVault } from '../shared/physics.js';

let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const ready = (g, q) => { q.alive = true; q.downed = false; q.ctrl = 'body'; q.busy = null; q.vault = null; q.stunUntil = 0; q.recoverUntil = 0; q.input = { ...q.input, up: 0, down: 0, left: 0, right: 0, fire: 0, ads: 0 }; };
for (const id of MAP_LIST) {
  const g = new Game();
  for (let i = 0; i < 2; i++) g.addBot();
  g.mapId = id; g.map = buildMap(id); g.startMatch();
  while (g.phase !== PHASE.ACTION) g.tick(1 / 30);
  for (const q of g.players.values()) q.bot = false;
  const p = [...g.players.values()][0], m = g.map, W = m.W;
  // every window: walking into it stops you; vaulting from in front of it lands you on the other side
  let wins = 0, ok = 0;
  for (const o of m.openings) {
    if (o.kind !== 'window' || m.tiles[o.cells[0]] !== T.OPEN) continue;
    const k = o.cells[0], cx = k % W, cy = Math.floor(k / W);
    const across = m.tiles[k + 1] === T.OPEN || m.tiles[k - 1] === T.OPEN ? [0, 1] : [1, 0]; // window runs along x: cross in y
    for (const s of [1, -1]) {
      const clear = d => { const t = m.tiles[(cy + across[1] * d) * W + cx + across[0] * d]; return t === T.FLOOR || t === T.GROUND; };
      if (![1, 2].every(d => clear(s * d) && clear(-s * d))) continue; // floor on both sides (not a window over thin air)
      wins++;
      ready(g, p); p.x = (cx + 0.5 + across[0] * s * 1.6) * CELL; p.y = (cy + 0.5 + across[1] * s * 1.6) * CELL;
      const ang = Math.atan2(-across[1] * s, -across[0] * s); p.aim = ang;
      // walk at it: blocked
      p.input = { ...p.input, right: across[0] * -s > 0 ? 1 : 0, left: across[0] * -s < 0 ? 1 : 0, down: across[1] * -s > 0 ? 1 : 0, up: across[1] * -s < 0 ? 1 : 0 };
      const x0 = p.x, y0 = p.y;
      for (let i = 0; i < 30; i++) g.applyMove(p, 1 / 30);
      const past = ((p.x - (cx + 0.5) * CELL) * -across[0] * s + (p.y - (cy + 0.5) * CELL) * -across[1] * s) > 0;
      if (past) { fail(id, 'walked through window at', cx, cy); continue; }
      ready(g, p);
      if (!g.startVault(p, ang)) { fail(id, 'could not vault window at', cx, cy, 'from', Math.round(p.x - x0), Math.round(p.y - y0)); continue; }
      let shot = false; p.input = { ...p.input, fire: 1 }; const ammo = p.guns[0].ammo;
      for (let i = 0; i < 40 && p.vault; i++) { g.tickPlayer(p, 1 / 30); p.prevInput = { ...p.input, fire: 0 }; }
      if (p.guns[0].ammo !== ammo) shot = true;
      p.input = { ...p.input, fire: 0 };
      const over = ((p.x - (cx + 0.5) * CELL) * -across[0] * s + (p.y - (cy + 0.5) * CELL) * -across[1] * s) > CELL * 0.8;
      if (!over) fail(id, 'vault did not land past the window at', cx, cy);
      else if (shot) fail(id, 'fired while vaulting');
      else ok++;
      break;
    }
  }
  // a soft wall knifed through leaves a stub: blocks walking, can be vaulted, a melee clears it
  g.ents = []; for (const q of g.players.values()) if (q !== p) q.alive = false; // nothing else for the knife to hit
  let stubs = 0;
  for (const [a, c] of [[1, W], [W, 1]]) for (let k = W; k < m.tiles.length - W && stubs < 3; k++) { // a wall running along a, crossed along c
    if (m.tiles[k] !== T.SOFT || m.tiles[k - a] !== T.SOFT || m.tiles[k + a] !== T.SOFT) continue;
    if (m.tiles[k - c] !== T.FLOOR || m.tiles[k + c] !== T.FLOOR || m.tiles[k - 2 * c] !== T.FLOOR || m.tiles[k + 2 * c] !== T.FLOOR) continue;
    const cx = k % W, cy = Math.floor(k / W), across = c === W;
    ready(g, p); p.x = (cx + (across ? 0.5 : -0.6)) * CELL; p.y = (cy + (across ? -0.6 : 0.5)) * CELL; p.aim = across ? Math.PI / 2 : 0;
    for (let i = 0; i < 4 && m.tiles[k] === T.SOFT; i++) { p.meleeCd = 0; g.melee(p); }
    if (m.tiles[k] !== T.RUBBLE) { fail(id, 'knifed wall at', cx, cy, 'is', m.tiles[k]); continue; }
    if (!vaultable(m, k)) fail(id, 'stub not vaultable');
    const to = findVault(m, p.x, p.y, p.aim);
    if (!to || (across ? to.y < (cy + 1) * CELL : to.x < (cx + 1) * CELL)) fail(id, 'cannot vault the stub at', cx, cy, to && Math.round(to.y - p.y));
    p.meleeCd = 0; g.melee(p);
    if (m.tiles[k] === T.RUBBLE) fail(id, 'melee did not clear the stub at', cx, cy);
    stubs++;
  }
  if (!stubs) fail(id, 'no plain wall to test a stub on');
  // explosions leave a clean hole, no stub
  for (let k = 0; k < m.tiles.length; k++) if (m.tiles[k] === T.SOFT && m.tiles[k - W] === T.FLOOR && m.tiles[k + W] === T.FLOOR) {
    g.explode({ x: (k % W + 0.5) * CELL, y: Math.floor(k / W) * CELL - 4, team: 'atk', owner: p.id }, { r: 40, dmg: 0, cellR: 21, cells: [T.SOFT, T.BARRI, T.HATCH, T.RUBBLE], kind: 'breach', at: k });
    if (m.tiles[k] !== T.FLOOR) fail(id, 'a blast left', m.tiles[k], 'not floor');
    break;
  }
  console.log(`${id}: vaulted ${ok}/${wins} windows checked, ${stubs} wall stubs`);
}
console.log(fails ? `${fails} failure(s)` : 'PASS vault');
process.exit(fails ? 1 : 0);
