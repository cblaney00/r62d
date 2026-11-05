// Sprint: faster only the way you aim, stopped by aiming in / walking / crouching / lying down / shooting, gun down until SPRINT_RAISE after, loud. Run: node tests/sprint.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { M_S } from '../shared/physics.js';
import { T } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ free: true }), p = g.addPlayer('Runner', false);
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(p, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
let spot = null;
for (let y = 2; y < g.map.H - 2 && !spot; y++) for (let x = 2; x < g.map.W - 40 && !spot; x++) { let ok = true; for (let i = 0; i < 36 && ok; i++) ok = g.map.tiles[y * g.map.W + x + i] === 0; if (ok) spot = { x: x * 16 + 8, y: y * 16 + 8 }; }
p.alive = true; p.ctrl = 'body'; p.staged = false;
const speed = (input, aim = 0, secs = 1) => {
  Object.assign(p, spot, { vx: 0, vy: 0, aim, pr: 0, spr: false }); p.gunUp = 0; let x0 = 0;
  for (let i = 0; i < secs * 30; i++) { if (i === 15) x0 = p.x; p.prevInput = p.input; p.input = { right: 1, sa: aim, ...input }; g.applyMove(p, 1 / 30); g.time += 1 / 30; }
  return (p.x - x0) / ((secs - 0.5) || 1);
};
const run = speed({}), fast = speed({ sprint: 1 });
if (p.moving !== 3) fail('a sprinter should count as sprinting', p.moving);
if (fast / run < M_S.sprint / M_S.run * 0.9) fail('sprint not faster', run, fast);
console.log(`run ${run.toFixed(0)} px/s, sprint ${fast.toFixed(0)} px/s`);
const back = speed({ sprint: 1 }, Math.PI); if (back > run * 1.05) fail('sprinting backwards', back);
for (const k of ['ads', 'walk', 'crouch', 'prone', 'lean', 'fire']) { const v = speed({ sprint: 1, [k]: 1 }); if (v > run * 1.05 || p.spr) fail('sprint should stop for', k, v); }
// sprint + W: the client turns the keys to the aim (k.rot), so W runs where you aim, in any direction
let open = null;
for (let y = 12; y < g.map.H - 12 && !open; y++) for (let x = 12; x < g.map.W - 12 && !open; x++) { let ok = true; for (let j = -7; j <= 7 && ok; j++) for (let i = -7; i <= 7 && ok; i++) { const t = g.map.tiles[(y + j) * g.map.W + x + i]; ok = t === 0 || t === T.GROUND; } if (ok) open = { x: x * 16 + 8, y: y * 16 + 8 }; }
if (!open) { console.log('FAIL no open ground for the test'); process.exit(1); }
for (const a of [0.7, 2.5, -1.2, -2.8]) {
  Object.assign(p, open, { vx: 0, vy: 0, aim: a, pr: 0, spr: false }); const x0 = open.x, y0 = open.y;
  for (let i = 0; i < 20; i++) { p.input = { up: 1, sprint: 1, sa: a, rot: a + Math.PI / 2 }; g.applyMove(p, 1 / 30); g.time += 1 / 30; }
  const dx = p.x - x0, dy = p.y - y0;
  if (Math.hypot(dx, dy) < 30 || Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - a), Math.cos(Math.atan2(dy, dx) - a))) > 0.6) fail('sprint + W went the wrong way', a, dx, dy);
  if (a === 0.7 && !p.spr) fail('sprint + W should sprint');
}
// loud
speed({}); g.noises = []; speed({}, 0, 0.6); const jog = Math.max(...g.noises.map(n => n.r));
g.noises = []; speed({ sprint: 1 }, 0, 0.6); const spr = Math.max(...g.noises.map(n => n.r));
if (spr <= jog * 1.3) fail('sprint not louder', jog, spr);
// gun down: no shot while sprinting, and not until it has come up again
const gun = p.guns[p.slot]; const ammo0 = gun.ammo; p.fireCd = 0;
speed({ sprint: 1 });
p.input = { fire: 1 }; p.prevInput = {}; p.msgFire = false; p.spr = true; p.click = { a: 0 };
g.tickPlayer(p, 1 / 30); if (gun.ammo !== ammo0) fail('shot while sprinting');
p.spr = false; g.tickPlayer(p, 1 / 30); if (gun.ammo !== ammo0) fail('shot before the gun came up');
g.time += 0.31; p.prevInput = { fire: 1 }; g.tickPlayer(p, 1 / 30); if (gun.ammo !== ammo0 - 1) fail('the held click never fired', gun.ammo, ammo0);
// BULWARK sprints with his shield up (he asked); a riot shield still can't
p.op = 'bulwark'; p.bracing = true; p.riot = null; p.shieldMode = 'shield';
const bRun = speed({}), bFast = speed({ sprint: 1 });
if (!(bFast > bRun * 1.3)) fail('BULWARK should sprint with the shield up', bRun, bFast);
console.log(`bulwark run ${bRun.toFixed(0)} px/s, sprint ${bFast.toFixed(0)} px/s`);
p.op = 'onyx'; p.riot = 'aegis'; const rFast = speed({ sprint: 1 }), rRun = speed({});
if (rFast > rRun * 1.05) fail('a riot shield should not sprint', rRun, rFast);
p.bracing = false; p.riot = null;
console.log(fails ? `${fails} failure(s)` : 'PASS sprint');
process.exit(fails ? 1 : 0);
