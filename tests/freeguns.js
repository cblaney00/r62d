// Free play: any gun from the menu (he asked: change weapons freely). Pistols replace the sidearm, the rest the main
// gun; the pick stays through a respawn and goes when you switch operator. Run: node tests/freeguns.js
import './_tmpdata.js';
import { Game } from '../server/game.js';
import { buildMap } from '../shared/map.js';
import { WEAPONS, SIDEARMS, attachFor } from '../shared/operators.js';
let fails = 0; const ok = (c, ...a) => { if (!c) { fails++; console.log('FAIL', ...a); } };
const g = new Game({ free: true }), p = g.addPlayer('Me', false); p.sock = { open: true, send() {} };
g.mapId = 'harbor'; g.map = buildMap('harbor'); g.handle(p, { t: 'free', a: 'start', map: 'harbor', bots: 0 });
for (const w of Object.keys(WEAPONS).filter(k => !WEAPONS[k].zb)) {
  g.handle(p, { t: 'free', a: 'gun', w }); g.tick(1 / 30);
  const i = p.guns.findIndex(q => q.w === w);
  ok(i >= 0 && p.slot === i, 'not in hand:', w, p.guns.map(q => q.w));
  ok(p.guns.length === 2 && SIDEARMS.has(p.guns[1].w) && !SIDEARMS.has(p.guns[0].w), 'slots mixed up after', w, p.guns.map(q => q.w));
}
g.handle(p, { t: 'free', a: 'gun', w: 'pike' }); g.handle(p, { t: 'free', a: 'gun', w: 'sparrow' });
g.freeSpawn(p, true); ok(p.guns[0].w === 'pike' && p.guns[1].w === 'sparrow', 'pick lost on respawn', p.guns.map(q => q.w));
g.handle(p, { t: 'free', a: 'pick', op: 'rampart' }); ok(!p.guns.some(q => q.w === 'pike'), 'pick kept after switching operator');
g.handle(p, { t: 'free', a: 'gun', w: 'longbow' }); ok(p.guns[0].w === 'longbow' && !p.riot, 'riot shield not replaced', p.riot);
// attachments from the same menu (he asked): every one that fits is taken, a misfit is refused, they stay through a respawn and a gun swap
for (const w of p.guns.map(x => x.w)) for (const [sl, vs] of Object.entries(attachFor(w))) for (const v of vs) {
  g.handle(p, { t: 'free', a: 'att', w, s: sl, v }); const q = p.guns.find(x => x.w === w);
  ok(q && q.att[sl] === v && q.m, 'attachment not fitted', w, sl, v, q && q.att);
}
g.handle(p, { t: 'free', a: 'att', w: 'longbow', s: 'barrel', v: 'suppressor' }); g.handle(p, { t: 'free', a: 'att', w: 'longbow', s: 'grip', v: 'vertical' });
ok(p.guns[0].att.grip !== 'vertical' || attachFor('longbow').grip.includes('vertical'), 'misfit attachment taken');
g.freeSpawn(p, true); ok(p.guns[0].att.barrel === 'suppressor' && p.guns[0].m.quiet, 'attachment lost on respawn', p.guns[0].att);
g.handle(p, { t: 'free', a: 'gun', w: 'pike' }); g.handle(p, { t: 'free', a: 'gun', w: 'longbow' }); ok(p.guns[0].att.barrel === 'suppressor', 'attachment lost on gun swap');
g.handle(p, { t: 'free', a: 'att', w: 'pike', s: 'sight', v: 'holo' }); g.handle(p, { t: 'free', a: 'gun', w: 'pike' }); ok(p.guns[0].att.sight === 'holo', 'attachment for a gun not in hand ignored');
// he said it disconnected him on switching operator: an operator never set up crashed resolveLoadout
for (const op of ['onyx', 'magpie', 'girder', 'salvo']) { try { g.handle(p, { t: 'free', a: 'pick', op }); g.tick(1 / 30); ok(p.op === op, 'switch failed', op); } catch (e) { ok(false, 'switch crashed', op, e.message); } }
console.log(fails ? `${fails} failure(s)` : 'PASS freeguns'); process.exit(fails ? 1 : 0);
