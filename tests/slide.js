// Power slide: only from a sprint, carries you on with the keys ignored, aim locked forward until back up, no aiming in, hip fire works, cooldown. Run: node tests/slide.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { SLIDE, BASE_SPEED } from '../shared/physics.js';
import { T } from '../shared/constants.js';
let fails = 0; const fail = (...a) => { fails++; console.log('FAIL', ...a); };
const g = new Game({ free: true }), p = g.addPlayer('Slider', false);
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(p, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
let open = null;
for (let y = 12; y < g.map.H - 12 && !open; y++) for (let x = 2; x < g.map.W - 40 && !open; x++) { let ok = true; for (let j = -2; j <= 2 && ok; j++) for (let i = 0; i < 36 && ok; i++) { const t = g.map.tiles[(y + j) * g.map.W + x + i]; ok = t === 0 || t === T.GROUND; } if (ok) open = { x: x * 16 + 8, y: y * 16 + 8 }; }
if (!open) { console.log('FAIL no open ground'); process.exit(1); }
p.alive = true; p.ctrl = 'body'; p.staged = false;
const go = (input, secs) => { for (let i = 0; i < Math.round(secs * 30); i++) { p.prevInput = p.input; p.input = { sa: 0, ...input }; g.applyMove(p, 1 / 30); g.time += 1 / 30; } };
const reset = () => { Object.assign(p, open, { vx: 0, vy: 0, aim: 0, pr: 0, spr: false, slT: 0, slR: 0, scd: 0, gunUp: 0 }); };
reset(); go({ right: 1, slide: 1 }, 0.1); if (p.slT > 0) fail('slid without sprinting');
reset(); go({ right: 1, sprint: 1 }, 0.5); const x0 = p.x; go({ right: 1, crouch: 1, slide: 1 }, 1 / 30);
if (!(p.slT > 0)) fail('no slide from a sprint');
go({ up: 1 }, SLIDE.t - 0.1); if (Math.abs(p.y - open.y) > 1) fail('keys steered the slide', p.y - open.y);
const dist = (p.x - x0) / 36; console.log('slide went', dist.toFixed(1), 'm');
if (dist < 1.2 || dist > 3) fail('slide length', dist);
g.handle(p, { t: 'input', s: 1, dt: 0, a: 1.5, k: {} }); if (Math.abs(p.aim) > SLIDE.lock + 0.001) fail('aim not locked', p.aim);
go({}, 0.15); if (!(p.slT > 0 || p.slR > 0)) fail('slide over too soon');
g.handle(p, { t: 'input', s: 2, dt: 0, a: -1.5, k: {} }); if (Math.abs(p.aim) > SLIDE.lock + 0.001) fail('aim not locked getting up', p.aim);
go({}, SLIDE.up + 0.1); if (p.slR > 0 || p.slT > 0) fail('never got up');
g.handle(p, { t: 'input', s: 3, dt: 0, a: 1.5, k: {} }); if (Math.abs(p.aim - 1.5) > 0.001) fail('aim still locked after getting up', p.aim);
// no second slide during the cooldown
p.aim = 0; go({ right: 1, sprint: 1 }, 0.3); go({ right: 1, slide: 1 }, 1 / 30); if (p.slT > 0) fail('slid again inside the cooldown');
// hip fire works in a slide
reset(); go({ right: 1, sprint: 1 }, 0.5); go({ right: 1, slide: 1 }, 1 / 30);
const gun = p.guns[p.slot], a0 = gun.ammo; p.fireCd = 0; p.input = { fire: 1 }; p.prevInput = {}; p.click = { a: 0 }; g.tickPlayer(p, 1 / 30);
if (gun.ammo !== a0 - 1) fail('no hip fire in a slide', gun.ammo, a0);
console.log(fails ? fails + ' failure(s)' : 'PASS slide');
process.exit(fails ? 1 : 0);
