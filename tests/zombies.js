// ZOMBIES on Lantern Point (server/zombies.js). Two helper bots hold the Town Hall while the waves come; checks that
// zombies spawn, reach the windows, tear boards and climb in, die for points, that rounds go up, and that buying works
// (gate, wall gun, ammo, power, perk, crate, forge) and boards go back on. Run: node tests/zombies.js [seconds]
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { PHASE, T } from '../shared/constants.js';
import { zbStation } from '../server/zombies.js';

const secs = +process.argv[2] || 150;
let fails = 0;
const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game();
g.addBot(0); g.addBot(0); g.addBot(0); g.botLevel = 4;
g.mode = 'zombies'; g.startMatch();
const m = g.map, Zs = g.zb;
if (!Zs || g.phase !== PHASE.ACTION || m.id !== 'lantern') fail('did not start on Lantern Point');
const ps = [...g.players.values()];
if (ps.some(p => p.guns.length !== 1 || p.guns[0].w !== 'p10' || p.zb.pts !== 500)) fail('wrong start: pistol and 500 points');
if (Zs.gates.some(gt => gt.cells.some(k => m.tiles[k] !== T.BEAM))) fail('gates not closed');
const wins = Object.keys(Zs.boards).length; if (wins < 10) fail('only', wins, 'boarded windows');
let torn = 0, climbs = 0, kills = 0, maxZ = 0;
const startBoards = { ...Zs.boards };
for (let t = 0; t < secs && g.phase === PHASE.ACTION; t += 1 / 30) {
  g.tick(1 / 30);
  for (const e of g.events) { if (e.e === 'kill') kills++; if (e.e === 'snd' && e.s === 'board') torn++; if (e.e === 'snd' && e.s === 'vault') climbs++; }
  g.events = [];
  maxZ = Math.max(maxZ, [...g.players.values()].filter(p => p.zombie && p.alive).length);
}
const pts = ps.map(p => p.zb ? p.zb.earned : 0);
console.log(`${secs} s: round ${Zs.round}, ${maxZ} zombies at once, ${torn} boards torn, ${climbs} climbs, ${kills} kills, points earned ${pts.join('/')}`);
if (maxZ < 3) fail('hardly any zombies came');
if (torn < 3) fail('zombies did not tear boards');
if (kills < 3) fail('hardly any kills');
if (Zs.round < 2 && g.phase === PHASE.ACTION) fail('never got past round 1');
if (!pts.some(n => n > 50)) fail('no points earned');

// buying, with a fresh game and a person standing at each station
{
  const g2 = new Game(); const login = { profile: { name: 'Buyer' } };
  const p = g2.addPlayer('Buyer', false); p.sock = { open: true, send() {} };
  g2.mode = 'zombies'; g2.startMatch(); const Z2 = g2.zb, M = g2.map.zombies;
  p.zb.pts = 50000;
  const press = (x, y) => { p.x = x; p.y = y; p.prevInput = { interact: 0 }; p.input = { ...p.input, interact: 1 }; const st = zbStation(g2, p); g2.tickPlayer(p, 1 / 30); p.prevInput = { interact: 1 }; return st; };
  const fd = Z2.gates[0]; const st = press(fd.x - 20, fd.y);
  if (!st || st.k !== 'gate' || !Z2.open.has(1) || fd.cells.some(k => g2.map.tiles[k] !== T.OPEN)) fail('could not buy the Front Doors', st && st.k);
  const wg = M.guns[0]; press(wg.x, wg.y);
  if (!p.guns.some(x => x.w === wg.w)) fail('wall gun not given');
  const gi = p.guns.findIndex(x => x.w === wg.w); p.guns[gi].reserve = 0; const before = p.zb.pts; press(wg.x, wg.y);
  if (!(p.guns[gi].reserve > 0) || before - p.zb.pts !== wg.cost / 2) fail('ammo not bought for half');
  const pk = M.perks[1]; press(pk.x, pk.y); if (p.zb.perks.length) fail('a perk worked without power');
  press(M.power.x, M.power.y); if (!Z2.power) fail('power did not come on');
  press(pk.x, pk.y); if (!p.zb.perks.includes(pk.id)) fail('perk not bought with power on');
  const cr = M.crates[Z2.crate.at]; press(cr.x, cr.y); if (!Z2.crate.busy && !Z2.crate.moving) fail('crate did not roll');
  for (let i = 0; i < 100; i++) g2.tick(1 / 30);
  if (p.guns.length !== 2) fail('crate gun not given');
  p.slot = 0; press(M.forge.x, M.forge.y); if (!p.guns[0].up) fail('forge did nothing');
  // a window: take boards off and put them back
  const oi = +Object.keys(Z2.boards)[0], o = g2.map.openings[oi], k = o.cells[0], W = g2.map.W;
  g2.zb.boards[oi] = 2; const wx = (k % W + 0.5) * 16, wy = (Math.floor(k / W) + 0.5) * 16;
  for (const [dx, dy] of [[24, 0], [-24, 0], [0, 24], [0, -24]]) { p.x = wx + dx; p.y = wy + dy; const s2 = zbStation(g2, p); if (s2 && s2.k === 'window') break; }
  p.input = { ...p.input, interact: 1 }; p.prevInput = { interact: 1 };
  for (let i = 0; i < 70; i++) g2.tickPlayer(p, 1 / 30);
  if (!(g2.zb.boards[oi] > 2)) fail('boards not put back', g2.zb.boards[oi]);
  // everyone dead = game over
  p.alive = false; g2.tick(1 / 30);
  if (g2.phase !== PHASE.MATCH_END) fail('no game over with everyone dead');
  g2.timer = 0; while (g2.phase !== PHASE.LOBBY) g2.tick(1 / 30);
  if (g2.zb || [...g2.players.values()].some(q => q.zombie)) fail('zombies left after the game');
}
console.log(fails ? `FAIL zombies (${fails})` : 'PASS zombies');
process.exit(fails ? 1 : 0);
